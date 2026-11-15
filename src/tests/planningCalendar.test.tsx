import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {PLANNING_MONTHS, PLANNING_CALENDAR_VERSION, planningPeriod} from '../config/planningCalendar';
import {groupDailySeriesBySeasons, calculateClimateSummary, summarizeSeasonInstance, explainRisks} from '../engine/climate/climateSummary';
import {buildObservedClimate} from '../services/observedClimate';
import {aggregatePlanningClimatology} from '../services/planningClimatology';
import {climateCacheKey, fetchNasaPowerClimate, type DailySeries} from '../services/nasaPower';
import {resolveBundledPower} from '../services/bundledPower';
import {CacheService} from '../services/cache';
import {ClimateCard} from '../components/ClimateCard';
import {useAppStore} from '../store/useAppStore';
import {getTranslation} from '../i18n';

vi.mock('../store/useAppStore', async original => {
  const module = await original<typeof import('../store/useAppStore')>();
  return {useAppStore: Object.assign(() => module.useAppStore.getState(), module.useAppStore)};
});

function seriesBetween(start: string, end: string): DailySeries {
  const dates: string[] = [];
  for (let day = Date.parse(start); day < Date.parse(end); day += 86400000) dates.push(new Date(day).toISOString().slice(0, 10));
  const month = (date: string) => Number(date.slice(5, 7));
  return {
    location: {lat: 0, lon: 0}, dates,
    t2m: dates.map(() => 25), t2mMax: dates.map(date => month(date) === 2 ? 40 : 30),
    prectotcorr: dates.map(date => month(date) === 11 ? 10 : 0),
    rh2m: dates.map(() => 75), allskySfcSwDwn: dates.map(() => 18),
    tier: 'sample', isSample: true, source: 'Synthetic boundary test'
  };
}

beforeEach(async () => {await CacheService.clear(); useAppStore.setState(useAppStore.getInitialState(), true);});
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});

it('partitions all 12 months exactly once into the existing three planning windows', () => {
  expect(PLANNING_MONTHS).toEqual({wet: [6,7,8,9,10], coolDry: [11,12,1,2], hotDry: [3,4,5]});
  const months = Object.values(PLANNING_MONTHS).flat();
  expect([...months].sort((a,b) => a-b)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  expect(new Set(months).size).toBe(12);
});

it('assigns leap day to the correct cross-year cool window and March 1 to hot dry', () => {
  const series = seriesBetween('2019-11-01', '2020-06-02');
  const buckets = groupDailySeriesBySeasons(series);
  expect(buckets['2019-2020-coolDry'].dates).toHaveLength(121);
  expect(buckets['2019-2020-coolDry'].dates.at(-1)).toBe('2020-02-29');
  expect(buckets['2020-hotDry'].dates[0]).toBe('2020-03-01');
  expect(buckets['2020-hotDry'].dates.at(-1)).toBe('2020-05-31');
  expect(buckets['2020-wet'].dates).toEqual(['2020-06-01']);
  const summary = calculateClimateSummary(series, {maxMissingDayFraction: 0});
  expect(summary.dryWindows?.coolDry.heatDaysAbove35C).toBe(29);
  expect(summary.dryWindows?.hotDry.heatDaysAbove35C).toBe(0);
  // A missing leap day must reject the otherwise complete cool window.
  series.t2m[series.dates.indexOf('2020-02-29')] = null;
  expect(calculateClimateSummary(series, {maxMissingDayFraction: 0}).dryWindows?.coolDry.heatDaysAbove35C).toBe(0);
});

it('puts November rain and February heat in cool dry across both climate interfaces', () => {
  const series = seriesBetween('2019-01-01', '2022-01-01');
  const summary = calculateClimateSummary(series, {maxMissingDayFraction: 0});
  const observed = buildObservedClimate(series)!;
  expect(summary.calendarVersion).toBe(PLANNING_CALENDAR_VERSION);
  expect(observed.calendarVersion).toBe(summary.calendarVersion);
  expect(summary.planningSeasons?.map(season => [season.name, season.months])).toEqual([
    ['wet', [6,7,8,9,10]], ['coolDry', [11,12,1,2]], ['hotDry', [3,4,5]]
  ]);
  expect(summary.seasons).toHaveLength(2); // Compatible wet/dry aggregate API.
  expect(summary.dryWindows?.coolDry.rainfallMm).toBe(300);
  expect(summary.dryWindows?.hotDry.rainfallMm).toBe(0);
  expect(observed.seasonalStats).toMatchObject({wet: {precip: 0, maxTemp: 30}, dryCool: {precip: 300, maxTemp: 40}, dryHot: {precip: 0, maxTemp: 30}});
  expect(aggregatePlanningClimatology(observed.monthly)).toEqual(observed.seasonalStats);
  expect(summary.windowsVerified).toBe(false);
});

it('rejects old calendar aggregates in both the old namespace and the current cache envelope', async () => {
  const series = resolveBundledPower(15.714,120.906,'20140101','20231231')!;
  const expected = buildObservedClimate(series)!;
  const old = {...expected, calendarVersion: 'old-calendar', seasonalStats: {...expected.seasonalStats, wet: {precip: 99999, avgTemp: 20, maxTemp: 30}}};
  await CacheService.set('nasa_power_observed_v3_15.714_120.906', old);
  await CacheService.set(climateCacheKey(15.714,120.906), old);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const result = await fetchNasaPowerClimate(15.714,120.906);
  expect(result.seasonalStats).toEqual(expected.seasonalStats);
  expect(result.calendarVersion).toBe(PLANNING_CALENDAR_VERSION);
  expect(fetch).not.toHaveBeenCalled();
});

it('aligns the monthly-only emergency reference when live and bundled acquisition both fail', async () => {
  vi.stubGlobal('process', {...process, versions: {...process.versions, node: undefined}});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 400}));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const result = await fetchNasaPowerClimate(0, 0);
  expect(result.isSampleData).toBe(true);
  expect(result.calendarVersion).toBe(PLANNING_CALENDAR_VERSION);
  expect(result.seasonalStats).toEqual(aggregatePlanningClimatology(result.monthly));
  expect(result.seasonalStats.wet.precip).toBe(1550);
  expect(result.seasonalStats.dryCool.precip).toBe(129);
  const rainfall = result.monthly.reduce((sum, row) => sum + row.rainfall, 0);
  expect(result.meanAnnualPrecipitation).toBe(rainfall);
  expect(Object.values(result.seasonalStats).reduce((sum, season) => sum + season.precip, 0)).toBe(rainfall);
  expect(result.meanAnnualTemp).toBe(Number((result.monthly.reduce((sum, row) => sum + row.temp, 0) / 12).toFixed(1)));
  expect(result.dateRange).toBe('');
  for (const metadata of Object.values(result.provenance!)) {
    expect(metadata).toMatchObject({isSample: true, isSynthetic: true, tier: 'synthetic', dateRange: null, methodKey: 'provenance.methods.emergencyClimate'});
    expect(metadata.citation).toBeUndefined();
  }
});

