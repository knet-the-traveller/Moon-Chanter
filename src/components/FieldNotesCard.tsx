import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { FileText } from 'lucide-react';

export const FieldNotesCard: React.FC = () => {
  const { fieldSizeHa, setFieldSizeHa, plotNotes, setPlotNotes, language } = useAppStore();

  return (
    <section
      className="bg-white rounded-2xl p-5 sm:p-6 border border-at-line shadow-sm"
      aria-labelledby="field-notes-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-at-line/50 gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-at-muted" aria-hidden="true" />
          <h3 id="field-notes-title" className="font-bold text-at-dk text-base sm:text-lg">
            {getTranslation(language, 'conditions.fieldNotesTitle')}
          </h3>
        </div>
        <span className="text-xs font-medium text-at-muted">
          {getTranslation(language, 'conditions.fieldNotesOptional')}
        </span>
      </div>

      <div className="size flex flex-wrap items-center gap-3 mt-4 text-xs sm:text-sm font-semibold text-at-dk">
        <span>{getTranslation(language, 'conditions.fieldSizeLabel')}</span>
        <label className="flex items-center justify-between w-48 h-10 border border-at-dk rounded-xl px-3 bg-white">
          <input
            name="fieldSizeHa"
            type="number"
            min="0"
            max="10000"
            step="0.1"
            value={fieldSizeHa ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              if (val === null || (!isNaN(val) && val >= 0 && val <= 10000)) {
                setFieldSizeHa(val);
              }
            }}
            placeholder="—"
            aria-label={getTranslation(language, 'conditions.fieldSizeLabel')}
            className="w-20 border-0 outline-hidden font-sans text-sm text-at-dk bg-transparent"
          />
          <small className="text-at-muted font-normal text-xs">
            {getTranslation(language, 'conditions.fieldSizeUnit')}
          </small>
        </label>
      </div>

      <textarea
        value={plotNotes}
        onChange={(e) => setPlotNotes(e.target.value)}
        onBlur={(e) => setPlotNotes(e.target.value.trim())}
        placeholder={getTranslation(language, 'conditions.plotNotesPlaceholder')}
        aria-label={getTranslation(language, 'conditions.fieldNotesTitle')}
        className="w-full h-20 bg-at-ow border border-at-line rounded-xl p-3 text-xs sm:text-sm text-at-dk placeholder:text-at-muted/60 resize-y mt-3 focus-visible:outline-2 focus-visible:outline-at-dk"
      />
    </section>
  );
};
