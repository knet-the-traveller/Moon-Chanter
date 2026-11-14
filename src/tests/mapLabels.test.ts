import { describe, expect, it } from 'vitest';
import { placeData, selectPlaceLabels } from '../services/mapLabels';
import { resolveMapLayer } from '../services/gibs';

const place = (id: number, population: number, name = 'Town') => ({ id, population, name, lat: 15, lon: 121 });

describe('foreground place-name selection', () => {
  it('validates the bundled licensed gazetteer and keeps unique source records', () => {
    expect(placeData.success).toBe(true);
    if (!placeData.success) return;
    expect(placeData.data.places.length).toBeGreaterThan(1000);
    expect(new Set(placeData.data.places.map((p) => p.id)).size).toBe(placeData.data.places.length);
    expect(placeData.data.places.some((p) => p.name === 'Manila')).toBe(true);
    expect(placeData.data.needsReview).toBe(true);
  });

  it('prioritizes larger places when labels overlap, regardless of input order', () => {
    const points = [place(1, 5000), place(2, 50000)];
    expect(selectPlaceLabels(points, { x: 600, y: 400 }, () => ({ x: 200, y: 100 }))
      .map((l) => l.place.id)).toEqual([2]);
  });

  it('keeps separated names and omits clipped or invalid projected positions', () => {
    const points = [place(1, 1), place(2, 2), place(3, 3), place(4, 4)];
    const positions = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 0, y: 100 }, { x: NaN, y: 100 }];
    const labels = selectPlaceLabels(points, { x: 600, y: 400 }, (p) => positions[p.id - 1]);
    expect(labels.map((l) => l.place.id)).toEqual([2, 1]);
  });

  it('bounds marker count and long label widths', () => {
    const points = Array.from({ length: 100 }, (_, i) => place(i + 1, 100 - i, 'W'.repeat(200)));
    const labels = selectPlaceLabels(points, { x: 50000, y: 500 }, (p) => ({ x: p.id * 300, y: 100 }));
    expect(labels).toHaveLength(70);
    expect(labels.every((l) => l.width === 280)).toBe(true);
  });

  it('does not place names behind the layer selector', () => {
    const labels = selectPlaceLabels([place(1, 50000)], { x: 600, y: 400 },
      () => ({ x: 450, y: 80 }), [{ left: 350, right: 600, top: 0, bottom: 160 }]);
    expect(labels).toEqual([]);
  });
});

describe('recent NASA True Color dates', () => {
  it.each([
    ['2026-11-15T00:01:00Z', '2026-11-14'],
    ['2027-01-01T23:59:00Z', '2026-12-31'],
    ['2024-03-01T01:00:00Z', '2024-02-29']
  ])('requests the completed UTC day for %s', (now, expected) => {
    const config = resolveMapLayer('gibsTrueColor', Date.parse(now));
    expect(config?.observationDate).toBe(expected);
    expect(config?.url).toContain(`/default/${expected}/`);
    expect(config?.url).not.toContain('2024-04-01');
  });

  it('keeps the NDVI default-time alias and safely rejects unknown layer keys', () => {
    expect(resolveMapLayer('gibsNdvi', 0)?.url).toContain('/default/default/');
    expect(resolveMapLayer('missing', 0)).toBeUndefined();
    expect(resolveMapLayer('__proto__', 0)).toBeUndefined();
  });
});
