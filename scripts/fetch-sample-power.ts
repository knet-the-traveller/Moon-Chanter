import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PILOT_CONFIG } from '../src/config/pilot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchRealSamplePower() {
  const { lat, lon } = PILOT_CONFIG.location;
  const { startApiFormat, endApiFormat } = PILOT_CONFIG.period;
  const params = 'T2M,T2M_MAX,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN';
  const url = `${PILOT_CONFIG.api.baseUrl}?parameters=${params}&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${startApiFormat}&end=${endApiFormat}&format=JSON`;

  console.log(`[fetch-sample-power] Fetching real daily series from NASA POWER API...`);
  console.log(`[fetch-sample-power] URL: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`NASA POWER API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const parameters = json?.properties?.parameter;

    if (!parameters || !parameters.T2M || !parameters.PRECTOTCORR) {
      throw new Error('Unexpected NASA POWER JSON response structure (missing properties.parameter)');
    }

    const dateCount = Object.keys(parameters.T2M).length;
    console.log(`[fetch-sample-power] Successfully fetched ${dateCount} daily records.`);

    const targetDir = path.resolve(__dirname, '../public/sample-data');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFile = path.join(targetDir, 'nasa-power-pilot.json');
    fs.writeFileSync(targetFile, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`[fetch-sample-power] Real NASA POWER payload saved to: ${targetFile}`);
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fetch-sample-power] Failed to fetch real sample: ${msg}`);
    process.exit(1);
  }
}

fetchRealSamplePower();
