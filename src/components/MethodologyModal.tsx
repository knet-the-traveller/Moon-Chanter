import { getTranslation } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { X, BookOpen } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

export const MethodologyModal = () => {
  const { isMethodologyModalOpen, setMethodologyModalOpen, language } = useAppStore();
  const dialog = useDialogFocus(isMethodologyModalOpen, setMethodologyModalOpen);
  if (!isMethodologyModalOpen) return null;
  const t = (key: string) => getTranslation(language, `methodology.${key}`);
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="methodology-title" className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div>
            <h3 id="methodology-title" className="text-lg font-bold text-stone-900 flex gap-2 items-center"><BookOpen className="w-5 h-5 text-emerald-800" />{t('title')}</h3>
            <p className="text-xs text-stone-700">{t('subtitle')}</p>
          </div>
          <button aria-label={t('close')} onClick={() => setMethodologyModalOpen(false)} className="p-2 text-stone-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto py-5 space-y-4 text-sm text-stone-800 leading-relaxed">
          <h4 className="font-bold">{t('sourcesTitle')}</h4><p>{t('sources')}</p>
          <h4 className="font-bold">{t('rulesTitle')}</h4>
          <ul className="list-disc pl-5 space-y-3">{['families','nitrogen','soil','heat'].map(key => <li key={key}>{t(key)}</li>)}</ul>
          <h4 className="font-bold">{t('scenariosTitle')}</h4><p>{getTranslation(language,'dataQuality.scenarioInterpretation')}</p>
          <p className="p-3 bg-amber-50 text-amber-950 rounded-lg">{t('disclaimer')}</p>
        </div>
        <div className="pt-4 border-t border-stone-100 flex justify-end"><button onClick={() => setMethodologyModalOpen(false)} className="px-5 py-2 rounded-xl bg-emerald-900 text-white font-semibold">{t('understood')}</button></div>
      </div>
    </div>
  );
};
