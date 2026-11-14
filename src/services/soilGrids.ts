import type { SoilData, SoilTexture, DrainageClass, OrganicMatterLevel } from '../types';
import { LocalCacheService } from './cache';
import { getNearestSampleSlug } from './nasaPower';

export async function fetchSoilGridsData(lat: number, lon: number): Promise<SoilData> {
  const cacheKey = `soilgrids_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = LocalCacheService.get<SoilData>(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&property=clay&property=sand&property=silt&property=phh2o&property=soc&depth=0-5cm&depth=5-15cm&value=mean`;
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ISRIC SoilGrids HTTP ${response.status}`);
    }

    const json = await response.json();
    const layers = json?.properties?.layers;

    if (!Array.isArray(layers)) {
      throw new Error('Invalid SoilGrids payload');
    }

    const getLayerMean = (name: string): number => {
      const layer = layers.find((l: { name: string }) => l.name === name);
      if (!layer || !layer.depths || layer.depths.length === 0) return 0;
      const values = layer.depths.map((d: { values?: { mean?: number } }) => d.values?.mean).filter((v: number | undefined): v is number => v !== undefined && v !== null);
      if (values.length === 0) return 0;
      return values.reduce((a: number, b: number) => a + b, 0) / values.length;
    };

    const clayVal = getLayerMean('clay'); // g/kg
    const sandVal = getLayerMean('sand'); // g/kg
    const siltVal = getLayerMean('silt'); // g/kg
    const phVal = getLayerMean('phh2o'); // pH * 10
    const socVal = getLayerMean('soc'); // dg/kg

    const clayPct = Number((clayVal / 10).toFixed(1));
    const sandPct = Number((sandVal / 10).toFixed(1));
    const siltPct = Number((siltVal / 10).toFixed(1));
    const ph = phVal > 0 ? Number((phVal / 10).toFixed(1)) : 6.2;

    // Classify texture
    let texture: SoilTexture = 'loam';
    let drainage: DrainageClass = 'moderate';

    if (clayPct >= 38) {
      texture = 'clay';
      drainage = 'poor';
    } else if (clayPct >= 26) {
      texture = 'clay_loam';
      drainage = 'moderate';
    } else if (sandPct >= 55) {
      texture = 'sandy_loam';
      drainage = 'well';
    } else if (siltPct >= 50) {
      texture = 'silt_loam';
      drainage = 'moderate';
    } else {
      texture = 'loam';
      drainage = 'well';
    }

    // Classify organic matter (SOC)
    // soc in dg/kg: 100 dg/kg = 1.0% SOC
    let organicMatter: OrganicMatterLevel = 'medium';
    if (socVal >= 180) {
      organicMatter = 'high';
    } else if (socVal < 100) {
      organicMatter = 'low';
    }

    const soilResult: SoilData = {
      source: 'ISRIC SoilGrids v2.0 (Live Global Telemetry at 250m Resolution)',
      texture,
      drainage,
      organicMatter,
      ph,
      isEstimate: false,
      rawClayPercent: clayPct,
      rawSandPercent: sandPct,
      rawSocDgPerKg: socVal
    };

    LocalCacheService.set(cacheKey, soilResult);
    return soilResult;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('SoilGrids live query failed. Falling back to local pilot profile.', err);
    return await getFallbackSoil(lat, lon);
  }
}

async function getFallbackSoil(lat: number, lon: number): Promise<SoilData> {
  const sampleName = getNearestSampleSlug(lat, lon);
  try {
    const res = await fetch(`/sample-data/${sampleName}.json`);
    if (res.ok) {
      const data = await res.json();
      return {
        ...data.soil,
        isEstimate: true,
        source: `ISRIC SoilGrids Benchmark Profile (${data.location.name})`
      };
    }
  } catch {
    // fallback
  }

  return {
    source: 'ISRIC SoilGrids Regional Benchmark (Central Luzon Clay Loam)',
    texture: 'clay_loam',
    drainage: 'moderate',
    organicMatter: 'medium',
    ph: 6.3,
    isEstimate: true,
    rawClayPercent: 35.0,
    rawSandPercent: 30.0,
    rawSocDgPerKg: 140
  };
}