it('honors a caller heat threshold while retaining fixed 34/35 C counters', () => {
  const season = summarizeSeasonInstance('2020-hotDry', 'hotDry', {
    dates: ['2020-03-01','2020-03-02','2020-03-03'],
    rain: [0,0,0], t2m: [25,25,25], t2mMax: [35,37,40]
  }, 38);
  expect(season.heatStressDays).toBe(1);
  expect(season.heatDaysAbove35C).toBe(3);
  expect(season.heatDaysAbove34C).toBe(3);
  const series = seriesBetween('2019-01-01', '2022-01-01');
  const custom = calculateClimateSummary(series, {heatThresholdC: 41});
  expect(custom.heatThresholdC).toBe(41);
  expect(custom.seasons.find(season => season.name === 'dry')?.heatStressDays).toBe(0);
  expect(custom.dryWindows?.coolDry.heatDaysAbove35C).toBeGreaterThan(0);
  expect(custom.risks.heat).toBe('low');
  expect(explainRisks(custom).heat).toMatchObject({thresholdC: 41, heatStressDaysPerSeason: 0});
  expect(explainRisks(custom).heat.explanation).toContain('41°C');
  const legacy = {...custom, heatThresholdC: undefined};
  expect(explainRisks(legacy).heat.thresholdC).toBe(35);
});

it.each(['en','fil'] as const)('renders the three matching climate periods without placeholders in %s', language => {
  const climate = buildObservedClimate(seriesBetween('2019-01-01','2022-01-01'))!;
  useAppStore.setState({climateData: climate, language});
  const html = renderToStaticMarkup(createElement(ClimateCard));
  for (const [key, season] of [['wetSeason','wet'],['dryCoolSeason','coolDry'],['dryHotSeason','hotDry']] as const) {
    expect(html).toContain(getTranslation(language, `conditions.${key}`).replace('{months}', planningPeriod(season, language)));
  }
  expect(html).not.toContain('{months}');
});

it.each(['en','fil'] as const)('keeps the new concise subtitles accurate for synthetic emergency climate in %s', async language => {
  vi.stubGlobal('process', {...process, versions: {...process.versions, node: undefined}});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 400}));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const climate = await fetchNasaPowerClimate(0, 0);
  useAppStore.setState({climateData: climate, language});
  const html = renderToStaticMarkup(createElement(ClimateCard));
  const label = getTranslation(language, 'conditions.shortIllustrativeClimate');
  expect(html.match(new RegExp(`title="${label}"`, 'g'))).toHaveLength(2);
  expect(html).not.toContain(`title="${getTranslation(language, 'conditions.shortSampleClimate')}"`);
  expect(html).not.toContain(`title="${getTranslation(language, 'conditions.shortNasaPower')}"`);
  expect(html).toContain(climate.meanAnnualPrecipitation.toLocaleString());
});
