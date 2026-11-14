import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClimateData, LandSummary, SoilData } from '../types';
import { MunicipalLandFixtureSchema } from '../types/landFixture';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { fetchSoilGridsData } from '../services/soilGrids';
import { buildSampleLandSummary, fetchLandSummary } from '../services/landSummary';
import { useAppStore } from '../store/useAppStore';

vi.mock('../services/nasaPower', () => ({ fetchNasaPowerClimate: vi.fn() }));
vi.mock('../services/soilGrids', () => ({ fetchSoilGridsData: vi.fn() }));
vi.mock('../services/landSummary', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/landSummary')>(), fetchLandSummary: vi.fn()
}));

const fixtures = ['munoz', 'ilagan', 'pototan', 'malaybalay'].map((slug) =>
  MunicipalLandFixtureSchema.parse(JSON.parse(readFileSync(`public/sample-data/${slug}.json`, 'utf8'))));
const municipal = JSON.parse(readFileSync('public/sample-data/munoz.json', 'utf8')) as { climate: ClimateData; soil: SoilData };
const initialState = useAppStore.getInitialState();
const a = PILOT_LOCATIONS[0];
const b = PILOT_LOCATIONS[1];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((fulfill, fail) => { resolve = fulfill; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  useAppStore.setState(initialState, true);
  vi.mocked(fetchNasaPowerClimate).mockResolvedValue(municipal.climate);
  vi.mocked(fetchSoilGridsData).mockResolvedValue(municipal.soil);
  vi.mocked(fetchLandSummary).mockImplementation(async (lat, lon) => buildSampleLandSummary(lat, lon, fixtures));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('active-location pipeline', () => {
  it('does not start redundant requests after a refresh subscriber selects a newer field', async () => {
    await useAppStore.getState().selectPilotPreset(a);
    vi.clearAllMocks();
    let redirected = false;
    let nextRequest: Promise<void> | undefined;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!redirected && state.isLoadingTelemetry && state.selectedLocation.id === a.id) {
        redirected = true;
        nextRequest = state.selectPilotPreset(b);
      }
    });
    try {
      await useAppStore.getState().fetchTelemetry(a.lat, a.lon);
      await nextRequest;
      expect(useAppStore.getState().selectedLocation.id).toBe(b.id);
      expect(fetchNasaPowerClimate).toHaveBeenCalledTimes(1);
      expect(fetchSoilGridsData).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('keeps the latest selection when a store subscriber selects another field', async () => {
    const newest = PILOT_LOCATIONS[2];
    let redirected = false;
    let newestRequest: Promise<void> | undefined;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!redirected && state.selectedLocation.id === b.id) {
        redirected = true;
        newestRequest = state.selectPilotPreset(newest);
      }
    });
    try {
      await useAppStore.getState().selectPilotPreset(b);
      await newestRequest;
      expect(useAppStore.getState().selectedLocation.id).toBe(newest.id);
      expect(useAppStore.getState().landSummary?.sampleHub.id).toBe(newest.id);
      expect(fetchNasaPowerClimate).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('dates advisories when generated and retains that date through presentation changes', async () => {
    vi.useFakeTimers();
    const generated = Date.parse('2026-11-15T00:00:00Z');
    vi.setSystemTime(generated);
    await useAppStore.getState().selectPilotPreset(a);
    expect(useAppStore.getState().advisoryIssuedAt).toBe(generated);
    vi.setSystemTime(generated + 86400000);
    useAppStore.getState().setLanguage('fil');
    useAppStore.getState().setCurrentStep(4);
    expect(useAppStore.getState().advisoryIssuedAt).toBe(generated);
    useAppStore.getState().setPriority('soilHealth', 50);
    expect(useAppStore.getState().advisoryIssuedAt).toBe(generated + 86400000);
  });

  it('initializes the default field through the compatible telemetry entry point', async () => {
    await useAppStore.getState().fetchTelemetry(a.lat, a.lon);
    expect(useAppStore.getState().landSummary?.sampleHub.id).toBe('munoz');
    expect(useAppStore.getState().recommendedPlans.length).toBeGreaterThan(0);
    expect(useAppStore.getState().isLoadingLand).toBe(false);
  });

  it('clears old data atomically on selection and preserves override refresh semantics', async () => {
    await useAppStore.getState().selectPilotPreset(a);
    useAppStore.getState().setSoilOverride({ ph: 7 });
    await useAppStore.getState().fetchTelemetry(a.lat, a.lon);
    expect(useAppStore.getState().soilOverride).toEqual({ ph: 7 });
    const invalidSnapshots: boolean[] = [];
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.selectedLocation.id === b.id) invalidSnapshots.push(state.landSummary?.sampleHub.id === a.id);
    });
    await useAppStore.getState().selectPilotPreset(b);
    unsubscribe();
    expect(invalidSnapshots.every((invalid) => !invalid)).toBe(true);
    expect(useAppStore.getState().soilOverride).toBeNull();
    expect(useAppStore.getState().selectedLocation.id).toBe(b.id);
  });

  it('rejects stale A→B→A land, climate, soil, and error completions', async () => {
    const climates = [deferred<ClimateData>(), deferred<ClimateData>(), deferred<ClimateData>()];
    const soils = [deferred<SoilData>(), deferred<SoilData>(), deferred<SoilData>()];
    const lands = [deferred<LandSummary>(), deferred<LandSummary>(), deferred<LandSummary>()];
    climates.forEach((entry) => vi.mocked(fetchNasaPowerClimate).mockImplementationOnce(() => entry.promise));
    soils.forEach((entry) => vi.mocked(fetchSoilGridsData).mockImplementationOnce(() => entry.promise));
    lands.forEach((entry) => vi.mocked(fetchLandSummary).mockImplementationOnce(() => entry.promise));
    const first = useAppStore.getState().selectPilotPreset(a);
    const firstSignal = vi.mocked(fetchLandSummary).mock.calls[0][2];
    const second = useAppStore.getState().selectPilotPreset(b);
    const last = useAppStore.getState().selectPilotPreset(a);
    expect(firstSignal?.aborted).toBe(true);
    climates[0].resolve({ ...municipal.climate, meanAnnualTemp: 99 });
    soils[0].resolve({ ...municipal.soil, ph: 1 });
    lands[0].reject(new Error('old failed load'));
    await first;
    expect(useAppStore.getState().isLoadingLand).toBe(true);
    expect(useAppStore.getState().isLoadingTelemetry).toBe(true);
    climates[2].resolve(municipal.climate);
    soils[2].resolve(municipal.soil);
    lands[2].resolve(buildSampleLandSummary(a.lat, a.lon, fixtures));
    await last;
    const plans = useAppStore.getState().recommendedPlans;
    climates[1].resolve({ ...municipal.climate, meanAnnualTemp: 98 });
    soils[1].reject(new Error('old soil failure'));
    lands[1].resolve(buildSampleLandSummary(b.lat, b.lon, fixtures));
    await second;
    expect(useAppStore.getState().climateData).toEqual(municipal.climate);
    expect(useAppStore.getState().soilData).toEqual(municipal.soil);
    expect(useAppStore.getState().landSummary?.sampleHub.id).toBe(a.id);
    expect(useAppStore.getState().telemetryError).toBeNull();
    expect(useAppStore.getState().landError).toBeNull();
    expect(useAppStore.getState().recommendedPlans).toBe(plans);
  });

  it('shows land as soon as it is ready while climate and soil are still loading', async () => {
    const climate = deferred<ClimateData>();
    const soil = deferred<SoilData>();
    vi.mocked(fetchNasaPowerClimate).mockReturnValue(climate.promise);
    vi.mocked(fetchSoilGridsData).mockReturnValue(soil.promise);
    const request = useAppStore.getState().selectPilotPreset(a);
    await vi.waitFor(() => expect(useAppStore.getState().isLoadingLand).toBe(false));
    expect(useAppStore.getState().landSummary).toBeTruthy();
    expect(useAppStore.getState().isLoadingTelemetry).toBe(true);
    climate.resolve(municipal.climate);
    soil.resolve(municipal.soil);
    await request;
  });

  it('keeps location on total data failure and can recover', async () => {
    vi.mocked(fetchLandSummary).mockRejectedValueOnce(new Error('missing fixtures'));
    vi.mocked(fetchNasaPowerClimate).mockRejectedValueOnce(new Error('unavailable climate'));
    vi.mocked(fetchSoilGridsData).mockRejectedValueOnce(new Error('unavailable soil'));
    await useAppStore.getState().setCustomCoordinates(8.2, 125.2);
    expect(useAppStore.getState().selectedLocation.lat).toBe(8.2);
    expect(useAppStore.getState().landError).toBe('land.unavailable');
    expect(useAppStore.getState().recommendedPlans).toEqual([]);
    await useAppStore.getState().fetchTelemetry(8.2, 125.2);
    expect(useAppStore.getState().landSummary?.sampleHub.id).toBe('bukidnon');
    expect(useAppStore.getState().landError).toBeNull();
    expect(useAppStore.getState().telemetryError).toBeNull();
  });

  it('validates coordinate entry and redirects different-coordinate telemetry calls', async () => {
    await useAppStore.getState().setLocation(91, 120);
    expect(useAppStore.getState().selectedLocation.lat).toBe(a.lat);
    expect(fetchLandSummary).not.toHaveBeenCalled();
    await useAppStore.getState().fetchTelemetry(b.lat, b.lon);
    expect(useAppStore.getState().selectedLocation.lon).toBe(b.lon);
    expect(useAppStore.getState().landSummary?.sampleHub.id).toBe(b.id);
  });
});

