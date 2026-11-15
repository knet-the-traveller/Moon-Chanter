import { readFileSync } from 'node:fs';
import { SoilGridsPackageSchema } from '../../src/types/soilGridsPackage.ts';

const input: unknown = JSON.parse(readFileSync(new URL('../../src/data/soilgrids/pilots-v1.json', import.meta.url), 'utf8'));
const data = SoilGridsPackageSchema.parse(input);
for (const grid of data.grids) {
  const valid = grid.readings.phh2o['0-5cm'].mean.filter(value => value !== null).length;
  console.log(`${grid.id}: ${valid}/81 available top-depth pH predictions; 36 source rasters`);
}
console.log(`PASS: ${data.id}; ${data.grids.length} grids; schema, units, depths, quantiles, coverage and source metadata`);
