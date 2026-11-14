import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MunicipalLandFixtureSchema } from '../types/landFixture';

const slugs = ['munoz', 'ilagan', 'pototan', 'malaybalay'];

describe('municipal land fixtures', () => {
  it.each(slugs)('validates %s and discloses synthetic data', (slug) => {
    const raw: unknown = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw);
    expect(fixture.land.ndviMonthly).toHaveLength(12);
    expect(fixture.land.meta).toMatchObject({ isSample: true, isSynthetic: true, needsReview: true, retrievedOn: null });
    expect(fixture.land.meta.note).toContain('Verify');
  });

  it('rejects invalid NDVI, units, and geographic coordinates', () => {
    const raw: unknown = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, location: { ...fixture.location, lat: 91 } }).success).toBe(false);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, land: { ...fixture.land, ndviMonthly: [2] } }).success).toBe(false);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, land: { ...fixture.land, rusle: { ...fixture.land.rusle, units: {} } } }).success).toBe(false);
  });
});
