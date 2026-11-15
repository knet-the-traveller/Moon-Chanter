import fs from 'node:fs';
import path from 'node:path';
import { MunicipalLandFixtureSchema } from '../src/types/landFixture.js';

interface CliArgs {
  municipality: string; // 'munoz' | 'ilagan' | 'pototan' | 'malaybalay' | 'all'
  sensors: string;      // 'smap' | 'power' | 'ecostress' | 'srtm' | 'all'
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let municipality = 'all';
  let sensors = 'all';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--municipality' && args[i + 1]) {
      municipality = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--sensors' && args[i + 1]) {
      sensors = args[i + 1].toLowerCase();
      i++;
    }
  }

  return { municipality, sensors };
}

function getEarthdataToken(): string | null {
  // Check process environment
  if (process.env.EARTHDATA_TOKEN) return process.env.EARTHDATA_TOKEN;
  if (process.env.NASA_EARTHDATA_TOKEN) return process.env.NASA_EARTHDATA_TOKEN;

  // Check local .env file securely without leaking or printing
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^(?:EARTHDATA_TOKEN|NASA_EARTHDATA_TOKEN)\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // ignore
    }
  }

  return null;
}

const MUNICIPAL_MAP: Record<string, { slug: string; presetId: string; name: string; lat: number; lon: number }> = {
  munoz: { slug: 'munoz', presetId: 'munoz', name: 'Science City of Muñoz', lat: 15.71715, lon: 120.90643 },
  ilagan: { slug: 'ilagan', presetId: 'ilagan', name: 'City of Ilagan', lat: 16.975, lon: 121.810 },
  pototan: { slug: 'pototan', presetId: 'pototan', name: 'Pototan', lat: 10.952, lon: 122.632 },
  malaybalay: { slug: 'malaybalay', presetId: 'bukidnon', name: 'Malaybalay City', lat: 8.15558, lon: 125.12834 }
};

interface SensorStatusRow {
  municipality: string;
  smap: string;
  extremeRain: string;
  ecostress: string;
  srtm: string;
}

