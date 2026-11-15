import { getTranslation } from '../i18n';
import { scenarioLabelKey } from '../engine/planRanking';
import type { Language, ScenarioCondition } from '../types';

export function ScenarioContext({ language, scenario }: { language: Language; scenario: ScenarioCondition }) {
  return <p className="my-3 text-sm font-medium text-stone-800 print:break-inside-avoid">
    {getTranslation(language, 'results.rankingContext').replace('{scenario}', getTranslation(language, scenarioLabelKey(scenario)))}
  </p>;
}
