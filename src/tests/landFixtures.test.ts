import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MunicipalLandFixtureSchema } from '../types/landFixture';

const slugs = ['munoz', 'ilagan', 'pototan', 'malaybalay'];
const legacyFieldHashes = {
  munoz: '2e303b9a99e09a2c4f6189aa00fe04d606eb879e4b1451d149fdd6c980947513',
  ilagan: '418b98734821d1e348ae54ee428d58898752a6b44006186906c2df714ddea413',
  pototan: '3e3d394f6cb93df3a60787cc0f8734e32ef55311a60c75a43f7f3d6b42147cee',
  malaybalay: '94cc7dd34e4587c9ea5a31afd0dda41d2fda5cfad39d6f048c70ee6f74aeeb4c'
} as const;

describe('municipal land fixtures', () => {
  it.each(slugs)('validates %s and discloses synthetic data', (slug) => {
    const raw: unknown = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw);
    expect(fixture.land.ndviMonthly).toHaveLength(12);
    expect(fixture.land.meta).toMatchObject({ isSample: true, isSynthetic: true, needsReview: true, retrievedOn: null });
    expect(fixture.land.meta.note).toContain('Verify');
  });

  it.each(Object.entries(legacyFieldHashes))('preserves legacy fields in %s', (slug, hash) => {
    const raw: unknown = JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'));
    MunicipalLandFixtureSchema.parse(raw);
    const rawFields = raw as Record<string, unknown>;
    if (slug === 'malaybalay') {
      // This fixture originally has location/land only; preserve absence too.
      expect(Object.hasOwn(rawFields, 'climate')).toBe(false);
      expect(Object.hasOwn(rawFields, 'soil')).toBe(false);
    }
    const legacyFields = {
      location: rawFields.location,
      climate: rawFields.climate,
      soil: rawFields.soil
    };
    expect(createHash('sha256').update(JSON.stringify(legacyFields)).digest('hex')).toBe(hash);
  });

  it('rejects invalid NDVI, units, and geographic coordinates', () => {
    const raw: unknown = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, location: { ...fixture.location, lat: 91 } }).success).toBe(false);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, land: { ...fixture.land, ndviMonthly: [2] } }).success).toBe(false);
    expect(MunicipalLandFixtureSchema.safeParse({ ...fixture, land: { ...fixture.land, rusle: { ...fixture.land.rusle, units: {} } } }).success).toBe(false);
  });
});
