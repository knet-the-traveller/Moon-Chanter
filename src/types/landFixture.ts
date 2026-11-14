import { z } from 'zod';

export const CoordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180)
});

export const NdviMonthlySchema = z.array(z.number().finite().min(-1).max(1)).length(12);

export const NdviObservationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) =>
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date),
  value: z.number().finite().min(-1).max(1)
});

export const MetricProvenanceSchema = z.object({
  source: z.string().min(1),
  variable: z.string().min(1),
  spatialResolution: z.string().nullable(),
  dateRange: z.string().nullable(),
  isSample: z.boolean(),
  isSynthetic: z.boolean(),
  needsReview: z.boolean(),
  note: z.string()
});

export const RusleFactorsSchema = z.object({
  R: z.number().finite().nonnegative(),
  K: z.number().finite().nonnegative(),
  LS: z.number().finite().nonnegative(),
  P: z.number().finite().min(0).max(1),
  units: z.object({
    R: z.literal('MJ mm ha-1 h-1 yr-1'),
    K: z.literal('t ha h ha-1 MJ-1 mm-1'),
    LS: z.literal('dimensionless'),
    P: z.literal('dimensionless')
  })
});

export const MunicipalLandFixtureSchema = z.object({
  location: CoordinatesSchema.extend({
    id: z.string().min(1),
    name: z.string().min(1),
    province: z.string().min(1),
    elevationMeters: z.number().finite()
  }).passthrough(),
  land: z.object({
    slopePct: z.number().finite().nonnegative(),
    ndviMonthly: NdviMonthlySchema,
    annualNdvi: z.array(NdviObservationSchema).default([]),
    rusle: RusleFactorsSchema,
    landCover: z.string().optional(),
    meta: MetricProvenanceSchema.extend({
      isSample: z.literal(true),
      retrievedOn: z.string().nullable(),
      createdOn: z.string()
    })
  })
}).passthrough();

export type MunicipalLandFixture = z.infer<typeof MunicipalLandFixtureSchema>;
export type NdviObservation = z.infer<typeof NdviObservationSchema>;
export type RusleFactors = z.infer<typeof RusleFactorsSchema>;
