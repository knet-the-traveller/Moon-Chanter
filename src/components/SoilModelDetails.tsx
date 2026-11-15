import { getTranslation } from '../i18n';
import type { Language } from '../types';
import type { SoilModelEvidence } from '../types/soilGridsPackage';
import { SOIL_DEPTHS } from '../types/soilGridsPackage';

/** Renders the cell relocation advisory when bundled SoilGrids stepped to a nearby valid cell. */
export function SoilRelocationNotice({
  evidence,
  language,
  className = 'rounded-xl border border-at-warn-border/30 bg-at-warn-bg p-3 text-at-warn-text',
}: {
  evidence: SoilModelEvidence;
  language: Language;
  className?: string;
}) {
  const requestedCell = evidence.requestedCellIndex ?? evidence.relocatedFrom?.cellIndex;
  if (requestedCell === undefined) return null;
  const t = (key: string) => getTranslation(language, `soilModel.${key}`);
  const offsetMeters = evidence.offsetDistanceMeters ?? (evidence.relocatedFrom ? Math.round(evidence.relocatedFrom.distanceKm * 1000) : 250);
  return (
    <div role="status" className={className}>
      <p className="font-bold">{t('locationAdvisory')}</p>
      <p>{t('nearestValidCell')
        .replace('{requestedCell}', String(requestedCell + 1))
        .replace('{usedCell}', String(evidence.cellIndex + 1))
        .replace('{meters}', String(offsetMeters))}</p>
    </div>
  );
}

/** Shows original model predictions even when a farmer override is active. */
export function SoilModelDetails({
  evidence,
  language,
  hideRelocationNotice = false,
}: {
  evidence: SoilModelEvidence;
  language: Language;
  hideRelocationNotice?: boolean;
}) {
  const t = (key: string) => getTranslation(language, `soilModel.${key}`);
  const hasPredictions = evidence.readings.some(reading => SOIL_DEPTHS.some(depth => reading.depths[depth].mean !== null));
  const format = (value: number | null) => value === null ? getTranslation(language, 'provenance.unavailableValue') : String(Number(value.toFixed(2)));
  return (
    <section className="mt-4 space-y-3 rounded-xl border border-at-line bg-at-tint/30 p-3.5 text-sm text-at-dk" aria-label={t('title')}>
      <p className="font-semibold">{t('title')}</p>
      <p>{t('coverage').replace('{grid}', evidence.gridName).replace('{cell}', String(evidence.cellIndex + 1))}</p>
      {!hideRelocationNotice && <SoilRelocationNotice evidence={evidence} language={language} />}
      {!hasPredictions && <p role="status" className="rounded-xl border border-at-warn-border/30 bg-at-warn-bg p-3 font-semibold text-at-warn-text">{t('noPredictions')}</p>}
      <p>{t('limits')}</p>
      <p className="text-xs text-at-muted">{t('retrieved').replace('{date}', evidence.retrievedAt.replace('T', ' ').replace('Z', ' UTC'))} · CC BY 4.0 · ISRIC</p>
      <details>
        <summary className="cursor-pointer py-2 font-semibold underline text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk">{t('showPredictions')}</summary>
        <p className="my-2 text-xs text-at-muted">{t('uncertainty')}</p>
        <div className="overflow-x-auto rounded-xl border border-at-line bg-white">
          <table className="w-full text-left text-xs text-at-dk">
            <caption className="p-3 text-left font-semibold text-at-dk">{t('original')}</caption>
            <thead className="bg-at-tint text-at-dk">
              <tr>
                <th scope="col" className="p-2">{t('property')}</th>
                <th scope="col" className="p-2">{t('depth')}</th>
                <th scope="col" className="p-2">{t('mean')}</th>
                <th scope="col" className="p-2">Q05</th>
                <th scope="col" className="p-2">Q95</th>
              </tr>
            </thead>
            <tbody>
              {evidence.readings.flatMap(reading => SOIL_DEPTHS.map(depth => (
                <tr key={`${reading.property}-${depth}`} className="border-t border-at-line">
                  <th scope="row" className="p-2 font-medium">{t(reading.property)} ({reading.unit})</th>
                  <td className="whitespace-nowrap p-2">{depth.replace('cm', ' cm')}</td>
                  <td className="p-2">{format(reading.depths[depth].mean)}</td>
                  <td className="p-2">{format(reading.depths[depth].q05)}</td>
                  <td className="p-2">{format(reading.depths[depth].q95)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-at-muted">{t('weightedMean')}</p>
        <a href={`${import.meta.env.BASE_URL}data/soilgrids/pilots-v1-rasters.zip`} download className="mt-3 inline-block py-2 font-semibold underline text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk">{t('download')}</a>
      </details>
    </section>
  );
}
