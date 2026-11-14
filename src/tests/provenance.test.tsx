import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { buildClimateProvenance, buildSoilProvenance, cachedProvenance, climateProvenance, formatProvenance } from '../data/provenance';
import { applyFarmerSoilOverride, fetchSoilGridsData, soilCacheKey } from '../services/soilGrids';
import { fetchNasaPowerClimate } from '../services/nasaPower';
import { CacheService } from '../services/cache';
import { ClimateCard } from '../components/ClimateCard';
import { SoilCard } from '../components/SoilCard';
import { RotationCard } from '../components/RotationCard';
import { ComparisonModal } from '../components/ComparisonModal';
import { PrintablePlan } from '../components/PrintablePlan';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { ClimateData, SoilData } from '../types';

vi.mock('../store/useAppStore', async importOriginal => {
  const original = await importOriginal<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => original.useAppStore.getState(), original.useAppStore) };
});
const fixture = JSON.parse(readFileSync('public/sample-data/munoz.json','utf8')) as { climate: ClimateData; soil: SoilData };
const initial = useAppStore.getInitialState();
beforeEach(async () => { useAppStore.setState(initial,true); await CacheService.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const climate = () => ({...fixture.climate, provenance: buildClimateProvenance(fixture.climate,'sample',{name:'Science City of Muñoz'})});
const soil = () => ({...fixture.soil, provenance: buildSoilProvenance(fixture.soil,false,{name:'Science City of Muñoz'},false)});

describe('metric provenance', () => {
  it('uses distinct verified meteorological and radiation grids while leaving legacy metadata unavailable', () => {
    const data = buildClimateProvenance({...fixture.climate,isSampleData:false},'live');
    expect(data.precipitation.spatialResolution).toContain('0.625');
    expect(data.solarRadiation.spatialResolution).toContain('1° × 1°');
    expect(data.heatStressDays.isSynthetic).toBe(true);
    expect(data.rainfallTrend.dateRange).toBeNull();
    expect(climateProvenance(fixture.climate).precipitation.spatialResolution).toBeNull();
  });
  it('preserves source periods and reference hubs through cache without upgrading samples to live', () => {
    const sample = climate().provenance;
    const cachedSample = cachedProvenance(sample);
    expect(cachedSample.precipitation).toEqual({...sample.precipitation,cached:true});
    const live = buildClimateProvenance({...fixture.climate,isSampleData:false},'live');
    const cached = cachedProvenance(live);
    expect(cached.temperature.tier).toBe('cached-live');
    expect(cached.temperature.dateRange).toBe(live.temperature.dateRange);
    expect(cached.risk.tier).toBe('synthetic');
  });
  it('updates only overridden fields and the pH-derived flag, preserving reset and numerical behavior', () => {
    const base = soil();
    const changed = applyFarmerSoilOverride(base,{texture:'sandy',ph:6.4});
    expect(changed.provenance?.texture?.tier).toBe('farmer');
    expect(changed.provenance?.phosphorusFixationRisk?.tier).toBe('farmer');
    expect(changed.provenance?.organicMatter).toEqual(base.provenance.organicMatter);
    expect(changed.phosphorusFixationRisk).toBe('low');
    expect(applyFarmerSoilOverride(base,null)).toBe(base);
  });
  it('keeps new provenance in parsed soil cache payloads', async () => {
    const base = { ...soil(), bulkDensityGcm3:1.38, isEstimate:false,
      provenance: buildSoilProvenance({...fixture.soil,isEstimate:false},true) };
    await CacheService.set(soilCacheKey(15.714,120.906),{schemaVersion:2,profile:base});
    const result = await fetchSoilGridsData(15.714,120.906);
    expect(result.provenance?.ph?.tier).toBe('cached-live');
    expect(result.provenance?.ph?.dateRange).toBeNull();
    expect(result.ph).toBe(base.ph);
  });
  it('does not carry cached API identity into a fresh farmer input', () => {
    const base = {...soil(),provenance:cachedProvenance(buildSoilProvenance({...fixture.soil,isEstimate:false},true))};
    const changed = applyFarmerSoilOverride(base,{texture:'sandy',ph:6.4});
    expect(changed.provenance?.texture?.cached).toBe(false);
    expect(changed.provenance?.texture?.variable).toBe('texture');
    expect(changed.provenance?.ph?.productVersion).toBeNull();
    expect(base.provenance.ph.cached).toBe(true);
    useAppStore.setState({soilData:base,climateData:climate(),soilOverride:{texture:'sandy'}});
    useAppStore.getState().resetSoilOverride();
    expect(useAppStore.getState().soilData?.provenance?.ph?.cached).toBe(true);
  });
  it('uses the consumed fixture location and rejects empty source responses', async () => {
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async (url: string) => url.includes('/sample-data/')
      ? {ok:true,json:async()=>({location:{name:'Named fixture reference',lat:15,lon:121},soil:fixture.soil})}
      : {ok:false,status:503}));
    const sample = await fetchSoilGridsData(15.714,120.906);
    expect(sample.provenance?.ph?.sampleLocation?.name).toBe('Named fixture reference');
    await CacheService.clear();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({properties:{layers:[]}})}));
    const missing = await fetchSoilGridsData(15.714,120.906);
    expect(missing.isEstimate).toBe(true);
    expect(missing.source).toContain('FieldShift municipal soil example');
    expect(missing.provenance?.ph?.tier).toBe('sample');
    expect(missing.provenance?.ph?.isSample).toBe(true);
  });
  it('retains climate cache sample identity and flags malformed cache metadata for reload', async () => {
    await CacheService.set('nasa_power_climatology_15.714_120.906',climate());
    const cached = await fetchNasaPowerClimate(15.714,120.906);
    expect(cached.provenance?.precipitation?.sampleLocation?.name).toBe('Science City of Muñoz');
    expect(cached.provenance?.precipitation?.tier).toBe('sample');
    await CacheService.set('nasa_power_climatology_15.714_120.906',{...climate(),provenance:{bad:{source:42}}});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:400}));
    const reloaded = await fetchNasaPowerClimate(15.714,120.906);
    expect(reloaded.provenance?.precipitation?.sampleLocation?.name).toBe('Science City of Muñoz');
  });
  it.each(['en','fil'] as const)('renders provenance in cards, plans, comparison and print in %s', language => {
    useAppStore.setState({language,climateData:climate(),soilData:soil(),soilOverride:{texture:'sandy'},isComparisonModalOpen:true});
    useAppStore.getState().computeRecommendations();
    const plan=useAppStore.getState().recommendedPlans[0];
    expect(plan).toBeDefined();
    useAppStore.setState({comparedPlanIds:[plan.id]});
    const views=[createElement(ClimateCard),createElement(SoilCard),createElement(RotationCard,{plan,rank:1}),
      createElement(ComparisonModal),createElement(PrintablePlan)];
    for(const view of views){
      const html=renderToStaticMarkup(view);
      expect(html).toContain(getTranslation(language,'provenance.unknownResolution'));
      expect(html).toContain('Science City of Muñoz');
      expect(html).not.toContain('0.5° × 0.5°');
    }
    expect(renderToStaticMarkup(createElement(SoilCard))).toContain(getTranslation(language,'provenance.farmer'));
    expect(renderToStaticMarkup(createElement(PrintablePlan))).toContain('<details open=""');
    const status = formatProvenance(language,climate().provenance.heatStressDays);
    expect(status).toContain(getTranslation(language,'provenance.synthetic'));
  });
});
