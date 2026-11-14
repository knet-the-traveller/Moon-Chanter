import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('2026 NASA & Partner Data Sources Audit', () => {
  it('docs/DATA_SOURCES.md attributes all mandatory 2026 Space Apps resources', () => {
    const dataSources = fs.readFileSync(path.resolve(__dirname, '../../docs/DATA_SOURCES.md'), 'utf-8');
    const requiredKeywords = [
      'NASA POWER',
      'MODIS',
      'VIIRS',
      'Landsat',
      'NASA SMAP',
      'NASA GPM',
      'NASA SRTM',
      'ECOSTRESS',
      'NLDAS',
      'FAO GAEZ',
      'Sentinel-2',
      'ERA5',
      'SoilGrids'
    ];
    for (const kw of requiredKeywords) {
      expect(dataSources).toContain(kw);
    }
  });

  it('README.md includes the expanded 2026 data sources summary table', () => {
    const readme = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf-8');
    expect(readme).toContain('SMAP');
    expect(readme).toContain('GPM');
    expect(readme).toContain('ECOSTRESS');
    expect(readme).toContain('Sentinel-2');
    expect(readme).toContain('ERA5');
  });
});
