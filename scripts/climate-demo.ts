import { fetchDailySeries } from '../src/services/nasaPower.js';
import { calculateClimateSummary, explainRisks } from '../src/engine/climate/climateSummary.js';
import { summarizeAllScenarios, type ClimateScenarioId } from '../src/engine/scenarios.js';
import { PILOT_CONFIG } from '../src/config/pilot.js';
import { planningPeriod } from '../src/config/planningCalendar.js';

async function runClimateDemo() {
  console.log('='.repeat(80));
  console.log(' FIELDSHIFT CLIMATE LAYER DEMO — NASA SPACE APPS CHALLENGE');
  console.log(` Target Pilot: ${PILOT_CONFIG.location.name}, ${PILOT_CONFIG.location.province}`);
  console.log(` Coordinates:  ${PILOT_CONFIG.location.lat}°N, ${PILOT_CONFIG.location.lon}°E`);
  console.log(` Period:       ${PILOT_CONFIG.period.startDate} to ${PILOT_CONFIG.period.endDate}`);
  console.log('='.repeat(80));

  console.log('\n[1/3] Loading NASA POWER daily series (Tier check: live -> cache -> sample)...');
  const series = await fetchDailySeries();
  console.log(`✓ Daily series loaded successfully.`);
  console.log(`  Source:     ${series.source}`);
  console.log(`  Tier:       ${series.tier.toUpperCase()}`);
  console.log(`  Sample:     ${series.isSample}`);
  console.log(`  Day Count:  ${series.dates.length} days`);

  console.log('\n[2/3] Computing Baseline ClimateSummary contract...');
  const baseline = calculateClimateSummary(series);
  const risksExplanation = explainRisks(baseline);

  console.log('\n--- BASELINE CLIMATOLOGY SUMMARY ---');
  console.log(`Location:   ${baseline.location.lat}°N, ${baseline.location.lon}°E`);
  console.log(`Period:     ${baseline.period.start} to ${baseline.period.end}`);
  console.log(`Windows:    Verified = ${baseline.windowsVerified}`);
  console.log(`10-Yr Trend: Temp: ${baseline.trend10y.tempC > 0 ? '+' : ''}${baseline.trend10y.tempC}°C/decade | Rainfall: ${baseline.trend10y.rainfallPct > 0 ? '+' : ''}${baseline.trend10y.rainfallPct}%/decade`);
  console.log(`Risk Flags: Drought: [${baseline.risks.drought.toUpperCase()}] (${baseline.riskScores?.drought}/100) | Flood: [${baseline.risks.flood.toUpperCase()}] (${baseline.riskScores?.flood}/100) | Heat: [${baseline.risks.heat.toUpperCase()}] (${baseline.riskScores?.heat}/100)`);

  console.log('\nSeasonal Breakdown (Non-Overlapping Calendar):');
  for (const s of baseline.seasons) {
    console.log(`  • [${s.name.toUpperCase()} SEASON]`);
    console.log(`    Mean Temp:            ${s.meanTempC} °C`);
    console.log(`    Total Rainfall:       ${s.rainfallMm} mm`);
    console.log(`    Rainfall Variability: ${s.rainfallVariability} (CV)`);
    console.log(`    Avg Longest Dryspell: ${s.dryspellDaysAvg} consecutive days`);
    console.log(`    Heat Days >= 34°C:    ${s.heatDaysAbove34C} days/season`);
    console.log(`    Heat Days >= 35°C:    ${s.heatDaysAbove35C} days/season`);
  }

  if (baseline.dryWindows) {
    console.log('\nDry Season Sub-Windows:');
    const { coolDry, hotDry } = baseline.dryWindows;
    console.log(`  • [COOL-DRY WINDOW (${planningPeriod('coolDry')}, residual moisture)]`);
    console.log(`    Mean Temp:        ${coolDry.meanTempC} °C | Rainfall: ${coolDry.rainfallMm} mm | Heat >= 34°C: ${coolDry.heatDaysAbove34C} d | Heat >= 35°C: ${coolDry.heatDaysAbove35C} d`);
    console.log(`  • [HOT-DRY WINDOW (${planningPeriod('hotDry')}, terminal heat/drought)]`);
    console.log(`    Mean Temp:        ${hotDry.meanTempC} °C | Rainfall: ${hotDry.rainfallMm} mm | Heat >= 34°C: ${hotDry.heatDaysAbove34C} d | Heat >= 35°C: ${hotDry.heatDaysAbove35C} d`);
  }

  console.log('\nExplainable Risk Telemetry:');
  console.log(`  • Drought: ${risksExplanation.drought.explanation}`);
  console.log(`  • Flood:   ${risksExplanation.flood.explanation}`);
  console.log(`  • Heat:    ${risksExplanation.heat.explanation}`);

  console.log('\n[3/3] Evaluating Climate Stress Scenarios...');
  const allScenarios = summarizeAllScenarios(series);

  const scenarioList: ClimateScenarioId[] = ['baseline', 'hotter', 'drier', 'wetter', 'hotter_drier'];

  console.log('\n' + '-'.repeat(95));
  console.log(
    'Scenario'.padEnd(14) +
    'Wet Rain'.padEnd(11) +
    'Dry Rain'.padEnd(11) +
    'Heat >=34°C'.padEnd(13) +
    'Heat >=35°C'.padEnd(13) +
    'Drought'.padEnd(15) +
    'Flood'.padEnd(15) +
    'Heat'
  );
  console.log('-'.repeat(95));

  for (const scId of scenarioList) {
    const sc = allScenarios[scId];
    const wet = sc.seasons.find((s) => s.name === 'wet')!;
    const dry = sc.seasons.find((s) => s.name === 'dry')!;

    const droughtStr = `${sc.risks.drought.toUpperCase()} (${sc.riskScores?.drought})`;
    const floodStr = `${sc.risks.flood.toUpperCase()} (${sc.riskScores?.flood})`;
    const heatStr = `${sc.risks.heat.toUpperCase()} (${sc.riskScores?.heat})`;

    console.log(
      scId.padEnd(14) +
      `${wet.rainfallMm} mm`.padEnd(11) +
      `${dry.rainfallMm} mm`.padEnd(11) +
      `${dry.heatDaysAbove34C} d`.padEnd(13) +
      `${dry.heatDaysAbove35C} d`.padEnd(13) +
      droughtStr.padEnd(15) +
      floodStr.padEnd(15) +
      heatStr
    );
  }
  console.log('-'.repeat(95));
  console.log('✓ Climate demo completed cleanly.\n');
}

runClimateDemo().catch((err) => {
  console.error('Demo execution error:', err);
  process.exit(1);
});
