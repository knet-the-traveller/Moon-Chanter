export const en = {
  a11y: {
    skipToContent: 'Skip to main content',
    headerNav: 'Main navigation',
    languageSelector: 'Language selector'
  },
  nav: {
    home: 'Home',
    howItWorks: 'How It Works',
    cropGuides: 'Crop Guides',
    soilData: 'Soil Data',
    launchApp: 'Launch App →',
    comingSoon: 'Coming soon'
  },
  hero: {
    badge: 'SMART CROP & SOIL GUIDE',
    titleLine1: 'Plan Smarter Crop',
    titleLine2: 'Rotations with',
    titleLine3: 'Precision',
    description:
      'Match local soil, satellite weather, and your farm goals to build weather-tough, profitable seasonal rotations — in three simple steps.',
    startPlanning: 'Start Planning →',
    seeHowItWorks: 'See How It Works',
    imageAlt: 'Tiered agricultural crop fields and rice terraces under clear skies'
  },
  search: {
    townLabel: 'Select Town / Province',
    townPlaceholder: 'Select Town / Province',
    townAdvisory: 'Supported pilots · More areas coming soon',
    goalLabel: 'Primary Goal',
    goalPlaceholder: 'Primary Goal or Soil Type',
    findCrops: 'Find Crops →',
    goals: {
      soilHealth: 'Boost Soil Health & Nitrogen',
      waterResilience: 'Water & Drought Resilience',
      stableIncome: 'Maximize Stable Farm Income',
      lowInputCost: 'Lower Fertilizer & Input Costs',
      lowLabor: 'Manageable Labor Demand',
      climateRisk: 'Storm & Typhoon Toughness'
    }
  },
  why: {
    eyebrow: 'WHY ANITALA',
    title: 'Why AniTala Works for Philippine Farms',
    description:
      'We combine regional soil benchmarks, 10-year satellite climate records, and your own field observations so every recommendation fits your land, water, and budget.',
    climateBadgeValue: '10-Year',
    climateBadgeLabel: 'NASA Climate Record',
    exploreSoilData: 'Explore Soil Data',
    learnMore: 'Learn More →',
    imageAlt: 'Lush Philippine agricultural cropland showing diversified crop rows'
  },
  steps: {
    eyebrow: 'PLANNING STEPS',
    title: 'Three Simple Steps to Your Rotation Plan',
    step1: {
      number: '01 · Pin Your Field',
      description: 'Tap your farm on the map or pick your town to load local soil and climate data.',
      cta: 'Step 01 →',
      imageAlt: 'Agricultural field boundary map picker illustration'
    },
    step2: {
      number: '02 · Soil & Priorities',
      description: 'Confirm soil texture and pH, then slide your goals for profit, water and storm toughness.',
      cta: 'Step 02 →',
      imageAlt: 'Soil texture and pH testing telemetry illustration'
    },
    step3: {
      number: '03 · Seasonal Rotation',
      description: 'Get ranked Wet, Cool Dry and Hot Dry plans ready to print or share.',
      cta: 'Step 03 →',
      imageAlt: 'Seasonal diversified harvest and rotation recommendations illustration'
    }
  },
  footer: {
    brandName: 'AniTala',
    tagline: 'Simple Crop & Soil Guide · Built for Philippine Farmers',
    features: 'Regional Soil Benchmarks · Seasonal Climate Insights · Crop Rotation Planner',
    copyright: '© 2026 AniTala',
    siNotice:
      '✦ S.I. Transparency Notice: Visual assets, UI code scaffolding, and crop rotation ranking logic were developed with Synthetic Intelligence (S.I.) assistance using open Earth observation datasets.',
    siVersion: 'SI-Assisted Build · v1.0',
    dataCredit:
      'Utilizes open telemetry from the NASA POWER API (agroclimatology & meteorology) and NASA GIBS (Global Imagery Browse Services satellite imagery). This open-source decision-support tool was built for the 2026 NASA Space Apps Challenge and is not endorsed by or affiliated with NASA.'
  }
};

export type LandingTranslations = typeof en;
