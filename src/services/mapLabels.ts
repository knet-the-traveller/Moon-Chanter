import { z } from 'zod';
import gazetteer from '../data/philippinePlaces.json';

export const PlaceSchema = z.object({
  id: z.number().int().positive(), name: z.string().trim().min(1).max(200),
  lat: z.number().min(4).max(22), lon: z.number().min(115).max(128),
  population: z.number().int().nonnegative()
});
const GazetteerSchema = z.object({
  source: z.string(), sourceUrl: z.url(), license: z.literal('CC BY 4.0'),
  licenseUrl: z.url(), retrievedAt: z.iso.datetime({ offset: true }),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/), selection: z.string(),
  needsReview: z.literal(true), note: z.string(),
  places: z.array(PlaceSchema).min(1).max(5000)
});
export type MapPlace = z.infer<typeof PlaceSchema>;
export const placeData = GazetteerSchema.safeParse(gazetteer);
export const PLACE_ATTRIBUTION = 'Place names: <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0)';

export interface LabelPlacement { place: MapPlace; x: number; y: number; width: number }
export interface LabelObstacle { left: number; right: number; top: number; bottom: number }

// Screen-space collision filtering affects cartography only, never agricultural outputs.
export function selectPlaceLabels(places: readonly MapPlace[], size: { x: number; y: number },
  project: (place: MapPlace) => { x: number; y: number }, obstacles: readonly LabelObstacle[] = []): LabelPlacement[] {
  const selected: LabelPlacement[] = [];
  const ordered = [...places].sort((a, b) => b.population - a.population || a.id - b.id);
  for (const place of ordered) {
    const { x, y } = project(place);
    const width = Math.min(280, Math.max(80, Array.from(place.name).length * 10 + 28));
    if (!Number.isFinite(x) || !Number.isFinite(y) || x - width / 2 < 6 || x + width / 2 > size.x - 6 || y < 18 || y > size.y - 18) continue;
    if (obstacles.some((box) => x + width / 2 > box.left && x - width / 2 < box.right && y + 14 > box.top && y - 14 < box.bottom)) continue;
    if (selected.some((other) => Math.abs(x - other.x) < (width + other.width) / 2 + 8 && Math.abs(y - other.y) < 36)) continue;
    selected.push({ place, x, y, width });
    if (selected.length === 70) break;
  }
  return selected;
}
