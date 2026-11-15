import rawPackage from '../data/soilgrids/pilots-v1.json';
import { SOIL_DEPTHS, SOIL_PROPERTIES, SoilGridsPackageSchema } from '../types/soilGridsPackage';
import type { SoilGridsPackage, SoilProperty, SoilModelEvidence } from '../types/soilGridsPackage';
import type { SoilData, SoilTexture, MetricProvenance, SoilMetric } from '../types';
import { SOIL_METRICS } from '../data/provenance';
import {
  deriveOrganicMatterFromSoc,
  derivePreliminaryDrainage,
  buildDerivedOrganicMatterProvenance,
  buildDerivedDrainageProvenance
} from './soilDerivation';

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

export interface ResolveBundledSoilOptions {
  fallbackToNearest?: boolean;
  maxDistanceKm?: number;
}

function depthWeightedMean(
  data: SoilGridsPackage,
  grid: SoilGridsPackage['grids'][number],
  property: SoilProperty,
  index: number
): number | undefined {
  // Thickness-weighted 0–15 cm mean. Both depth predictions are mandatory.
  // Per-depth Q05/Q95 stay separate: no invented aggregate prediction interval.
  const [top, lower] = SOIL_DEPTHS.map(depth => grid.readings[property][depth].mean[index]);
  return top === null || lower === null
    ? undefined
    : (top * 5 + lower * 10) / 15 / data.properties[property].divisor;
}

export function isCellComplete(grid: SoilGridsPackage['grids'][number], cellIndex: number): boolean {
  for (const property of SOIL_PROPERTIES) {
    for (const depth of SOIL_DEPTHS) {
      if (grid.readings[property][depth].mean[cellIndex] === null) {
        return false;
      }
    }
  }
  return true;
}

function isCompleteAgriculturalCell(
  data: SoilGridsPackage,
  grid: SoilGridsPackage['grids'][number],
  index: number
): boolean {
  const ph = depthWeightedMean(data, grid, 'phh2o', index);
  const clay = depthWeightedMean(data, grid, 'clay', index);
  const sand = depthWeightedMean(data, grid, 'sand', index);
  const silt = depthWeightedMean(data, grid, 'silt', index);
  const soc = depthWeightedMean(data, grid, 'soc', index);
  return ph !== undefined && clay !== undefined && sand !== undefined && silt !== undefined && soc !== undefined && clay + sand + silt > 0;
}

function centroidDistanceKm(footprint: Position[], lat: number, lon: number): number {
  const cLat = (footprint[0][1] + footprint[1][1] + footprint[2][1] + footprint[3][1]) / 4;
  const cLon = (footprint[0][0] + footprint[1][0] + footprint[2][0] + footprint[3][0]) / 4;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return Number(Math.hypot((cLat - lat) * 111.32, (cLon - lon) * 111.32 * cosLat).toFixed(2));
}

export function findNearestValidCell(
  grid: SoilGridsPackage['grids'][number],
  lat: number,
  lon: number,
  maxDistanceKm = 1.5
): { index: number; footprint: Position[]; distanceKm: number } | null {
  let best: { index: number; footprint: Position[]; distanceKm: number } | null = null;

  for (let idx = 0; idx < grid.rows * grid.cols; idx++) {
    if (!isCellComplete(grid, idx)) continue;
    const fp = soilCellFootprint(grid, idx);
    const distKm = centroidDistanceKm(fp, lat, lon);
    if (distKm <= maxDistanceKm && (!best || distKm < best.distanceKm)) {
      best = { index: idx, footprint: fp, distanceKm: distKm };
    }
  }
  return best;
}

function findNearestValidCellIndex(
  data: SoilGridsPackage,
  grid: SoilGridsPackage['grids'][number],
  requestedIndex: number
): { index: number; distanceGridCells: number } | null {
  const reqRow = Math.floor(requestedIndex / grid.cols);
  const reqCol = requestedIndex % grid.cols;
  let best: { index: number; distanceGridCells: number } | null = null;
  for (let i = 0; i < grid.rows * grid.cols; i++) {
    if (!isCompleteAgriculturalCell(data, grid, i)) continue;
    const row = Math.floor(i / grid.cols);
    const col = i % grid.cols;
    const distanceGridCells = Math.hypot(row - reqRow, col - reqCol);
    if (
      !best ||
      distanceGridCells < best.distanceGridCells - 1e-12 ||
      (Math.abs(distanceGridCells - best.distanceGridCells) <= 1e-12 && i < best.index)
    ) {
      best = { index: i, distanceGridCells };
    }
  }
  return best;
}

/**
 * Resolves packaged SoilGrids model data inside pilot coverage; steps deterministically
 * to the nearest valid cropland 250 m cell when the requested pixel is masked NoData
 * (unless `fallbackToNearest: false`), and returns null outside packaged coverage or
 * when an entire grid has no valid cells.
 */
export function resolveBundledSoil(
  lat: number,
  lon: number,
  data = bundledPackage,
  options?: ResolveBundledSoilOptions
): SoilData | null {
  if (!data) return null;
  const fallbackToNearest = options?.fallbackToNearest ?? true;
  for (const grid of data.grids) {
    if (Math.abs(lat - grid.center.lat) > 0.03 || Math.abs(lon - grid.center.lon) > 0.03) continue;
    for (let index = 0; index < grid.rows * grid.cols; index++) {
      const footprint = soilCellFootprint(grid, index);
      if (!containsSoilCell(footprint, lat, lon)) continue;
      if (isCompleteAgriculturalCell(data, grid, index)) {
        return profileForCell(data, grid, index, footprint);
      }
      if (!fallbackToNearest) {
        return profileForCell(data, grid, index, footprint);
      }
      const nearest = findNearestValidCellIndex(data, grid, index);
      if (!nearest) return null;
      const nearestFootprint = soilCellFootprint(grid, nearest.index);
      const distanceKm = centroidDistanceKm(nearestFootprint, lat, lon);
      if (options?.maxDistanceKm !== undefined && distanceKm > options.maxDistanceKm) return null;
      return profileForCell(data, grid, nearest.index, nearestFootprint, {
        requestedCellIndex: index,
        offsetDistanceMeters: Math.round(nearest.distanceGridCells * 250),
        relocatedFrom: {
          originalLat: lat,
          originalLon: lon,
          distanceKm,
          cellIndex: index,
          reason: 'nodata_cell'
        }
      });
    }
  }
  return null;
}

