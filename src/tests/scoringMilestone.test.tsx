import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { rankPlansForScenario } from '../engine/planRanking';
import { ComparisonModal } from '../components/ComparisonModal';
import { PrintablePlan } from '../components/PrintablePlan';
import { MethodologyModal } from '../components/MethodologyModal';
import { getTranslation } from '../i18n';

vi.mock('../store/useAppStore', async original => {
  const module = await original<typeof import('../store/useAppStore')>();
  return { useAppStore: Object.assign(() => module.useAppStore.getState(), module.useAppStore) };
});
const initial = useAppStore.getInitialState();
afterEach(() => useAppStore.setState(initial, true));

it.each(['en','fil'] as const)('uses the selected scenario consistently in comparison and print, with baseline context in %s', async language => {
  await useAppStore.getState().selectPilotPreset(PILOT_LOCATIONS[0]);
  const original = useAppStore.getState().recommendedPlans;
  const plans = original.map((plan, index) => ({ ...plan, scenarioScores: { ...plan.scenarioScores, hotter: plan.isBaseline ? 100 : 40 + index * 10 } }));
  useAppStore.setState({ recommendedPlans: plans, activeScenario: 'hotter', language, isComparisonModalOpen: true, comparedPlanIds: plans.map(plan => plan.id) });
  const top = rankPlansForScenario(plans, 'hotter')[0];
  const print = renderToStaticMarkup(createElement(PrintablePlan));
  const comparison = renderToStaticMarkup(createElement(ComparisonModal));
  expect(print).toContain(`Fit Score: ${top.scenarioScores.hotter}/100`);
  expect(print).toContain(top.seasons[2].crop.name.en);
  const context = getTranslation(language, 'results.rankingContext').replace('{scenario}', getTranslation(language, 'results.hotter'));
  expect(print).toContain(context);
  expect(comparison).toContain(context);
  expect(comparison).toContain(getTranslation(language, 'results.baselinePillars'));
  expect(print).not.toMatch(/7%–10%|fixes 35|preventing crop failure/);
  expect(useAppStore.getState().recommendedPlans).toBe(plans);
});

it.each(['en','fil'] as const)('discloses actual screen limits in methodology in %s', language => {
  useAppStore.setState({ language, isMethodologyModalOpen: true });
  const html = renderToStaticMarkup(createElement(MethodologyModal));
  expect(html).toContain(getTranslation(language, 'methodology.heat').replaceAll('>', '&gt;'));
  expect(html).toContain(getTranslation(language, 'methodology.soil'));
  expect(html).not.toMatch(/7%|35–100|\$\\to\$/);
});