async function main() {
  const { municipality, sensors } = parseArgs();
  const token = getEarthdataToken();
  const hasToken = Boolean(token && token.length > 0);

  const targetSlugs =
    municipality === 'all'
      ? ['munoz', 'ilagan', 'pototan', 'malaybalay']
      : [municipality];

  const summaryRows: SensorStatusRow[] = [];

  for (const slug of targetSlugs) {
    const config = MUNICIPAL_MAP[slug];
    if (!config) {
      console.warn(`Unknown municipality slug "${slug}". Skipping.`);
      continue;
    }

    const filePath = path.resolve(process.cwd(), `public/sample-data/${slug}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Fixture file not found: ${filePath}`);
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fixture = MunicipalLandFixtureSchema.parse(raw) as any;

    if (!fixture.sensors) {
      fixture.sensors = {};
    }

    // Default sensor definitions
    const defaultSensors = {
      smapSoilMoisture: {
        value: null,
        unit: 'm3/m3',
        period: null,
        baseline: null,
        source: 'NASA SMAP L3 Radiometer Global Daily 9 km (SPL3SMP_E v006)',
        retrievedAt: null,
        status: 'unavailable',
        reason: 'Requires Earthdata Bearer token; coarse 9 km spatial resolution requires technician disaggregation.'
      },
      extremeRainDays: {
        value: null,
        unit: 'days/year >= 50 mm',
        period: null,
        baseline: null,
        source: 'NASA POWER daily point (PRECTOTCORR >= 50 mm)',
        retrievedAt: null,
        status: 'unavailable',
        reason: 'Computed from 10-year daily series via scripts/build-municipal-fixtures.ts. Note: coarse 0.5 deg grid understates convective point-level rain extremes.'
      },
      ecostressEsi: {
        value: null,
        unit: 'ESI z-score',
        period: null,
        baseline: null,
        source: 'ECOSTRESS Evaporative Stress Index PT-JPL 70 m (ECO4ESI v002)',
        retrievedAt: null,
        status: 'unavailable',
        reason: 'Requires Earthdata AppEEARS token; orbital revisit gaps over Philippines during monsoon cloud cover.'
      },
      srtmSlope: {
        value: null,
        unit: '%',
        period: null,
        baseline: null,
        source: 'NASA SRTMGL1 v003 30 m',
        retrievedAt: null,
        status: 'unavailable',
        reason: 'Requires DEM tile raster analysis via scripts/build-municipal-fixtures.ts.'
      }
    };

    fixture.sensors = {
      ...defaultSensors,
      ...fixture.sensors
    };

    // Process POWER / extremeRainDays
    if (sensors === 'all' || sensors === 'power') {
      if (slug === 'munoz') {
        const samplePath = path.resolve(process.cwd(), 'public/sample-data/nasa-power-pilot.json');
        if (fs.existsSync(samplePath)) {
          const powerRaw = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
          const precipObj = powerRaw?.properties?.parameter?.PRECTOTCORR ?? {};
          const precipValues = Object.values(precipObj) as number[];
          const heavyRainDays = precipValues.filter((p) => p !== null && p >= 50.0).length;
          const yearsCount = Math.max(1, Math.round(precipValues.length / 365.25));
          const annualHeavyRainDays = Number((heavyRainDays / yearsCount).toFixed(1));

          fixture.sensors.extremeRainDays = {
            value: annualHeavyRainDays,
            unit: 'days/year >= 50 mm',
            period: '2014-01-01 to 2023-12-31',
            baseline: annualHeavyRainDays,
            source: 'NASA POWER daily point (PRECTOTCORR >= 50 mm)',
            retrievedAt: new Date().toISOString(),
            status: 'measured',
            reason: 'Computed from 10-year daily series via scripts/build-municipal-fixtures.ts. Note: coarse 0.5 deg grid understates convective point-level rain extremes.'
          };
        }
      }
    }

    // Process SMAP, ECOSTRESS, SRTM
    // Without live external token or when remote endpoints are unreachable, they stay unavailable
    if (!hasToken) {
      if (sensors === 'all' || sensors === 'smap') {
        fixture.sensors.smapSoilMoisture.status = 'unavailable';
      }
      if (sensors === 'all' || sensors === 'ecostress') {
        fixture.sensors.ecostressEsi.status = 'unavailable';
      }
      if (sensors === 'all' || sensors === 'srtm') {
        fixture.sensors.srtmSlope.status = 'unavailable';
      }
    }

    // Write back updated fixture
    fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');

    summaryRows.push({
      municipality: slug,
      smap: fixture.sensors.smapSoilMoisture.status,
      extremeRain: fixture.sensors.extremeRainDays.status,
      ecostress: fixture.sensors.ecostressEsi.status,
      srtm: fixture.sensors.srtmSlope.status
    });
  }

  // Print Summary Table
  console.log('='.repeat(78));
  console.log(' FIELDSHIFT MULTI-SENSOR FIXTURE BUILD SUMMARY');
  console.log(` Earthdata Token Present: ${hasToken ? 'YES (Redacted)' : 'NO'}`);
  console.log('='.repeat(78));

  console.log(
    'Municipality'.padEnd(16) +
    'SMAP Soil Moist'.padEnd(18) +
    'Extreme Rain'.padEnd(16) +
    'ECOSTRESS'.padEnd(16) +
    'SRTM Slope'
  );
  console.log('-'.repeat(78));

  for (const row of summaryRows) {
    console.log(
      row.municipality.padEnd(16) +
      row.smap.padEnd(18) +
      row.extremeRain.padEnd(16) +
      row.ecostress.padEnd(16) +
      row.srtm
    );
  }
  console.log('-'.repeat(78));
  console.log('✓ Multi-sensor municipal fixtures updated successfully.\n');
}

main().catch((err) => {
  console.error('Fixture build error:', err);
  process.exit(1);
});
