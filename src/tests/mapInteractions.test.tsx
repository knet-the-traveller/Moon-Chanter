import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPicker } from '../components/MapPicker';
import { useAppStore } from '../store/useAppStore';
import { GIBS_SATELLITE_BASE, MAP_LAYERS } from '../services/gibs';
import { getTranslation } from '../i18n';

// Exercise component event wiring with Leaflet/effect adapters; this does not replace browser QA.
const adapter = vi.hoisted(() => {
  const mapEvents = new Map<string, (event: unknown) => void>();
  const markerEvents = new Map<string, (event: unknown) => void>();
  const makeLayer = () => {
    const events = new Map<string, () => void>();
    return {
      events, addTo: vi.fn().mockReturnThis(), setOpacity: vi.fn().mockReturnThis(),
      on: vi.fn((name: string, handler: () => void) => events.set(name, handler))
    };
  };
  const layers: Array<ReturnType<typeof makeLayer>> = [];
  const labels: Array<{ available: boolean; remove: ReturnType<typeof vi.fn> }> = [];
  const map = {
    on: vi.fn((name: string, handler: (event: unknown) => void) => mapEvents.set(name, handler)),
    remove: vi.fn(), removeLayer: vi.fn(), panTo: vi.fn(), setMaxZoom: vi.fn(), createPane: vi.fn()
  };
  const marker = {
    addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(),
    openPopup: vi.fn().mockReturnThis(), setPopupContent: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(), getLatLng: vi.fn(),
    on: vi.fn((name: string, handler: (event: unknown) => void) => markerEvents.set(name, handler))
  };
  return {
    effects: [] as Array<() => unknown>, refs: [] as Array<{ current: unknown }>,
    states: [] as Array<{ value: unknown; set: ReturnType<typeof vi.fn> }>,
    refCursor: 0, stateCursor: 0,
    map, marker, mapEvents, markerEvents, layers, labels, labelsAvailable: true,
    addPlaceLabels: vi.fn(() => {
      const overlay = { available: adapter.labelsAvailable, remove: vi.fn() };
      labels.push(overlay);
      return overlay;
    }),
    tileLayer: vi.fn(() => {
      const layer = makeLayer();
      layers.push(layer);
      return layer;
    })
  };
});

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => unknown) => adapter.effects.push(effect),
  useRef: (current: unknown) => {
    const index = adapter.refCursor++;
    adapter.refs[index] ??= { current };
    return adapter.refs[index];
  },
  useState: (initial: unknown) => {
    const index = adapter.stateCursor++;
    adapter.states[index] ??= {
      value: initial,
      set: vi.fn((value: unknown) => { adapter.states[index].value = value; })
    };
    return [adapter.states[index].value, adapter.states[index].set];
  }
}));
vi.mock('leaflet', () => ({ default: {
  map: () => adapter.map, marker: () => adapter.marker, tileLayer: adapter.tileLayer,
  divIcon: () => ({}), control: { zoom: () => ({ addTo: vi.fn() }) }
} }));
vi.mock('../components/mapPlaceLabels', () => ({ addPlaceLabels: adapter.addPlaceLabels }));
vi.mock('../store/useAppStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});

const initial = useAppStore.getInitialState();
beforeEach(() => {
  vi.clearAllMocks();
  adapter.effects.length = 0;
  adapter.refs.length = 0;
  adapter.states.length = 0;
  adapter.layers.length = 0;
  adapter.labels.length = 0;
  adapter.labelsAvailable = true;
  adapter.mapEvents.clear();
  adapter.markerEvents.clear();
  useAppStore.setState({ ...initial, setCustomCoordinates: vi.fn().mockResolvedValue(undefined) }, true);
  vi.stubGlobal('document', {
    createElement: () => ({ textContent: '', append: vi.fn() }),
    createTextNode: (textContent: string) => ({ textContent })
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderMap(): ReactNode {
  adapter.refCursor = 0;
  adapter.stateCursor = 0;
  adapter.effects.length = 0;
  return MapPicker({}) as ReactElement;
}

function mountMap(): ReactNode {
  const tree = renderMap();
  adapter.refs[0].current = {};
  adapter.effects[0]();
  return tree;
}

function findAlert(tree: ReactNode): ReactElement<{ children?: ReactNode }> | undefined {
  let found: ReactElement<{ children?: ReactNode }> | undefined;
  Children.forEach(tree, (node) => {
    if (!isValidElement<{ children?: ReactNode; role?: string }>(node)) return;
    if (node.props.role === 'alert') found = node;
    else found ??= findAlert(node.props.children);
  });
  return found;
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
    expect(adapter.map.setMaxZoom).toHaveBeenLastCalledWith(13);
    const normal = findButton(tree, 'Standard Map');
    expect(normal).toBeDefined();
    normal?.props.onClick();
    expect(adapter.map.setMaxZoom).toHaveBeenLastCalledWith(18);
  });

  it('requests the published latest-time NDVI URL without removing the base map', () => {
    const tree = mountMap();
    findButton(tree, 'NASA Satellite Greenness (NDVI)')?.props.onClick();
    expect(adapter.tileLayer).toHaveBeenNthCalledWith(3,
      expect.stringContaining('/MODIS_Terra_NDVI_8Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png'),
      expect.objectContaining({ maxZoom: 13, maxNativeZoom: 9, opacity: 1 })
    );
    expect(adapter.map.createPane).toHaveBeenCalledWith('satellite-labels');
    expect(adapter.tileLayer).toHaveBeenNthCalledWith(2, GIBS_SATELLITE_BASE.url,
      expect.objectContaining({ maxNativeZoom: 8 }));
    expect(adapter.addPlaceLabels).toHaveBeenCalledWith(adapter.map);
    expect(adapter.layers[0].setOpacity).toHaveBeenLastCalledWith(0);
    expect(adapter.map.removeLayer).not.toHaveBeenCalled();
    findButton(tree, 'Standard Map')?.props.onClick();
    expect(adapter.map.removeLayer).toHaveBeenCalledTimes(2);
    expect(adapter.map.removeLayer).toHaveBeenCalledWith(adapter.layers[1]);
    expect(adapter.map.removeLayer).toHaveBeenCalledWith(adapter.layers[2]);
    expect(adapter.map.removeLayer).not.toHaveBeenCalledWith(adapter.layers[0]);
    expect(adapter.labels[0].remove).toHaveBeenCalledOnce();
    expect(adapter.layers[0].setOpacity).toHaveBeenLastCalledWith(1);
    expect(adapter.tileLayer).toHaveBeenCalledTimes(3);
  });

  it('reports a failed satellite tile and retries only the overlay', () => {
    findButton(mountMap(), 'NASA Satellite Greenness (NDVI)')?.props.onClick();
    const failedLayer = adapter.layers[2];
    failedLayer.events.get('tileerror')?.();
    const errorTree = renderMap();
    expect(findAlert(errorTree)).toBeDefined();
    const retry = findButton(errorTree, 'Retry satellite imagery');
    expect(retry).toBeDefined();
    retry?.props.onClick();
    expect(adapter.map.removeLayer).toHaveBeenCalledTimes(2);
    expect(adapter.map.removeLayer).toHaveBeenCalledWith(failedLayer);
    expect(adapter.layers).toHaveLength(5);
    expect(adapter.layers[3].addTo).toHaveBeenCalledWith(adapter.map);
    expect(adapter.layers[4].addTo).toHaveBeenCalledWith(adapter.map);
    expect(findAlert(renderMap())).toBeUndefined();
    expect(adapter.tileLayer).toHaveBeenNthCalledWith(5, MAP_LAYERS.gibsNdvi.url, expect.any(Object));
  });

  it('ignores late errors from replaced imagery and after unmount', () => {
    const tree = renderMap();
    adapter.refs[0].current = {};
    const cleanup = adapter.effects[0]() as () => void;
    findButton(tree, 'NASA Satellite Greenness (NDVI)')?.props.onClick();
    const ndvi = adapter.layers[2];
    findButton(tree, 'NASA Satellite True Color')?.props.onClick();
    ndvi.events.get('tileerror')?.();
    adapter.layers[1].events.get('tileerror')?.();
    expect(findAlert(renderMap())).toBeUndefined();
    const trueColor = adapter.layers[4];
    cleanup();
    trueColor.events.get('tileerror')?.();
    adapter.layers[3].events.get('tileerror')?.();
    expect(findAlert(renderMap())).toBeUndefined();
  });

  it.each(['en', 'fil'] as const)('reports invalid bundled labels independently in %s', (language) => {
    adapter.labelsAvailable = false;
    useAppStore.setState({ language });
    findButton(mountMap(), getTranslation(language, 'map.layerGibsNdvi'))?.props.onClick();
    const errorTree = renderMap();
    expect(findAlert(errorTree)?.props.children).toBe(getTranslation(language, 'map.labelsUnavailable'));
    adapter.labelsAvailable = true;
    findButton(errorTree, getTranslation(language, 'map.retryImagery'))?.props.onClick();
    expect(findAlert(renderMap())).toBeUndefined();
    expect(adapter.layers).toHaveLength(5);
  });

  it('restores the standard base if the clean NASA background fails', () => {
    findButton(mountMap(), 'NASA Satellite Greenness (NDVI)')?.props.onClick();
    adapter.layers[1].events.get('tileerror')?.();
    expect(adapter.layers[0].setOpacity).toHaveBeenLastCalledWith(1);
    expect(findAlert(renderMap())).toBeDefined();
  });

  it('uses the requested recent UTC date in both the True Color URL and legend', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-15T00:15:00Z'));
    findButton(mountMap(), 'NASA Satellite True Color')?.props.onClick();
    expect(adapter.tileLayer).toHaveBeenNthCalledWith(3,
      expect.stringContaining('/default/2026-11-14/'), expect.objectContaining({ maxNativeZoom: 9 }));
    expect(adapter.states[0].value).toEqual(expect.objectContaining({ observationDate: '2026-11-14' }));
  });
});
