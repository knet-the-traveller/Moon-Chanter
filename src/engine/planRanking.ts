import type { RotationPlan, ScenarioCondition } from '../types';

/** Keep canonical baseline results immutable; rank the displayed adaptive shortlist.
 * Baseline benchmarks stay last, regardless of their score. Ties retain baseline order.
 */
export function rankPlansForScenario(plans: readonly RotationPlan[], scenario: ScenarioCondition): RotationPlan[] {
  return [...plans.filter(plan => !plan.isBaseline)
    .sort((a, b) => b.scenarioScores[scenario] - a.scenarioScores[scenario]),
  ...plans.filter(plan => plan.isBaseline)];
}

export const scenarioLabelKey = (scenario: ScenarioCondition): string =>
  `results.${scenario === 'compound' || scenario === 'hotter_drier' ? 'hotterAndDrier' : scenario}`;
