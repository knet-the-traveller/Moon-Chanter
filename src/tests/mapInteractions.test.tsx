import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPicker } from '../components/MapPicker';
import { useAppStore } from '../store/useAppStore';

// Exercise component event wiring with Leaflet/effect adapters; this does not replace browser QA.
const adapter = vi.hoisted(() => {
  const mapEvents = new Map<string, (event: unknown) => void>();
  const markerEvents = new Map<string, (event: unknown) => void>();
  const map = {
    on: vi.fn((name: string, handler: (event: unknown) => void) => mapEvents.set(name, handler)),
    remove: vi.fn(), removeLayer: vi.fn(), panTo: vi.fn(), setMaxZoom: vi.fn()
  };
  const marker = {
    addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(),
    openPopup: vi.fn().mockReturnThis(), setPopupContent: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(), getLatLng: vi.fn(),
    on: vi.fn((name: string, handler: (event: unknown) => void) => markerEvents.set(name, handler))
  };
  return {
    effects: [] as Array<() => unknown>, refs: [] as Array<{ current: unknown }>,
    map, marker, mapEvents, markerEvents, layer: { addTo: vi.fn().mockReturnThis() }
  };
});

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => unknown) => adapter.effects.push(effect),
  useRef: (current: unknown) => {
    const ref = { current };
    adapter.refs.push(ref);
    return ref;
  },
  useState: (initial: unknown) => [initial, vi.fn()]
}));
vi.mock('leaflet', () => ({ default: {
  map: () => adapter.map, marker: () => adapter.marker, tileLayer: () => adapter.layer,
  divIcon: () => ({}), control: { zoom: () => ({ addTo: vi.fn() }) }
} }));
vi.mock('../store/useAppStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

const initial = useAppStore.getInitialState();
beforeEach(() => {
  vi.clearAllMocks();
  adapter.effects.length = 0;
  adapter.refs.length = 0;
  adapter.mapEvents.clear();
  adapter.markerEvents.clear();
  useAppStore.setState({ ...initial, setCustomCoordinates: vi.fn().mockResolvedValue(undefined) }, true);
  vi.stubGlobal('document', {
    createElement: () => ({ textContent: '', append: vi.fn() }),
    createTextNode: (textContent: string) => ({ textContent })
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

function mountMap(): ReactNode {
  const tree = MapPicker({}) as ReactElement;
  adapter.refs[0].current = {};
  adapter.effects[0]();
  return tree;
}

function findButton(tree: ReactNode, label: string): ReactElement<{ onClick: () => void }> | undefined {
  let found: ReactElement<{ onClick: () => void }> | undefined;
  Children.forEach(tree, (node) => {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return;
    if (node.type === 'button' && node.props.children === label && node.props.onClick) {
      found = node as ReactElement<{ onClick: () => void }>;
      return;
    }
    found ??= findButton(node.props.children, label);
  });
  return found;
}

describe('map coordinate and imagery interactions', () => {
  it('moves the marker for precise coordinate edits smaller than the old tolerance', () => {
    const previous = initial.selectedLocation;
    const latitude = previous.lat + 0.00001;
    useAppStore.setState({ selectedLocation: { ...previous, lat: latitude } });
    mountMap();
    adapter.marker.getLatLng.mockReturnValue({ lat: previous.lat, lng: previous.lon });
    adapter.effects[1]();
    expect(adapter.marker.setLatLng).toHaveBeenCalledWith([latitude, previous.lon]);
  });

  it('normalizes clicks on a wrapped world before updating location and marker', () => {
    mountMap();
    const point = { lat: 12, lng: 190, wrap: vi.fn(() => ({ lat: 12, lng: -170 })) };
    adapter.mapEvents.get('click')?.({ latlng: point });
    expect(useAppStore.getState().setCustomCoordinates).toHaveBeenCalledWith(12, -170);
    expect(adapter.marker.setLatLng).toHaveBeenLastCalledWith([12, -170]);
  });

  it('normalizes a dragged marker before committing its coordinates', () => {
    mountMap();
    adapter.marker.getLatLng.mockReturnValue({ lat: 12, lng: 190, wrap: () => ({ lat: 12, lng: -170 }) });
    adapter.markerEvents.get('dragend')?.({ target: adapter.marker });
    expect(useAppStore.getState().setCustomCoordinates).toHaveBeenCalledWith(12, -170);
    expect(adapter.marker.setLatLng).toHaveBeenLastCalledWith([12, -170]);
  });

  it('restricts GIBS zoom and restores the normal map limit when switching back', () => {
    const tree = mountMap();
    const satellite = findButton(tree, 'NASA Satellite True Color');
    expect(satellite).toBeDefined();
    satellite?.props.onClick();
    expect(adapter.map.setMaxZoom).toHaveBeenLastCalledWith(9);
    const normal = findButton(tree, 'Standard Map');
    expect(normal).toBeDefined();
    normal?.props.onClick();
    expect(adapter.map.setMaxZoom).toHaveBeenLastCalledWith(18);
  });
});
