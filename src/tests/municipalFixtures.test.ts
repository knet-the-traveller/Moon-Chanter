import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MunicipalLandFixtureSchema } from '../types/landFixture';
import { resolveBundledSoil } from '../services/bundledSoilGrids';
import { PILOT_LOCATIONS } from '../data/pilotLocations';

const slugs = ['munoz', 'ilagan', 'pototan', 'malaybalay'] as const;

describe('Municipal Multi-Sensor Fixtures & Provenance Integrity', () => {
  it.each(slugs)('validates schema, sensor structure, and honesty for %s', (slug) => {
    const raw: unknown = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw);

    // Land validations
    expect(fixture.land.ndviMonthly).toHaveLength(12);
    expect(fixture.land.landCoverVerified).toBe(false);

    // Multi-sensor validations
    expect(fixture.sensors).toBeDefined();
    const sensors = fixture.sensors!;

    expect(sensors.smapSoilMoisture).toBeDefined();
    expect(sensors.extremeRainDays).toBeDefined();
    expect(sensors.ecostressEsi).toBeDefined();
    expect(sensors.srtmSlope).toBeDefined();

    // Verify SMAP is SPL3SMP_E 9 km
    expect(sensors.smapSoilMoisture?.source).toContain('SPL3SMP_E');

    // Sensor status checks
    const sensorEntries = Object.values(sensors);
    for (const sensor of sensorEntries) {
      if (!sensor) continue;
      if (sensor.status === 'measured') {
        expect(sensor.value).not.toBeNull();
        expect(sensor.source).toBeTruthy();
        expect(sensor.retrievedAt).toBeTruthy();
      } else if (sensor.status === 'unavailable') {
        expect(sensor.value).toBeNull();
        expect(sensor.reason).toBeTruthy();
      }
    }
  });

  it('verifies default coordinates for all 4 presets resolve to non-null SoilGrids cells', () => {
    for (const loc of PILOT_LOCATIONS) {
      const soil = resolveBundledSoil(loc.lat, loc.lon);
      expect(soil).not.toBeNull();
      expect(soil?.ph).not.toBeNull();
      expect(soil?.ph).toBeGreaterThan(0);
      expect(soil?.texture).not.toBeNull();
      expect(soil?.rawClayPercent).toBeGreaterThan(0);
      expect(soil?.rawSandPercent).toBeGreaterThan(0);
      expect(soil?.rawSocDgPerKg).toBeGreaterThan(0);
    }
  });

  it('ensures Malaybalay has unmerged SoilGrids and team baselines blocks', () => {
    const raw = JSON.parse(readFileSync('public/sample-data/malaybalay.json', 'utf8')) as Record<string, unknown>;

    // SoilGrids block
    expect(raw.soil).toBeDefined();
    const soil = raw.soil as Record<string, unknown>;
    expect(soil.source).toContain('SoilGrids');
    expect(soil.ph).toBe(5.5); // Relocated cell 41 ISRIC reading

    // Team baselines block (strictly separate)
    expect(raw.teamBaselines).toBeDefined();
    const teamBaselines = raw.teamBaselines as Record<string, any>;
    expect(teamBaselines.soilPh).toBeDefined();
    expect(teamBaselines.soilPh.min).toBe(4.5);
    expect(teamBaselines.soilPh.max).toBe(4.8);
    expect(teamBaselines.soilPh.provenance).toBe('team-provided');
    expect(teamBaselines.soilPh.needsReview).toBe(true);

    expect(teamBaselines.phosphorusFixation).toBeDefined();
    expect(teamBaselines.phosphorusFixation.min).toBe(104);
    expect(teamBaselines.phosphorusFixation.max).toBe(170);

    expect(teamBaselines.slopePct.min).toBeGreaterThanOrEqual(18);
    expect(teamBaselines.rusleErosionTonsHaYr.min).toBe(246.5);
    expect(teamBaselines.rusleErosionTonsHaYr.max).toBe(363.0);
  });
});
