import rawPackage from '../data/soilgrids/pilots-v1.json';
import { SOIL_DEPTHS, SOIL_PROPERTIES, SoilGridsPackageSchema } from '../types/soilGridsPackage';
import type { SoilGridsPackage, SoilProperty, SoilModelEvidence } from '../types/soilGridsPackage';
import type { SoilData, SoilTexture, MetricProvenance, SoilMetric } from '../types';
import { SOIL_METRICS } from '../data/provenance';

// Validate the shipped artifact once, including masked cells. A damaged package
// must fall through to the bounded existing live/cache/reference hierarchy.
const parsedPackage = SoilGridsPackageSchema.safeParse(rawPackage);
const bundledPackage = parsedPackage.success ? parsedPackage.data : null;
if (!bundledPackage) console.warn('Bundled SoilGrids package failed validation; using existing soil sources.');

type Position = [number, number];
export function containsSoilCell(footprint: Position[], lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Convex native-cell corners, converted to WGS84 during preprocessing.
  // Chords differ negligibly at 250 m; exact shared edges choose the first cell.
  const crosses = footprint.map(([x, y], index) => {
    const [nextX, nextY] = footprint[(index + 1) % footprint.length];
    return (nextX - x) * (lat - y) - (nextY - y) * (lon - x);
  });
  return crosses.every(value => value >= -1e-13) || crosses.every(value => value <= 1e-13);
}

export function soilCellFootprint(grid: SoilGridsPackage['grids'][number], index: number): Position[] {
  const row = Math.floor(index / grid.cols), col = index % grid.cols, stride = grid.cols + 1;
  return [row * stride + col, row * stride + col + 1, (row + 1) * stride + col + 1, (row + 1) * stride + col]
    .map((index): Position => [...grid.nodes[index]]);
}

/** Returns null OUTSIDE packaged coverage; masked pixels inside remain missing. */
export function resolveBundledSoil(lat: number, lon: number, data = bundledPackage): SoilData | null {
  if (!data) return null;
  for (const grid of data.grids) {
    if (Math.abs(lat - grid.center.lat) > 0.03 || Math.abs(lon - grid.center.lon) > 0.03) continue;
    for (let index = 0; index < grid.rows * grid.cols; index++) {
      const footprint = soilCellFootprint(grid, index);
      if (!containsSoilCell(footprint, lat, lon)) continue;
      return profileForCell(data, grid, index, footprint);
    }
  }
  return null;
}

function profileForCell(data: SoilGridsPackage, grid: SoilGridsPackage['grids'][number], index: number, footprint: Position[]): SoilData {
  const evidence: SoilModelEvidence = {
    packageId: data.id, gridId: grid.id, gridName: grid.name, cellIndex: index, footprint,
    retrievedAt: data.retrievedAt, license: data.license,
    readings: SOIL_PROPERTIES.map(property => ({ property, unit: data.properties[property].unit,
      depths: Object.fromEntries(SOIL_DEPTHS.map(depth => [depth, Object.fromEntries(
        (['mean', 'q05', 'q95'] as const).map(statistic => {
          const value = grid.readings[property][depth][statistic][index];
          return [statistic, value === null ? null : value / data.properties[property].divisor];
        })
      )])) as SoilModelEvidence['readings'][number]['depths']
    }))
  };
  // Thickness-weighted 0–15 cm mean. Both depth predictions are mandatory.
  // Per-depth Q05/Q95 stay separate: no invented aggregate prediction interval.
  const mean = (property: SoilProperty): number | undefined => {
    const [top, lower] = SOIL_DEPTHS.map(depth => grid.readings[property][depth].mean[index]);
    return top === null || lower === null ? undefined : (top * 5 + lower * 10) / 15 / data.properties[property].divisor;
  };
  const clay = mean('clay'), sand = mean('sand'), silt = mean('silt'), soc = mean('soc');
  let texture: SoilTexture | null = null;
  if (clay !== undefined && sand !== undefined && silt !== undefined && clay + sand + silt > 0) {
    // Compatibility classification; not a validated USDA triangle or field test.
    texture = clay >= 38 ? 'clay' : clay >= 26 ? 'clay_loam' : sand >= 55 ? 'sandy_loam' : silt >= 50 ? 'silt_loam' : 'loam';
  }
  const round = (value: number | undefined, digits: number) => value === undefined ? undefined : Number(value.toFixed(digits));
  const soil: SoilData = {
    source: 'ISRIC SoilGrids 2.0 · bundled model grid', modelEvidence: evidence,
    ph: round(mean('phh2o'), 1) ?? null, rawClayPercent: round(clay, 1), rawSandPercent: round(sand, 1),
    rawSocDgPerKg: soc === undefined ? undefined : round(soc * 100, 2),
    bulkDensityGcm3: round(mean('bdod'), 2), texture,
    // SOC is not measured organic matter; texture does not establish drainage.
    drainage: null, organicMatter: 'unknown', isEstimate: false, needsReview: true,
    reviewNote: 'Native 250 m soil model; not current field observations. Verify local texture, drainage and organic matter. Topsoil bulk density does not establish subsoil compaction. Unvalidated local classifications remain provisional.'
  };
  const variables: Partial<Record<SoilMetric, string>> = { texture: 'clay / sand / silt → texture', ph: 'phh2o',
    rawClayPercent: 'clay', rawSandPercent: 'sand', rawSocDgPerKg: 'soc', bulkDensityGcm3: 'bdod' };
  const units: Partial<Record<SoilMetric, string>> = { ph: 'pH', rawClayPercent: '%', rawSandPercent: '%',
    rawSocDgPerKg: 'dg/kg', bulkDensityGcm3: 'g/cm³', slopePct: '%' };
  soil.provenance = Object.fromEntries(SOIL_METRICS.map(key => {
    const nativeMetric = !['drainage', 'organicMatter', 'phosphorusFixationRisk', 'slopePct'].includes(key);
    const available = soil[key] !== undefined && soil[key] !== null && soil[key] !== 'unknown';
    return [key, {
      source: 'ISRIC SoilGrids 2.0', tier: available ? 'bundled-model' : 'unavailable',
      variable: variables[key] ?? key, unit: units[key] ?? 'class',
      spatialResolution: nativeMetric ? '250 m' : null, dateRange: null, depth: nativeMetric ? '0–5 cm and 5–15 cm' : null,
      isSample: false, isSynthetic: false, cached: false, needsReview: true,
      productVersion: data.productVersion, citation: data.citation, retrievedAt: data.retrievedAt,
      methodKey: available ? key === 'texture' ? 'provenance.methods.texture' : 'soilModel.depthMean' : 'soilModel.notInferred',
      method: available ? 'Thickness-weighted mean: (0–5 cm × 5 + 5–15 cm × 10) / 15; both depths required.'
        : 'Missing model value or unsupported field property; no substitution.',
      note: soil.reviewNote!
    } satisfies MetricProvenance];
  })) as Record<SoilMetric, MetricProvenance>;
  return soil;
}
