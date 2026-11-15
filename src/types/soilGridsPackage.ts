import { z } from 'zod';

export const SOIL_PROPERTIES = ['phh2o', 'clay', 'sand', 'silt', 'soc', 'bdod'] as const;
export const SOIL_DEPTHS = ['0-5cm', '5-15cm'] as const;
export const SOIL_STATISTICS = ['mean', 'q05', 'q95'] as const;
export type SoilProperty = typeof SOIL_PROPERTIES[number];
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const sourceUrl = z.url().refine(url => url.startsWith('https://files.isric.org/soilgrids/latest/data/'));
const values = (min: number, max: number, positive = false) => z.array(
  (positive ? z.number().int().gt(min) : z.number().int().min(min)).max(max).nullable()
).length(81);
const propertyReadings = (min: number, max: number, positive = false) => {
  const array = values(min, max, positive);
  const statistics = z.object({ mean: array, q05: array, q95: array }).strict().superRefine((data, context) => {
    data.q05.forEach((low, index) => {
      const high = data.q95[index];
      if (low !== null && high !== null && low > high) context.addIssue({ code: 'custom', message: 'Quantiles reversed' });
    });
  });
  return z.object({ '0-5cm': statistics, '5-15cm': statistics }).strict();
};
const gridSchema = z.object({
  id: z.enum(['munoz', 'ilagan', 'pototan', 'bukidnon']), name: z.string().min(1),
  center: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).strict(),
  rows: z.literal(9), cols: z.literal(9), nativeBounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  nodes: z.array(position).length(100),
  readings: z.object({
    phh2o: propertyReadings(0, 140, true), clay: propertyReadings(0, 1000),
    sand: propertyReadings(0, 1000), silt: propertyReadings(0, 1000),
    soc: propertyReadings(0, 10000), bdod: propertyReadings(0, 1000, true)
  }).strict(),
  assets: z.array(z.object({
    property: z.enum(SOIL_PROPERTIES), depth: z.enum(SOIL_DEPTHS), statistic: z.enum(SOIL_STATISTICS),
    url: sourceUrl, vrtUrl: sourceUrl, vrtSha256: checksum, sha256: checksum,
    retrievedAt: timestamp, archivePath: z.string().regex(/^[a-z0-9._-]+\.tif$/i)
  }).strict()).length(36)
}).strict().superRefine((grid, context) => {
  const [left, bottom, right, top] = grid.nativeBounds;
  const slots = new Set(grid.assets.map(asset => `${asset.property}:${asset.depth}:${asset.statistic}`));
  if (right - left !== 2250 || top - bottom !== 2250 || slots.size !== 36) {
    context.addIssue({ code: 'custom', message: 'Invalid native extent or duplicate/missing assets' });
  }
  grid.nodes.forEach(([lon, lat], index) => {
    const row = Math.floor(index / 10), col = index % 10;
    // Reject malformed/huge coverage. Every node must belong to this small grid;
    // rows run north-to-south, columns west-to-east in these Philippine subsets.
    if (Math.abs(lon - grid.center.lon) > 0.03 || Math.abs(lat - grid.center.lat) > 0.03
      || (col > 0 && lon <= grid.nodes[index - 1][0])
      || (row > 0 && lat >= grid.nodes[index - 10][1])) {
      context.addIssue({ code: 'custom', message: 'Invalid geographic grid geometry' });
    }
  });
});

const units = (mappedUnit: string, divisor: number, unit: string) => z.object({
  mappedUnit: z.literal(mappedUnit), divisor: z.literal(divisor), unit: z.literal(unit)
}).strict();
export const SoilGridsPackageSchema = z.object({
  schemaVersion: z.literal(1), id: z.literal('soilgrids-pilots-v1'), productVersion: z.literal('2.0.0'),
  sourceUrl, citation: z.literal('https://doi.org/10.5194/soil-7-217-2021'),
  license: z.literal('CC-BY-4.0'), licenseUrl: z.literal('https://creativecommons.org/licenses/by/4.0/'),
  attribution: z.string().min(1), observationPeriod: z.null(), retrievedAt: timestamp,
  processingVersion: z.literal('fieldshift-soilgrids-1'),
  crs: z.literal('+proj=igh +datum=WGS84 +units=m +no_defs'), resolutionM: z.literal(250), nodata: z.literal(-32768),
  properties: z.object({
    phh2o: units('pH x 10', 10, 'pH'), clay: units('g/kg', 10, '%'), sand: units('g/kg', 10, '%'),
    silt: units('g/kg', 10, '%'), soc: units('dg/kg', 100, '% SOC'), bdod: units('cg/cm3', 100, 'g/cm3')
  }).strict(), depths: z.tuple([z.literal('0-5cm'), z.literal('5-15cm')]), grids: z.array(gridSchema).length(4)
}).strict().superRefine((data, context) => {
  if (new Set(data.grids.map(grid => grid.id)).size !== 4) context.addIssue({ code: 'custom', message: 'Duplicate pilot grid' });
  if (data.grids.some(grid => grid.assets.some(asset => asset.retrievedAt > data.retrievedAt))) {
    context.addIssue({ code: 'custom', message: 'Asset acquired after package timestamp' });
  }
});
export type SoilGridsPackage = z.infer<typeof SoilGridsPackageSchema>;

const interval = z.object({ mean: z.number().nullable(), q05: z.number().nullable(), q95: z.number().nullable() });

export const RelocatedFromSchema = z.object({
  originalLat: z.number().min(-90).max(90),
  originalLon: z.number().min(-180).max(180),
  distanceKm: z.number().nonnegative(),
  cellIndex: z.number().int().min(0).max(80),
  reason: z.literal('nodata_cell')
}).strict();
export type RelocatedFrom = z.infer<typeof RelocatedFromSchema>;

export const SoilModelEvidenceSchema = z.object({
  packageId: z.literal('soilgrids-pilots-v1'), gridId: z.string(), gridName: z.string(),
  cellIndex: z.number().int().min(0).max(80), footprint: z.array(position).length(4),
  retrievedAt: timestamp, license: z.literal('CC-BY-4.0'),
  readings: z.array(z.object({ property: z.enum(SOIL_PROPERTIES), unit: z.string(),
    depths: z.object({ '0-5cm': interval, '5-15cm': interval }) })).length(6),
  relocatedFrom: RelocatedFromSchema.optional()
}).strict();
export type SoilModelEvidence = z.infer<typeof SoilModelEvidenceSchema>;
