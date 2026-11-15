import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawPackage from '../data/soilgrids/pilots-v1.json';
import { SoilGridsPackageSchema, SoilModelEvidenceSchema, SOIL_PROPERTIES, SOIL_DEPTHS } from '../types/soilGridsPackage';
import { resolveBundledSoil, soilCellFootprint } from '../services/bundledSoilGrids';
import { fetchSoilGridsData, soilCacheKey, applyFarmerSoilOverride } from '../services/soilGrids';
import { CacheService } from '../services/cache';
import { soilProvenance, formatProvenance } from '../data/provenance';
import { hasRequiredSoilInputs } from '../engine/soilInputs';
import { SoilCard } from '../components/SoilCard';
import { useAppStore } from '../store/useAppStore';
import { SoilModelDetails } from '../components/SoilModelDetails';
import { getTranslation, translations } from '../i18n';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { withTerrainEvidence } from '../services/realLandData';
import { buildSampleLandSummary } from '../services/landSummary';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { MunicipalLandFixtureSchema } from '../types/landFixture';
import { generateRotationRecommendations } from '../engine';
import cropsData from '../data/crops.json';
import type { ClimateData, Crop, FarmerPriorities } from '../types';

vi.mock('../store/useAppStore', async importOriginal => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

const data = SoilGridsPackageSchema.parse(rawPackage);
const gridCenter = (grid: typeof data.grids[number], index: number) => {
  const footprint = soilCellFootprint(grid, index);
  return { lat: footprint.reduce((sum, [, lat]) => sum + lat / 4, 0), lon: footprint.reduce((sum, [lon]) => sum + lon / 4, 0) };
};
function validCell(grid = data.grids[0]) {
  const index = grid.readings.phh2o['0-5cm'].mean.findIndex((value, index) => value !== null && grid.readings.phh2o['5-15cm'].mean[index] !== null);
  if (index < 0) throw new Error('No valid pH cell in test grid');
  return { grid, index, ...gridCenter(grid, index) };
}
afterEach(() => { useAppStore.setState(useAppStore.getInitialState(), true); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('native SoilGrids pilot package', () => {
  it('validates all four existing preset coordinates and explicit licensing/provenance', () => {
    expect(data.license).toBe('CC-BY-4.0');
    expect(data.observationPeriod).toBeNull();
    for (const grid of data.grids) {
      const pilot = PILOT_LOCATIONS.find(pilot => pilot.id === grid.id)!;
      expect(grid.center).toEqual({ lat: pilot.lat, lon: pilot.lon });
      expect(grid.assets).toHaveLength(36);
      expect(grid.nativeBounds[2] - grid.nativeBounds[0]).toBe(2250);
    }
  });
  it.each(data.grids.map(grid => [grid.id, grid] as const))('maps every valid cell directly and steps masked cells deterministically in %s', (_id, grid) => {
    for (let index = 0; index < 81; index++) {
      const point = gridCenter(grid, index);
      const soil = resolveBundledSoil(point.lat, point.lon)!;
      const usedIndex = soil.modelEvidence!.cellIndex;
      const directlyComplete = (['phh2o', 'clay', 'sand', 'silt', 'soc'] as const).every(property =>
        SOIL_DEPTHS.every(depth => grid.readings[property][depth].mean[index] !== null)
      ) && (grid.readings.clay['0-5cm'].mean[index]! + grid.readings.sand['0-5cm'].mean[index]! + grid.readings.silt['0-5cm'].mean[index]! > 0);
      expect(soil.modelEvidence?.gridId).toBe(grid.id);
      if (directlyComplete) {
        expect(usedIndex).toBe(index);
        expect(soil.modelEvidence?.requestedCellIndex).toBeUndefined();
      } else {
        expect(usedIndex).not.toBe(index);
        expect(soil.modelEvidence?.requestedCellIndex).toBe(index);
        expect(soil.modelEvidence?.offsetDistanceMeters).toBeGreaterThanOrEqual(250);
      }
      expect(SoilModelEvidenceSchema.safeParse(soil.modelEvidence).success).toBe(true);
      for (const property of SOIL_PROPERTIES) {
        for (const depth of SOIL_DEPTHS) {
          const raw = grid.readings[property][depth].mean[usedIndex];
          const reading = soil.modelEvidence!.readings.find(reading => reading.property === property)!;
          expect(reading.depths[depth].mean).toBe(raw === null ? null : raw / data.properties[property].divisor);
        }
      }
    }
  });
  it('does not expose mutable references to the shipped grid or source predictions', () => {
    const { lat, lon } = validCell();
    const first = resolveBundledSoil(lat, lon)!;
    const original = structuredClone(first);
    first.modelEvidence!.footprint[0][0] = 0;
    first.modelEvidence!.readings[0].depths['0-5cm'].mean = 14;
    expect(resolveBundledSoil(lat, lon)).toEqual(original);
  });
  it('converts all units, uses thickness weighting, and derives preliminary synthetic OM/drainage', () => {
    const copy = structuredClone(data);
    const { grid, index, lat, lon } = validCell(copy.grids[1]);
    const values = { phh2o: [50, 65], clay: [300, 450], sand: [400, 250], silt: [300, 300], soc: [100, 160], bdod: [120, 150] };
    for (const property of SOIL_PROPERTIES) {
      SOIL_DEPTHS.forEach((depth, depthIndex) => { grid.readings[property][depth].mean[index] = values[property][depthIndex]; });
    }
    const soil = resolveBundledSoil(lat, lon, copy)!;
    expect(soil.ph).toBe(6);
    expect(soil.rawClayPercent).toBe(40);
    expect(soil.rawSandPercent).toBe(30);
    expect(soil.rawSocDgPerKg).toBe(140);
    expect(soil.bulkDensityGcm3).toBe(1.4);
    expect(soil.texture).toBe('clay');
    expect(soil.organicMatter).toBe('medium');
    expect(soil.drainage).toBe('poor');
    expect(soil.phosphorusFixationRisk).toBeUndefined();
    expect(soil.slopePct).toBeUndefined();
    expect(soil.modelEvidence!.readings[0].depths['0-5cm'].q05).toBe(grid.readings.phh2o['0-5cm'].q05[index]! / 10);
    expect(hasRequiredSoilInputs(soil)).toBe(true);
    expect(soil.provenance?.organicMatter).toMatchObject({
      tier: 'synthetic', isSynthetic: true, needsReview: true, methodKey: 'provenance.methods.organicMatter'
    });
    expect(soil.provenance?.drainage).toMatchObject({
      tier: 'synthetic', isSynthetic: true, needsReview: true, methodKey: 'provenance.methods.drainage'
    });
    const overridden = applyFarmerSoilOverride(soil, { drainage: 'moderate', organicMatter: 'high' });
    expect(hasRequiredSoilInputs(overridden)).toBe(true);
    expect(overridden.provenance?.ph?.tier).toBe('bundled-model');
    expect(overridden.provenance?.drainage).toMatchObject({ tier: 'farmer', isSynthetic: false });
    expect(overridden.provenance?.organicMatter).toMatchObject({ tier: 'farmer', isSynthetic: false });
  });
  it('retains optional missing bdod/zeros on complete cells, steps on damaged pH, and returns null for wholly masked grids', () => {
    const zeroCopy = structuredClone(data);
    const { grid: zeroGrid, index: zeroIndex, lat: zeroLat, lon: zeroLon } = validCell(zeroCopy.grids[0]);
    zeroGrid.readings.bdod['5-15cm'].mean[zeroIndex] = null;
    for (const depth of SOIL_DEPTHS) {
      zeroGrid.readings.clay[depth].mean[zeroIndex] = 0;
      zeroGrid.readings.soc[depth].mean[zeroIndex] = 0;
    }
    const zeroSoil = resolveBundledSoil(zeroLat, zeroLon, zeroCopy)!;
    expect(zeroSoil.modelEvidence?.cellIndex).toBe(zeroIndex);
    expect(zeroSoil.modelEvidence?.requestedCellIndex).toBeUndefined();
    expect(zeroSoil.bulkDensityGcm3).toBeUndefined();
    expect(zeroSoil.rawClayPercent).toBe(0);
    expect(zeroSoil.rawSocDgPerKg).toBe(0);
    expect(zeroSoil.organicMatter).toBe('low');
    expect(soilProvenance(zeroSoil).rawSocDgPerKg.tier).toBe('bundled-model');
    expect(soilProvenance(zeroSoil).bulkDensityGcm3.tier).toBe('unavailable');

    const damagedCopy = structuredClone(data);
    const { grid: damagedGrid, index: damagedIndex, lat: damagedLat, lon: damagedLon } = validCell(damagedCopy.grids[0]);
    damagedGrid.readings.phh2o['0-5cm'].mean[damagedIndex] = null;
    const recovered = resolveBundledSoil(damagedLat, damagedLon, damagedCopy)!;
    expect(recovered.modelEvidence?.requestedCellIndex).toBe(damagedIndex);
    expect(recovered.modelEvidence?.cellIndex).not.toBe(damagedIndex);
    expect(recovered.modelEvidence?.offsetDistanceMeters).toBeGreaterThanOrEqual(250);
    expect(recovered.ph).not.toBeNull();
    expect(hasRequiredSoilInputs(recovered)).toBe(true);

    const whollyNull = structuredClone(data);
    whollyNull.grids[0].readings.phh2o['0-5cm'].mean.fill(null);
    expect(resolveBundledSoil(damagedLat, damagedLon, whollyNull)).toBeNull();
  });
  it('steps masked Muñoz and Malaybalay preset center pixels to nearest valid 250 m cropland cells while preserving Ilagan and Pototan direct cells', () => {
    const expected = [
      { id: 'munoz', cellIndex: 31, requestedCellIndex: 40, offsetDistanceMeters: 250, ph: 6.4, texture: 'clay', organicMatter: 'high', drainage: 'poor' },
      { id: 'bukidnon', cellIndex: 41, requestedCellIndex: 40, offsetDistanceMeters: 250, ph: 5.5, texture: 'clay', organicMatter: 'high', drainage: 'poor' },
      { id: 'ilagan', cellIndex: 40, requestedCellIndex: undefined, offsetDistanceMeters: undefined, ph: 5.6, texture: 'clay', organicMatter: 'high', drainage: 'poor' },
      { id: 'pototan', cellIndex: 40, requestedCellIndex: undefined, offsetDistanceMeters: undefined, ph: 5.7, texture: 'clay_loam', organicMatter: 'high', drainage: 'moderate' }
    ] as const;
    for (const item of expected) {
      const grid = data.grids.find(grid => grid.id === item.id)!;
      const soil = resolveBundledSoil(grid.center.lat, grid.center.lon)!;
      expect(soil.modelEvidence?.cellIndex).toBe(item.cellIndex);
      expect(soil.modelEvidence?.requestedCellIndex).toBe(item.requestedCellIndex);
      expect(soil.modelEvidence?.offsetDistanceMeters).toBe(item.offsetDistanceMeters);
      expect(soil.ph).toBe(item.ph);
      expect(soil.texture).toBe(item.texture);
      expect(soil.organicMatter).toBe(item.organicMatter);
      expect(soil.drainage).toBe(item.drainage);
      expect(soil.isEstimate).toBe(false);
      expect(soil.needsReview).toBe(true);
      expect(hasRequiredSoilInputs(soil)).toBe(true);
    }
  });
  it('does not assign packaged data outside actual grid footprints', () => {
    expect(resolveBundledSoil(15.8, 120.906)).toBeNull();
    expect(resolveBundledSoil(0, 0)).toBeNull();
    for (const grid of data.grids) {
      const corner = grid.nodes[0];
      expect(resolveBundledSoil(corner[1] + 0.00001, corner[0] - 0.00001)).toBeNull();
    }
    expect(resolveBundledSoil(Number.NaN, 120.906)).toBeNull();
  });
  it('resolves shared cell edges deterministically', () => {
    const grid = data.grids[1];
    const upper = grid.nodes[1], lower = grid.nodes[11];
    const lat = (upper[1] + lower[1]) / 2, lon = (upper[0] + lower[0]) / 2;
    expect(resolveBundledSoil(lat, lon)?.modelEvidence?.cellIndex).toBe(0);
  });
  it.each(['bad-unit', 'bad-depth', 'nodata', 'duplicate-grid', 'duplicate-asset', 'wrong-geometry', 'reversed-quantile'])('rejects damaged packages: %s', change => {
    const copy = structuredClone(rawPackage);
    if (change === 'bad-unit') copy.properties.phh2o.divisor = 100;
    if (change === 'bad-depth') copy.depths.reverse();
    if (change === 'nodata') copy.grids[0].readings.clay['0-5cm'].mean[0] = -32768;
    if (change === 'duplicate-grid') copy.grids[1].id = copy.grids[0].id;
    if (change === 'duplicate-asset') copy.grids[0].assets[1] = copy.grids[0].assets[0];
    if (change === 'wrong-geometry') copy.grids[0].nodes[0][0] += 5;
    if (change === 'reversed-quantile') {
      copy.grids[0].readings.phh2o['0-5cm'].q05[0] = 70;
      copy.grids[0].readings.phh2o['0-5cm'].q95[0] = 60;
    }
    expect(SoilGridsPackageSchema.safeParse(copy).success).toBe(false);
  });
  it('resolves locally before API caches or network and steps masked town centers cleanly', async () => {
    await CacheService.set(soilCacheKey(15.714, 120.906), { schemaVersion: 2, profile: { ph: 9 } });
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.ph).toBe(6.4);
    expect(soil.modelEvidence?.gridId).toBe('munoz');
    expect(soil.modelEvidence?.requestedCellIndex).toBe(40);
    expect(soil.modelEvidence?.cellIndex).toBe(31);
    expect(fetch).not.toHaveBeenCalled();
    await CacheService.clear();
  });
  it('rejects copied bundled profiles in API caches outside packaged coverage', async () => {
    const copied = resolveBundledSoil(16.975, 121.810)!;
    await CacheService.set(soilCacheKey(15.8, 120.906), { schemaVersion: 2, profile: copied });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ properties: { layers: [{ name: 'phh2o', depths: [
      { label: '0-5cm', values: { mean: 72 } }, { label: '5-15cm', values: { mean: 72 } }
    ] }] } }) });
    vi.stubGlobal('fetch', fetch);
    const soil = await fetchSoilGridsData(15.8, 120.906);
    expect(soil.modelEvidence).toBeUndefined();
    expect(soil.ph).toBe(7.2);
    expect(soil.provenance?.ph?.tier).toBe('live');
    expect(fetch).toHaveBeenCalledTimes(1);
    await CacheService.clear();
  });
  it.each(['en', 'fil'] as const)('renders clear original values, uncertainty, coverage and licensing in %s', language => {
    const { lat, lon } = validCell();
    const soil = resolveBundledSoil(lat, lon)!;
    const html = renderToStaticMarkup(createElement(SoilModelDetails, { evidence: soil.modelEvidence!, language }));
    expect(html).toContain(getTranslation(language, 'soilModel.title'));
    expect(html).toContain(getTranslation(language, 'soilModel.uncertainty'));
    expect(html).toContain('CC BY 4.0');
    expect(html).toContain('pilots-v1-rasters.zip');
    const formatted = formatProvenance(language, soil.provenance!.ph!);
    expect(formatted).toContain(getTranslation(language, 'provenance.bundled-model'));
    expect(formatted).not.toContain('API 2.0.0');
  });
  it.each(['en', 'fil'] as const)('keeps noPredictions warning for empty evidence and offers separate drainage/organic-matter inputs for stepped Muñoz cells in %s', language => {
    const soil = resolveBundledSoil(15.714, 120.906)!;
    const emptyEvidence = {
      ...soil.modelEvidence!,
      readings: soil.modelEvidence!.readings.map(reading => ({
        ...reading,
        depths: {
          '0-5cm': { mean: null, q05: null, q95: null },
          '5-15cm': { mean: null, q05: null, q95: null }
        }
      }))
    };
    const emptyHtml = renderToStaticMarkup(createElement(SoilModelDetails, { evidence: emptyEvidence, language }));
    expect(emptyHtml).toContain(getTranslation(language, 'soilModel.noPredictions'));

    useAppStore.setState({ soilData: soil, language });
    const html = renderToStaticMarkup(createElement(SoilCard));
    expect(html).toContain(getTranslation(language, 'soilModel.drainagePrompt'));
    expect(html).toContain(getTranslation(language, 'soilModel.organicMatterPrompt'));
    expect(html).toContain(
      getTranslation(language, 'soilModel.nearestValidCell')
        .replace('{requestedCell}', '41')
        .replace('{usedCell}', '32')
        .replace('{meters}', '250')
    );
    expect(html).toContain(getTranslation(language, 'dataQuality.useMunicipalBaseline'));
    expect(html).not.toContain(getTranslation(language, 'dataQuality.missingSoil'));
    useAppStore.getState().setSoilOverride({ drainage: 'moderate' });
    expect(useAppStore.getState().soilOverride).toMatchObject({ drainage: 'moderate' });
    expect(applyFarmerSoilOverride(soil, useAppStore.getState().soilOverride).ph).toBe(6.4);
  });
  it('unblocks full rotation generation including Strategy 1 baseline for all four pilot presets with zero manual overrides', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const slugMap = { munoz: 'munoz', ilagan: 'ilagan', pototan: 'pototan', bukidnon: 'malaybalay' } as const;
    const fixtures = ['munoz', 'ilagan', 'pototan', 'malaybalay'].map(slug =>
      MunicipalLandFixtureSchema.parse(JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8')))
    );
    const defaultPriorities: FarmerPriorities = {
      soilHealth: 80,
      waterResilience: 75,
      stableIncome: 70,
      lowInputCost: 65,
      lowLabor: 50,
      climateRisk: 75
    };
    for (const pilot of PILOT_LOCATIONS) {
      const slug = slugMap[pilot.id as keyof typeof slugMap];
      const rawFixture = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8')) as { climate?: ClimateData };
      const climate = rawFixture.climate ?? await fetchNasaPowerClimate(pilot.lat, pilot.lon);
      const bundledSoil = resolveBundledSoil(pilot.lat, pilot.lon)!;
      const land = buildSampleLandSummary(pilot.lat, pilot.lon, fixtures);
      const effectiveSoil = withTerrainEvidence(bundledSoil, land);
      expect(hasRequiredSoilInputs(effectiveSoil)).toBe(true);
      const plans = generateRotationRecommendations({
        allCrops: cropsData as Crop[],
        climate,
        soil: effectiveSoil,
        priorities: defaultPriorities,
        recentCropId: 'rice'
      });
      expect(plans.length).toBeGreaterThan(0);
      expect(plans.some(plan => plan.isBaseline)).toBe(true);
    }
  });
  it('keeps translation keys/placeholders aligned across soilModel, dataQuality, and provenance.methods and preserves sample fixtures', () => {
    for (const [enObj, filObj] of [
      [translations.en.soilModel, translations.fil.soilModel],
      [translations.en.dataQuality, translations.fil.dataQuality],
      [translations.en.provenance.methods, translations.fil.provenance.methods]
    ] as const) {
      expect(Object.keys(enObj).sort()).toEqual(Object.keys(filObj).sort());
      for (const [key, text] of Object.entries(enObj)) {
        const other = (filObj as Record<string, string>)[key];
        expect((text.match(/\{\w+\}/g) ?? []).sort()).toEqual((other.match(/\{\w+\}/g) ?? []).sort());
      }
    }
    const fixture = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8'));
    expect(fixture.soil.modelEvidence).toBeUndefined();
  });
});