describe('GPS selection ordering', () => {
  it('ignores GPS results after the user confirms the current field and leaves the map', () => {
    let success!: PositionCallback;
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok: PositionCallback) => { success = ok; } } });
    useAppStore.getState().locateWithGps();
    useAppStore.getState().setCurrentStep(2);
    success({ coords: { latitude: b.lat, longitude: b.lon } } as GeolocationPosition);
    expect(useAppStore.getState().selectedLocation.id).toBe(a.id);
    expect(useAppStore.getState().isLocatingGps).toBe(false);
  });

  it('ignores delayed success and error callbacks after a manual selection', async () => {
    let success!: PositionCallback;
    let error!: PositionErrorCallback;
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
      success = ok; error = fail;
    } } });
    useAppStore.getState().locateWithGps();
    await useAppStore.getState().selectPilotPreset(b);
    success({ coords: { latitude: a.lat, longitude: a.lon } } as GeolocationPosition);
    error({ code: 1 } as GeolocationPositionError);
    expect(useAppStore.getState().selectedLocation.id).toBe(b.id);
    expect(useAppStore.getState().gpsError).toBeNull();
    expect(useAppStore.getState().isLocatingGps).toBe(false);
  });

  it('sends the newest GPS result through the normal location action', async () => {
    const successes: PositionCallback[] = [];
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok: PositionCallback) => successes.push(ok) } });
    useAppStore.getState().locateWithGps();
    useAppStore.getState().locateWithGps();
    successes[0]({ coords: { latitude: a.lat, longitude: a.lon } } as GeolocationPosition);
    expect(useAppStore.getState().isLocatingGps).toBe(true);
    successes[1]({ coords: { latitude: 8.156, longitude: 125.127 } } as GeolocationPosition);
    await vi.waitFor(() => expect(useAppStore.getState().isLoadingLand).toBe(false));
    expect(useAppStore.getState().selectedLocation.name).toBe('My GPS Field');
    expect(useAppStore.getState().landSummary?.sampleHub.id).toBe('bukidnon');
  });

  it('reports an unavailable GPS without changing the selected field', () => {
    vi.stubGlobal('navigator', {});
    useAppStore.getState().locateWithGps();
    expect(useAppStore.getState().gpsError).toBe('map.gpsUnsupported');
    expect(useAppStore.getState().selectedLocation.id).toBe(a.id);
  });

  it('clears GPS loading when the platform throws synchronously', () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: () => { throw new Error('Denied by policy'); } } });
    expect(() => useAppStore.getState().locateWithGps()).not.toThrow();
    expect(useAppStore.getState().isLocatingGps).toBe(false);
    expect(useAppStore.getState().gpsError).toBe('map.gpsFailure');
  });
});