function profileForCell(
  data: SoilGridsPackage,
  grid: SoilGridsPackage['grids'][number],
  index: number,
  footprint: Position[],
  stepMeta?: {
    requestedCellIndex: number;
    offsetDistanceMeters: number;
    relocatedFrom: NonNullable<SoilModelEvidence['relocatedFrom']>;
  }
): SoilData {
  const evidence: SoilModelEvidence = {
    packageId: data.id, gridId: grid.id, gridName: grid.name, cellIndex: index,
    ...(stepMeta ? {
      requestedCellIndex: stepMeta.requestedCellIndex,
      offsetDistanceMeters: stepMeta.offsetDistanceMeters,
      relocatedFrom: stepMeta.relocatedFrom
    } : {}),
    footprint,
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
  const mean = (property: SoilProperty): number | undefined => depthWeightedMean(data, grid, property, index);
  const clay = mean('clay'), sand = mean('sand'), silt = mean('silt'), soc = mean('soc');
  let texture: SoilTexture | null = null;
  if (clay !== undefined && sand !== undefined && silt !== undefined && clay + sand + silt > 0) {
    // Compatibility classification; not a validated USDA triangle or field test.
    texture = clay >= 38 ? 'clay' : clay >= 26 ? 'clay_loam' : sand >= 55 ? 'sandy_loam' : silt >= 50 ? 'silt_loam' : 'loam';
  }
  const round = (value: number | undefined, digits: number) => value === undefined ? undefined : Number(value.toFixed(digits));
  const clayPct = round(clay, 1);
  const sandPct = round(sand, 1);
  const rawSocDgPerKg = soc === undefined ? undefined : round(soc * 100, 2);
  const organicMatter = deriveOrganicMatterFromSoc(rawSocDgPerKg);
  const drainage = derivePreliminaryDrainage({ texture, clayPct, sandPct });
  const stepNote = stepMeta
    ? `Default coordinates fell on an unmeasured cell (cell ${stepMeta.requestedCellIndex + 1}); data resolved from nearest valid agricultural cell (cell ${index + 1}, ${stepMeta.relocatedFrom.distanceKm} km / ~${stepMeta.offsetDistanceMeters} m away). `
    : '';
  const soil: SoilData = {
    source: 'ISRIC SoilGrids 2.0 · bundled model grid', modelEvidence: evidence,
    ph: round(mean('phh2o'), 1) ?? null, rawClayPercent: clayPct, rawSandPercent: sandPct,
    rawSocDgPerKg,
    bulkDensityGcm3: round(mean('bdod'), 2), texture,
    drainage, organicMatter, isEstimate: false, needsReview: true,
    reviewNote: `${stepNote}Native 250 m soil model; OM derived from SOC (Van Bemmelen ×1.724) and drainage is a texture/slope screen requiring local farmer validation. Topsoil bulk density does not establish subsoil compaction. Unvalidated local classifications remain provisional.`
  };
  const variables: Partial<Record<SoilMetric, string>> = { texture: 'clay / sand / silt → texture', ph: 'phh2o',
    rawClayPercent: 'clay', rawSandPercent: 'sand', rawSocDgPerKg: 'soc', bulkDensityGcm3: 'bdod' };
  const units: Partial<Record<SoilMetric, string>> = { ph: 'pH', rawClayPercent: '%', rawSandPercent: '%',
    rawSocDgPerKg: 'dg/kg', bulkDensityGcm3: 'g/cm³', slopePct: '%' };
  soil.provenance = Object.fromEntries(SOIL_METRICS.map(key => {
    if (key === 'organicMatter') {
      return [key, {
        ...buildDerivedOrganicMatterProvenance(rawSocDgPerKg, {
          spatialResolution: '250 m',
          depth: '0–5 cm and 5–15 cm',
          baseSource: 'ISRIC SoilGrids 2.0',
          note: stepMeta
            ? `${stepNote}Derived from SoilGrids SOC via Van Bemmelen factor (1.724); verify with BSWM Soil Test Kit or laboratory analysis.`
            : undefined
        }),
        productVersion: data.productVersion,
        citation: data.citation,
        retrievedAt: data.retrievedAt
      } satisfies MetricProvenance];
    }
    if (key === 'drainage') {
      return [key, {
        ...buildDerivedDrainageProvenance({
          drainage,
          hasSlope: false,
          spatialResolution: '250 m',
          depth: '0–5 cm and 5–15 cm',
          baseSource: 'ISRIC SoilGrids 2.0',
          note: stepMeta
            ? `${stepNote}Preliminary textural and topographic drainage estimate, not a field percolation test.`
            : undefined
        }),
        productVersion: data.productVersion,
        citation: data.citation,
        retrievedAt: data.retrievedAt
      } satisfies MetricProvenance];
    }
    const nativeMetric = !['drainage', 'organicMatter', 'phosphorusFixationRisk', 'slopePct'].includes(key);
    const available = soil[key] !== undefined && soil[key] !== null;
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
