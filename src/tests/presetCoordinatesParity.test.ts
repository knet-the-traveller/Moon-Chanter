import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PILOT_LOCATIONS, PHILIPPINES_BOUNDS } from '../data/pilotLocations';
import { PILOT_CONFIG } from '../config/pilot';
import { resolveBundledSoil, isCellComplete } from '../services/bundledSoilGrids';
import { fetchSoilGridsData } from '../services/soilGrids';
import rawPackage from '../data/soilgrids/pilots-v1.json';
import { SoilGridsPackageSchema } from '../types/soilGridsPackage';

const packageData = SoilGridsPackageSchema.parse(rawPackage);

describe('Preset Coordinates Parity and Hardening', () => {
  it('agrees on coordinates across PILOT_LOCATIONS and municipal fixtures', () => {
    const slugMap: Record<string, string> = {
      munoz: 'munoz',
      ilagan: 'ilagan',
      pototan: 'pototan',
      bukidnon: 'malaybalay'
    };

    for (const pilot of PILOT_LOCATIONS) {
      const fixtureSlug = slugMap[pilot.id];
      const raw = JSON.parse(readFileSync(`public/sample-data/${fixtureSlug}.json`, 'utf8'));
      expect(raw.location.lat).toBeCloseTo(pilot.lat, 5);
      expect(raw.location.lon).toBeCloseTo(pilot.lon, 5);
    }
  });

  it('PILOT_CONFIG and PHILIPPINES_BOUNDS match Muñoz pilot location', () => {
    const munoz = PILOT_LOCATIONS.find((p) => p.id === 'munoz')!;
    expect(PILOT_CONFIG.location.lat).toBeCloseTo(munoz.lat, 5);
    expect(PILOT_CONFIG.location.lon).toBeCloseTo(munoz.lon, 5);
    expect(PHILIPPINES_BOUNDS.defaultCenter[0]).toBeCloseTo(munoz.lat, 5);
    expect(PHILIPPINES_BOUNDS.defaultCenter[1]).toBeCloseTo(munoz.lon, 5);
  });

  it('all four relocated preset default coordinates land on complete, non-null SoilGrids cells', () => {
    for (const pilot of PILOT_LOCATIONS) {
      const soil = resolveBundledSoil(pilot.lat, pilot.lon);
      expect(soil).not.toBeNull();
      expect(soil!.ph).not.toBeNull();
      expect(soil!.texture).not.toBeNull();
      expect(soil!.rawClayPercent).toBeDefined();
      expect(soil!.rawSandPercent).toBeDefined();
      expect(soil!.rawSocDgPerKg).toBeDefined();
      expect(soil!.bulkDensityGcm3).toBeDefined();

      const grid = packageData.grids.find((g) => g.id === pilot.id)!;
      const cellIdx = soil!.modelEvidence!.cellIndex;
      expect(isCellComplete(grid, cellIdx)).toBe(true);
    }
  });

  it('regression: querying original Muñoz poblacion coordinates (15.714, 120.906) does not deadlock', async () => {
    // 15.714, 120.906 is the urban poblacion cell (Cell 40) where SoilGrids has NoData.
    // fetchSoilGridsData must automatically relocate to nearest valid cell (Cell 31, ~0.35 km away).
    const soil = await fetchSoilGridsData(15.714, 120.906);

    expect(soil).toBeDefined();
    expect(soil.ph).toBe(6.4);
    expect(soil.texture).toBe('clay');
    expect(soil.rawClayPercent).toBe(38.1);
    expect(soil.modelEvidence?.cellIndex).toBe(31);
    expect(soil.modelEvidence?.relocatedFrom).toBeDefined();
    expect(soil.modelEvidence?.relocatedFrom?.originalLat).toBe(15.714);
    expect(soil.modelEvidence?.relocatedFrom?.originalLon).toBe(120.906);
    expect(soil.modelEvidence?.relocatedFrom?.cellIndex).toBe(40);
    expect(soil.modelEvidence?.relocatedFrom?.distanceKm).toBeLessThanOrEqual(0.5);
    expect(soil.modelEvidence?.relocatedFrom?.reason).toBe('nodata_cell');
    expect(soil.reviewNote).toContain('Default coordinates fell on an unmeasured cell');
  });

  it('regression: querying original Malaybalay poblacion coordinates (8.156, 125.127) does not deadlock', async () => {
    // 8.156, 125.127 is Cell 40 in bukidnon grid, which is NoData.
    const soil = await fetchSoilGridsData(8.156, 125.127);

    expect(soil).toBeDefined();
    expect(soil.ph).toBe(5.5);
    expect(soil.texture).toBe('clay');
    expect(soil.modelEvidence?.cellIndex).toBe(41);
    expect(soil.modelEvidence?.relocatedFrom).toBeDefined();
    expect(soil.modelEvidence?.relocatedFrom?.cellIndex).toBe(40);
  });
});
