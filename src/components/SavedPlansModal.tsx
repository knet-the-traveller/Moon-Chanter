import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { Bookmark, X, Printer, Eye, Trash2, MapPin, Droplets, Calendar, FileText } from 'lucide-react';
import type { SavedPlanRecord } from '../services/savedPlans';

export const SavedPlansModal: React.FC = () => {
  const {
    isSavedPlansOpen,
    setSavedPlansOpen,
    savedPlans,
    restoreSavedPlan,
    removeSavedPlan,
    language
  } = useAppStore();

  useEffect(() => {
    if (!isSavedPlansOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSavedPlansOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSavedPlansOpen, setSavedPlansOpen]);

  if (!isSavedPlansOpen) {
    return null;
  }

  const handlePrint = (recordId: string) => {
    restoreSavedPlan(recordId);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const getWaterSourceLabel = (ws: SavedPlanRecord['waterSource']): string => {
    switch (ws) {
      case 'irrigation_canal':
        return getTranslation(language, 'conditions.waterCanal');
      case 'rainfed':
        return getTranslation(language, 'conditions.waterRainfed');
      case 'pump_well':
        return getTranslation(language, 'conditions.waterPumpWell');
      case 'small_pond':
        return getTranslation(language, 'conditions.waterSmallPond');
      default:
        return ws;
    }
  };

  const getScenarioLabel = (scenario: string): string => {
    const key = `results.${scenario}` as const;
    const translated = getTranslation(language, key);
    return translated || scenario;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-plans-modal-title"
      className="fixed inset-0 z-50 bg-[#1D3309]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white border-2 border-[#D5E0C8] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1D3309] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#C7DA91]">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 id="saved-plans-modal-title" className="text-base sm:text-lg font-bold">
                {getTranslation(language, 'results.savedPlansTitle')}
              </h2>
              <p className="text-xs text-[#C7DA91]/80">
                {savedPlans.length}{' '}
                {savedPlans.length === 1 ? 'plan snapshot saved' : 'plan snapshots saved'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSavedPlansOpen(false)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#A7BD40]"
            aria-label="Close saved plans modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {savedPlans.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EBF2D8] text-[#56664A] flex items-center justify-center mx-auto">
                <Bookmark className="w-6 h-6 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-[#1D3309] max-w-md mx-auto">
                {getTranslation(language, 'results.savedPlansEmpty')}
              </p>
            </div>
          ) : (
            savedPlans.map((record) => {
              const planTitle =
                (language === 'fil' ? record.plan.name.local : record.plan.name.en) ||
                record.plan.name.en;
              const savedDateFormatted = new Date(record.savedAtIso).toLocaleDateString(
                language === 'fil' ? 'fil-PH' : 'en-PH',
                {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              );

              return (
                <div
                  key={record.id}
                  className="bg-[#F7F9F4] border border-[#D5E0C8] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs hover:border-[#A7BD40] transition-colors"
                >
                  {/* Top Bar: Plan Title, Score, Saved Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D5E0C8]/60 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-[#1D3309]">{planTitle}</span>
                        {record.rankIndex !== undefined && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF2D8] text-[#1D3309] border border-[#D5E0C8]">
                            #{record.rankIndex}
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1D3309] text-white">
                          {Math.round(record.plan.scores.overall)}/100{' '}
                          {getTranslation(language, 'results.scoreLabel')}
                        </span>
                      </div>
                      <p className="text-xs text-[#56664A] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{savedDateFormatted}</span>
                      </p>
                    </div>
                  </div>

                  {/* Context Chips: Location, Scenario, Water, Field Size */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#D5E0C8] text-[#1D3309] font-medium">
                      <MapPin className="w-3 h-3 text-[#56664A]" />
                      <span>
                        {record.location.name}, {record.location.province}
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#D5E0C8] text-[#1D3309] font-medium">
                      <span>{getScenarioLabel(record.activeScenario)}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#D5E0C8] text-[#1D3309] font-medium">
                      <Droplets className="w-3 h-3 text-[#5C95E0]" />
                      <span>{getWaterSourceLabel(record.waterSource)}</span>
                    </span>

                    {record.fieldSizeHa !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#D5E0C8] text-[#1D3309] font-medium">
                        <span>
                          {record.fieldSizeHa} {getTranslation(language, 'conditions.fieldSizeUnit')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Plot Notes if present */}
                  {record.plotNotes && (
                    <div className="flex items-start gap-1.5 p-2 rounded-lg bg-white/70 border border-[#D5E0C8] text-xs text-[#56664A]">
                      <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#56664A]" />
                      <p className="italic">"{record.plotNotes}"</p>
                    </div>
                  )}

                  {/* 3-Season Rotation Chain */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
                    {record.plan.seasons.map((season, idx) => {
                      const cropName =
                        (language === 'fil' ? season.crop.name.local : season.crop.name.en) ||
                        season.crop.name.en;
                      const seasonName =
                        (language === 'fil' ? season.seasonName.local : season.seasonName.en) ||
                        season.seasonName.en;

                      return (
                        <div
                          key={season.seasonKey}
                          className="bg-white border border-[#D5E0C8] rounded-lg p-2 text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between text-[10px] text-[#56664A] font-semibold uppercase">
                            <span>
                              {idx + 1}. {seasonName}
                            </span>
                            <span>{season.periodMonths}</span>
                          </div>
                          <p className="font-bold text-[#1D3309] truncate">{cropName}</p>
                          <p className="text-[10px] text-[#56664A] truncate">{season.role}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons: Restore & View, Print, Remove */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-[#D5E0C8]/40">
                    <button
                      type="button"
                      onClick={() => removeSavedPlan(record.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'results.removePlan')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrint(record.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#A7BD40] hover:bg-[#bbf246] text-[#1D3309] text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'nav.printPlan')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => restoreSavedPlan(record.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1D3309] hover:bg-[#2e4d11] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#C7DA91]" />
                      <span>{getTranslation(language, 'results.restorePlan')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F7F9F4] border-t border-[#D5E0C8] px-5 py-3 flex items-center justify-between text-xs text-[#56664A]">
          <span>{getTranslation(language, 'app.title')} Farm Records</span>
          <button
            type="button"
            onClick={() => setSavedPlansOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-[#1D3309] text-white font-semibold hover:bg-[#2e4d11] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
