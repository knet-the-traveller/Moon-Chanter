import React, { useState } from 'react';
import type { LandingLanguage } from '../types';
import type { FarmerPriorities } from '../../types';
import { PILOT_LOCATIONS } from '../../data/pilotLocations';
import { useAppStore } from '../../store/useAppStore';
import { getLandingTranslation } from '../i18n';

interface SearchPillProps {
  language: LandingLanguage;
}

const GOAL_KEYS: Array<keyof FarmerPriorities> = [
  'soilHealth',
  'waterResilience',
  'stableIncome',
  'lowInputCost',
  'lowLabor',
  'climateRisk'
];

export const SearchPill: React.FC<SearchPillProps> = ({ language }) => {
  const t = getLandingTranslation(language);
  const [selectedTownId, setSelectedTownId] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('');

  const handleFindCrops = () => {
    // Only "Find Crops" preselects state
    if (selectedTownId) {
      const pilot = PILOT_LOCATIONS.find((p) => p.id === selectedTownId);
      if (pilot) {
        useAppStore.getState().selectPilotPreset(pilot);
      }
    }

    if (selectedGoal && GOAL_KEYS.includes(selectedGoal as keyof FarmerPriorities)) {
      // Elevate selected goal priority to 80 while leaving others intact
      useAppStore.getState().setPriority(selectedGoal as keyof FarmerPriorities, 80);
    }

    // Navigate to FieldShift app
    window.location.hash = '#/app';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 -mt-8 relative z-20">
      <div className="bg-[#e4efcd] p-2 sm:p-2.5 rounded-3xl sm:rounded-full shadow-lg border border-[#c8e29a]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Select Town / Province */}
          <div className="flex-1 bg-white rounded-2xl sm:rounded-full px-4 py-2 sm:py-2.5 flex items-center gap-3 border border-stone-200/60 shadow-xs focus-within:ring-2 focus-within:ring-[#1b432a]">
            {/* Map Pin Icon */}
            <svg
              className="w-5 h-5 text-[#2d5a39] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <label htmlFor="town-select" className="sr-only">
                {t.search.townLabel}
              </label>
              <select
                id="town-select"
                value={selectedTownId}
                onChange={(e) => setSelectedTownId(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-[#142d1f] focus:outline-none cursor-pointer truncate"
              >
                <option value="">{t.search.townPlaceholder}</option>
                {PILOT_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}, {loc.province}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Goal */}
          <div className="flex-1 bg-white rounded-2xl sm:rounded-full px-4 py-2 sm:py-2.5 flex items-center gap-3 border border-stone-200/60 shadow-xs focus-within:ring-2 focus-within:ring-[#1b432a]">
            {/* Target / Compass Icon */}
            <svg
              className="w-5 h-5 text-[#2d5a39] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            </svg>
            <div className="flex-1 min-w-0">
              <label htmlFor="goal-select" className="sr-only">
                {t.search.goalLabel}
              </label>
              <select
                id="goal-select"
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-[#142d1f] focus:outline-none cursor-pointer truncate"
              >
                <option value="">{t.search.goalPlaceholder}</option>
                {GOAL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t.search.goals[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleFindCrops}
            className="sm:w-auto w-full px-6 py-3 sm:py-2.5 rounded-2xl sm:rounded-full bg-[#1D3309] hover:bg-[#152506] active:bg-[#0e1904] text-white text-sm font-semibold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D3309]"
          >
            <span>{t.search.findCrops}</span>
          </button>
        </div>
      </div>
      {/* Pilot Scope Advisory note */}
      <p className="text-center text-[11px] text-[#425a40] mt-1.5 font-medium">
        {t.search.townAdvisory}
      </p>
    </div>
  );
};
