import type L from 'leaflet';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addPlaceLabels } from '../components/mapPlaceLabels';
import { PLACE_ATTRIBUTION } from '../services/mapLabels';

const adapter = vi.hoisted(() => ({
  group: { addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn(), remove: vi.fn() },
  marker: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: { html: { textContent: string } }) => options)
}));
vi.mock('leaflet', () => ({ default: {
  layerGroup: () => adapter.group, marker: adapter.marker, divIcon: adapter.divIcon
} }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('foreground label overlay lifecycle', () => {
  it('renders safe, noninteractive labels in the foreground, refreshes and cleans up', () => {
    vi.stubGlobal('document', { createElement: () => ({ setAttribute: vi.fn() }) });
    const map = {
      getCenter: () => ({ lng: 481 }), getSize: () => ({ x: 600, y: 400 }),
      getContainer: () => ({ parentElement: null }),
      latLngToContainerPoint: ([lat, lon]: [number, number]) => ({ x: (lon - 480) * 100 + 300, y: (lat - 15) * 50 + 200 }),
      attributionControl: { addAttribution: vi.fn(), removeAttribution: vi.fn() },
      on: vi.fn(), off: vi.fn()
    };
    const overlay = addPlaceLabels(map as unknown as L.Map);
    expect(overlay.available).toBe(true);
    expect(adapter.marker).toHaveBeenCalled();
    for (const call of adapter.marker.mock.calls as unknown as Array<[[number, number], L.MarkerOptions]>) {
      expect(Math.abs(call[0][1] - 481)).toBeLessThanOrEqual(180);
      expect(call[1]).toEqual(expect.objectContaining({ pane: 'satellite-labels', interactive: false, keyboard: false }));
    }
    for (const [icon] of adapter.divIcon.mock.calls) {
      expect(typeof icon.html.textContent).toBe('string');
      expect(Object.hasOwn(icon.html, 'innerHTML')).toBe(false);
    }
    const [events, refresh] = map.on.mock.calls[0] as [string, () => void];
    expect(events).toBe('moveend resize');
    refresh();
    expect(adapter.group.clearLayers).toHaveBeenCalledTimes(2);
    overlay.remove();
    expect(map.off).toHaveBeenCalledWith(events, refresh);
    expect(adapter.group.remove).toHaveBeenCalledOnce();
    expect(map.attributionControl.removeAttribution).toHaveBeenCalledWith(PLACE_ATTRIBUTION);
  });
});
