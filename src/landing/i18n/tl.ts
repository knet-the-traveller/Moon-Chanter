import type { LandingTranslations } from './en';

export const tl: LandingTranslations & { needsReview: true } = {
  needsReview: true,
  a11y: {
    skipToContent: 'Laktawan patungo sa pangunahing nilalaman',
    headerNav: 'Pangunahing nabigasyon',
    languageSelector: 'Pagpipilian ng wika'
  },
  nav: {
    home: 'Tahanan',
    howItWorks: 'Paano Gumagana',
    cropGuides: 'Gabay sa Pananim',
    soilData: 'Datos ng Lupa',
    launchApp: 'Buksan ang App →',
    comingSoon: 'Paparating pa lamang'
  },
  hero: {
    badge: 'MATALINONG GABAY SA PANANIM AT LUPA',
    titleLine1: 'Planuhin ang Mas Matalinong',
    titleLine2: 'Salit-Pananim nang',
    titleLine3: 'May Katiyakan',
    description:
      'Itugma ang lokal na lupa, lagay ng panahon mula sa satelayt, at iyong mga layunin sa bukid upang makabuo ng matatag at kapaki-pakinabang na salit-pananim — sa tatlong simpleng hakbang.',
    startPlanning: 'Simulan ang Pagpaplano →',
    seeHowItWorks: 'Tingnan Paano Gumagana →',
    imageAlt: 'Hagdan-hagdang palayan at lupang sakahan sa ilalim ng maaliwalas na kalangitan'
  },
  search: {
    townLabel: 'Pumili ng Bayan / Lalawigan',
    townPlaceholder: 'Pumili ng Bayan / Lalawigan',
    townAdvisory: 'Mga suportadong pilot area · Karagdagang lugar paparating',
    goalLabel: 'Pangunahing Layunin',
    goalPlaceholder: 'Pangunahing Layunin o Uri ng Lupa',
    findCrops: 'Maghanap ng Pananim →',
    goals: {
      soilHealth: 'Pabuting Kalusugan ng Lupa at Nitrogen',
      waterResilience: 'Katatagan sa Tagtuyot at Tubig',
      stableIncome: 'Matatag na Kita sa Pagsasaka',
      lowInputCost: 'Mababang Gastos sa Abono at Gamit',
      lowLabor: 'Magaang Pangangailangan sa Paggawa',
      climateRisk: 'Katatagan sa Bagyo at Masamang Panahon'
    }
  },
  why: {
    eyebrow: 'BAKIT ANITALA',
    title: 'Bakit Mabisa ang AniTala para sa mga Sakahang Pilipino',
    description:
      'Pinagsasama namin ang mga panrehiyong batayan ng lupa, 10-taong tala ng klima mula sa satelayt, at inyong sariling pagmamasid sa bukid upang ang bawat rekomendasyon ay akma sa inyong lupa, patubig, at badyet.',
    climateBadgeValue: '10-Taon',
    climateBadgeLabel: 'Tala ng Klima ng NASA',
    exploreSoilData: 'Suriin ang Datos ng Lupa',
    learnMore: 'Alamin Pa →',
    imageAlt: 'Sariwang sakahang Pilipino na nagpapakita ng iba-ibang hanay ng pananim'
  },
  steps: {
    eyebrow: 'MGA HAKBANG SA PAGPAPLANO',
    title: 'Tatlong Simpleng Hakbang sa Inyong Plano sa Pagsasaka',
    step1: {
      number: '01 · Ituro ang Inyong Bukid',
      description: 'Pindutin ang inyong bukid sa mapa o piliin ang bayan upang maikarga ang lokal na datos ng lupa at klima.',
      cta: 'Hakbang 01 →',
      imageAlt: 'Ilustrasyon ng pagpili ng hangganan ng bukid sa mapa'
    },
    step2: {
      number: '02 · Lupa at mga Priyoridad',
      description: 'Kumpirmahin ang tekstura at pH ng lupa, pagkatapos ay itakda ang inyong mga layunin sa kita, tubig, at katatagan sa bagyo.',
      cta: 'Hakbang 02 →',
      imageAlt: 'Ilustrasyon ng pagsusuri sa tekstura at asididad ng lupa'
    },
    step3: {
      number: '03 · Salitang Pananim ayon sa Panahon',
      description: 'Tumanggap ng pinagsunod-sunod na mga plano para sa Tag-ulan, Malamig na Tag-araw, at Mainit na Tag-araw na handang i-print o ibahagi.',
      cta: 'Hakbang 03 →',
      imageAlt: 'Ilustrasyon ng sari-saring ani at rekomendasyon sa salitang pananim'
    }
  },
  footer: {
    brandName: 'AniTala',
    tagline: 'Simpleng Gabay sa Pananim at Lupa · Nilikha para sa mga Magsasakang Pilipino',
    features: 'Panrehiyong Batayan ng Lupa · Papanahong Kaalaman sa Klima · Tagaplano ng Salitang Pananim',
    copyright: '© 2026 AniTala',
    siNotice:
      'S.I. Transparency Notice: Visual assets, UI code scaffolding, at crop rotation ranking logic ay binuo sa tulong ng Synthetic Intelligence (S.I.) gamit ang bukas na datos ng Earth observation.',
    siVersion: 'SI-Assisted Build · v1.0',
    dataCredit:
      'Gumagamit ng bukas na telemetriya mula sa NASA POWER API (agroklimatolohiya at meteorolohiya) at NASA GIBS (imaheng satelayt mula sa Global Imagery Browse Services). Ang proyektong ito ay nilikha para sa 2026 NASA Space Apps Challenge at hindi inindorso o kaanib ng NASA.'
  }
};
