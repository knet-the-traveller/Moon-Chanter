import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MunicipalLandFixtureSchema } from '../types/landFixture';

const slugs = ['munoz', 'ilagan', 'pototan', 'malaybalay'];
const legacyFieldHashes = {
  munoz: '40d21b7ce3a89d3c00c5ead0e83f0f19813aad34b4f8426c74a640069972424b',
  ilagan: '22ada5d11801237790d8d7363617f0998a8cec706afe155b6bb1149925235677',
  pototan: 'b37ae0297521bb62fd6fd930242b0d60c85765e08a3574d2719e5fb0c642bfd5',
  malaybalay: '06fcffa3b9d2b241e57ad778d6888b4acd310f978f8b1be0f89248aa6b1138c2'
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
    // Team fixture revision merged from main now includes all four soil/climate blocks.
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
