// Keep these API/cache/reference checks independent of the packaged pilot grids.
vi.mock('../services/bundledSoilGrids', () => ({ resolveBundledSoil: () => null }));
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSoilGridsData,
  derivePhosphorusFixationRisk,
  applyFarmerSoilOverride
} from '../services/soilGrids';
import { LocalCacheService } from '../services/cache';
import type { SoilProfile } from '../types/contracts';

describe('SoilGrids Service & SoilProfile Extensions', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await LocalCacheService.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('derives phosphorusFixationRisk from soil pH thresholds (< 5.5 high, < 6.0 moderate, >= 6.0 low)', () => {
    expect(derivePhosphorusFixationRisk(4.7)).toBe('high');
    expect(derivePhosphorusFixationRisk(5.4)).toBe('high');
    expect(derivePhosphorusFixationRisk(5.5)).toBe('moderate');
    expect(derivePhosphorusFixationRisk(5.9)).toBe('moderate');
    expect(derivePhosphorusFixationRisk(6.2)).toBe('low');
  });

  it('parses live ISRIC SoilGrids bdod into bulkDensityGcm3 and derives phosphorusFixationRisk', async () => {
    const mockPayload = {
      properties: {
        layers: [
          { name: 'clay', depths: [{ label: '0-5cm', values: { mean: 420 } }, { label: '5-15cm', values: { mean: 420 } }] },
          { name: 'sand', depths: [{ label: '0-5cm', values: { mean: 220 } }, { label: '5-15cm', values: { mean: 220 } }] },
          { name: 'silt', depths: [{ label: '0-5cm', values: { mean: 360 } }, { label: '5-15cm', values: { mean: 360 } }] },
          { name: 'phh2o', depths: [{ label: '0-5cm', values: { mean: 53 } }, { label: '5-15cm', values: { mean: 53 } }] },
          { name: 'soc', depths: [{ label: '0-5cm', values: { mean: 120 } }, { label: '5-15cm', values: { mean: 120 } }] },
          { name: 'bdod', depths: [{ label: '0-5cm', values: { mean: 146 } }, { label: '5-15cm', values: { mean: 146 } }] } // 146 cg/cm3 = 1.46 g/cm3
        ]
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload
    });

    const profile: SoilProfile = await fetchSoilGridsData(15.714, 120.906);
    expect(profile.texture).toBe('clay');
    expect(profile.ph).toBe(5.3);
    expect(profile.bulkDensityGcm3).toBe(1.46);
    expect(profile.phosphorusFixationRisk).toBe('high');
    expect(profile.isEstimate).toBe(false);
  });

  it('flags lowland compaction (> 1.4 g/cm3) in Muñoz fallback and high P-fixation on Bukidnon/acid uplands', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

    // Muñoz lowland benchmark (15.714, 120.906)
    const munozProfile = await fetchSoilGridsData(15.714, 120.906);
    expect(munozProfile.isEstimate).toBe(true);
    expect(munozProfile.bulkDensityGcm3).toBeGreaterThan(1.4);
    expect(munozProfile.needsReview).toBe(true);
    expect(munozProfile.reviewNote).toMatch(/bulkDensityGcm3|penetrometer/i);

    await LocalCacheService.clear();

    // Malaybalay Bukidnon highland acid Ultisol (8.156, 125.127)
    const bukidnonProfile = await fetchSoilGridsData(8.156, 125.127);
    expect(bukidnonProfile.isEstimate).toBe(true);
    expect(bukidnonProfile.ph).toBeLessThan(5.5);
    expect(bukidnonProfile.phosphorusFixationRisk).toBe('high');
    expect(bukidnonProfile.needsReview).toBe(true);
  });

  it('keeps bulk density unavailable when live SoilGrids bdod is absent', async () => {
    const payloadWithoutBdod = {
      properties: {
        layers: [
          { name: 'clay', depths: [{ label: '0-5cm', values: { mean: 410 } }, { label: '5-15cm', values: { mean: 410 } }] },
          { name: 'sand', depths: [{ label: '0-5cm', values: { mean: 230 } }, { label: '5-15cm', values: { mean: 230 } }] },
          { name: 'silt', depths: [{ label: '0-5cm', values: { mean: 360 } }, { label: '5-15cm', values: { mean: 360 } }] },
          { name: 'phh2o', depths: [{ label: '0-5cm', values: { mean: 63 } }, { label: '5-15cm', values: { mean: 63 } }] },
          { name: 'soc', depths: [{ label: '0-5cm', values: { mean: 140 } }, { label: '5-15cm', values: { mean: 140 } }] }
        ]
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payloadWithoutBdod
    });

    const profile = await fetchSoilGridsData(15.801, 120.951);
    expect(profile.texture).toBe('clay');
    expect(profile.bulkDensityGcm3).toBeUndefined();
    expect(profile.needsReview).toBe(true);
    expect(profile.provenance?.bulkDensityGcm3?.tier).toBe('unavailable');
  });

  it('preserves 1-tap Farmer Soil Override while recalculating phosphorusFixationRisk and handling null overrides', () => {
    const baseSoil: SoilProfile = {
      source: 'ISRIC SoilGrids Benchmark Profile',
      texture: 'clay',
      drainage: 'poor',
      organicMatter: 'medium',
      ph: 5.1,
      isEstimate: true,
      bulkDensityGcm3: 1.44,
      phosphorusFixationRisk: 'high'
    };

    expect(applyFarmerSoilOverride(baseSoil, null)).toBe(baseSoil);

    const overridden = applyFarmerSoilOverride(baseSoil, {
      texture: 'clay_loam',
      drainage: 'moderate',
      ph: 6.4
    });

    expect(overridden.texture).toBe('clay_loam');
    expect(overridden.drainage).toBe('moderate');
    expect(overridden.ph).toBe(6.4);
    expect(overridden.bulkDensityGcm3).toBe(1.44);
    expect(overridden.phosphorusFixationRisk).toBe('low');
  });
});
