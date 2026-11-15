import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../store/useAppStore', async importOriginal => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

beforeEach(()=>useAppStore.setState({...useAppStore.getInitialState(),useDemoAssumptions:false},true));
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
      expect(Math.abs(grid.center.lat - pilot.lat)).toBeLessThan(0.01);
      expect(Math.abs(grid.center.lon - pilot.lon)).toBeLessThan(0.01);
      expect(grid.assets).toHaveLength(36);
      expect(grid.nativeBounds[2] - grid.nativeBounds[0]).toBe(2250);
    }
  });
  it.each(data.grids.map(grid => [grid.id, grid] as const))('maps every cell to its own observations in %s', (_id, grid) => {
    for (let index = 0; index < 81; index++) {
      const point = gridCenter(grid, index);
      const soil = resolveBundledSoil(point.lat, point.lon)!;
      expect(soil.modelEvidence?.gridId).toBe(grid.id);
      expect(soil.modelEvidence?.cellIndex).toBe(index);
      expect(SoilModelEvidenceSchema.safeParse(soil.modelEvidence).success).toBe(true);
      for (const property of SOIL_PROPERTIES) {
        for (const depth of SOIL_DEPTHS) {
          const raw = grid.readings[property][depth].mean[index];
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
  it('converts all units and uses thickness weighting without combining uncertainty bounds', () => {
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
    expect(soil.drainage).toBeNull();
    expect(soil.organicMatter).toBe('unknown');
    expect(soil.phosphorusFixationRisk).toBeUndefined();
    expect(soil.slopePct).toBeUndefined();
    expect(soil.modelEvidence!.readings[0].depths['0-5cm'].q05).toBe(grid.readings.phh2o['0-5cm'].q05[index]! / 10);
    expect(hasRequiredSoilInputs(soil)).toBe(false);
    const complete = applyFarmerSoilOverride(soil, { drainage: 'moderate', organicMatter: 'medium' });
    expect(hasRequiredSoilInputs(complete)).toBe(true);
    expect(complete.provenance?.ph?.tier).toBe('bundled-model');
    expect(complete.provenance?.drainage?.tier).toBe('farmer');
  });
  it('retains missing properties and valid zeros without borrowing from neighboring cells', () => {
    const copy = structuredClone(data);
    const { grid, index, lat, lon } = validCell(copy.grids[0]);
    grid.readings.phh2o['0-5cm'].mean[index] = null;
    grid.readings.bdod['5-15cm'].mean[index] = null;
    for (const depth of SOIL_DEPTHS) {
      grid.readings.clay[depth].mean[index] = 0;
      grid.readings.soc[depth].mean[index] = 0;
    }
    const soil = resolveBundledSoil(lat, lon, copy)!;
    expect(soil.ph).toBeNull();
    expect(soil.bulkDensityGcm3).toBeUndefined();
    expect(soil.rawClayPercent).toBe(0);
    expect(soil.rawSocDgPerKg).toBe(0);
    expect(soilProvenance(soil).ph).toMatchObject({ tier: 'unavailable', productVersion: '2.0.0', isSample: false });
    expect(soilProvenance(soil).rawSocDgPerKg.tier).toBe('bundled-model');
  });
  it('keeps masked Muñoz/Malaybalay preset pixels unavailable', () => {
    for (const id of ['munoz', 'bukidnon']) {
      const grid = data.grids.find(grid => grid.id === id)!;
      expect(grid.readings.phh2o['0-5cm'].mean[40]).toBeNull();
      const soil = resolveBundledSoil(grid.center.lat, grid.center.lon)!;
      expect(soil.ph).toBeNull();
      expect(soil.isEstimate).toBe(false);
      expect(soil.modelEvidence?.cellIndex).toBe(40);
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
  it('resolves locally before API caches or network and relocates masked profiles to nearest valid cell', async () => {
    await CacheService.set(soilCacheKey(15.714, 120.906), { schemaVersion: 2, profile: { ph: 9 } });
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const soil = await fetchSoilGridsData(15.714, 120.906);
    expect(soil.modelEvidence?.gridId).toBe('munoz');
    expect(soil.modelEvidence?.relocatedFrom?.cellIndex).toBe(40);
    expect(soil.modelEvidence?.cellIndex).toBe(31);
    expect(soil.ph).toBe(6.4);
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
  it.each(['en', 'fil'] as const)('explains masked cells and offers separate drainage/organic-matter inputs in %s', language => {
    const soil = resolveBundledSoil(15.714, 120.906)!;
    useAppStore.setState({ soilData: soil, language });
    const html = renderToStaticMarkup(createElement(SoilCard));
    expect(html).toContain(getTranslation(language, 'soilModel.noPredictions'));
    expect(html).toContain(getTranslation(language, 'soilModel.drainagePrompt'));
    expect(html).toContain(getTranslation(language, 'soilModel.organicMatterPrompt'));
    expect(html).toContain(getTranslation(language, 'dataQuality.missingSoil'));
    useAppStore.getState().setSoilOverride({ drainage: 'moderate' });
    expect(useAppStore.getState().soilOverride).toMatchObject({ drainage: 'moderate' });
    expect(applyFarmerSoilOverride(soil, useAppStore.getState().soilOverride).ph).toBeNull();
  });
  it('keeps translation keys/placeholders aligned and the four immutable sample fixtures separate', () => {
    expect(Object.keys(translations.en.soilModel).sort()).toEqual(Object.keys(translations.fil.soilModel).sort());
    for (const [key, text] of Object.entries(translations.en.soilModel)) {
      const other = translations.fil.soilModel[key as keyof typeof translations.fil.soilModel];
      expect(text.match(/\{\w+\}/g)).toEqual(other.match(/\{\w+\}/g));
    }
    const fixture = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8'));
    expect(fixture.soil.modelEvidence).toBeUndefined();
  });
});
