import { getTranslation } from '../i18n';
import type { Language } from '../types';
import type { SoilModelEvidence } from '../types/soilGridsPackage';
import { SOIL_DEPTHS } from '../types/soilGridsPackage';

/** Shows original model predictions even when a farmer override is active. */
export function SoilModelDetails({ evidence, language }: { evidence: SoilModelEvidence; language: Language }) {
  const t = (key: string) => getTranslation(language, `soilModel.${key}`);
  const hasPredictions = evidence.readings.some(reading => SOIL_DEPTHS.some(depth => reading.depths[depth].mean !== null));
  const format = (value: number | null) => value === null ? getTranslation(language, 'provenance.unavailableValue') : String(Number(value.toFixed(2)));
  const requestedCell = evidence.requestedCellIndex ?? evidence.relocatedFrom?.cellIndex;
  const offsetMeters = evidence.offsetDistanceMeters ?? (evidence.relocatedFrom ? Math.round(evidence.relocatedFrom.distanceKm * 1000) : 250);
  return <section className="mt-4 space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950" aria-label={t('title')}>
    <p className="font-semibold">{t('title')}</p>
    <p>{t('coverage').replace('{grid}', evidence.gridName).replace('{cell}', String(evidence.cellIndex + 1))}</p>
    {requestedCell !== undefined && (
      <div role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950">
        <p className="font-bold">{t('locationAdvisory')}</p>
        <p>{t('nearestValidCell')
          .replace('{requestedCell}', String(requestedCell + 1))
          .replace('{usedCell}', String(evidence.cellIndex + 1))
          .replace('{meters}', String(offsetMeters))}</p>
      </div>
    )}
    {!hasPredictions && <p role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-3 font-semibold text-amber-950">{t('noPredictions')}</p>}
    <p>{t('limits')}</p>
    <p className="text-xs">{t('retrieved').replace('{date}', evidence.retrievedAt.replace('T', ' ').replace('Z', ' UTC'))} · CC BY 4.0 · ISRIC</p>
    <details>
      <summary className="cursor-pointer py-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-emerald-800">{t('showPredictions')}</summary>
      <p className="my-2">{t('uncertainty')}</p>
      <div className="overflow-x-auto rounded-lg border border-emerald-300 bg-white">
        <table className="w-full text-left text-xs text-stone-900">
          <caption className="p-3 text-left font-semibold">{t('original')}</caption>
          <thead className="bg-emerald-100"><tr>
            <th scope="col" className="p-2">{t('property')}</th>
            <th scope="col" className="p-2">{t('depth')}</th>
            <th scope="col" className="p-2">{t('mean')}</th>
            <th scope="col" className="p-2">Q05</th>
            <th scope="col" className="p-2">Q95</th>
          </tr></thead>
          <tbody>{evidence.readings.flatMap(reading => SOIL_DEPTHS.map(depth => <tr key={`${reading.property}-${depth}`} className="border-t border-stone-200">
            <th scope="row" className="p-2 font-medium">{t(reading.property)} ({reading.unit})</th>
            <td className="whitespace-nowrap p-2">{depth.replace('cm', ' cm')}</td>
            <td className="p-2">{format(reading.depths[depth].mean)}</td>
            <td className="p-2">{format(reading.depths[depth].q05)}</td>
            <td className="p-2">{format(reading.depths[depth].q95)}</td>
          </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3">{t('weightedMean')}</p>
      <a href={`${import.meta.env.BASE_URL}data/soilgrids/pilots-v1-rasters.zip`} download className="mt-3 inline-block py-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-emerald-800">{t('download')}</a>
    </details>
  </section>;
}
