/** Existing rotation-plan convention, shared by all climate consumers.
 * This is a provisional planning calendar, not a verified regional crop calendar. */
export const PLANNING_CALENDAR_VERSION = 'planning-calendar-v1';
export const PLANNING_MONTHS = {
  wet: [6, 7, 8, 9, 10],
  coolDry: [11, 12, 1, 2],
  hotDry: [3, 4, 5]
} as const;
export type PlanningSeasonKey = keyof typeof PLANNING_MONTHS;
export const PLANNING_CALENDAR_REVIEW = {
  needsReview: true,
  note: 'Team planning convention: Jun–Oct, Nov–Feb, Mar–May. Confirm local planting dates and seasonal boundaries with agricultural technicians.'
} as const;

export function planningPeriod(key: PlanningSeasonKey, language: 'en' | 'fil' = 'en'): string {
  const months = PLANNING_MONTHS[key];
  const formatter = new Intl.DateTimeFormat(language === 'fil' ? 'fil-PH' : 'en-PH', {month: 'short', timeZone: 'UTC'});
  return [months[0], months[months.length - 1]].map(month => formatter.format(new Date(Date.UTC(2000, month - 1, 1)))).join(' – ');
}

/** End-exclusive UTC bounds for a cycle beginning in startYear. */
export function seasonalBounds(startYear: number, months: readonly number[]): {start: number; end: number} {
  const first = months[0], last = months[months.length - 1];
  return {start: Date.UTC(startYear, first - 1, 1), end: Date.UTC(startYear + (last < first ? 1 : 0), last, 1)};
}
