import type { ImageSlotConfig } from '../types';

export const IMAGE_SLOTS: Record<ImageSlotConfig['id'], ImageSlotConfig> = {
  logo: {
    id: 'logo',
    devLabel: 'ANITALA LOGO',
    defaultGradient: 'linear-gradient(135deg, #bbf246 0%, #8db854 100%)',
    width: 600,
    height: 600,
    defaultSrc: `${import.meta.env.BASE_URL}images/landing/logo.png`
  },
  hero: {
    id: 'hero',
    devLabel: 'RICE TERRACE PHOTO',
    defaultGradient: 'linear-gradient(145deg, #284c28 0%, #3e6634 50%, #5d8a43 100%)',
    width: 640,
    height: 480,
    defaultSrc: '/images/landing/hero.jpg'
  },
  why: {
    id: 'why',
    devLabel: 'FARM PHOTO',
    defaultGradient: 'linear-gradient(135deg, #87ab5b 0%, #769e4f 50%, #5e843c 100%)',
    width: 580,
    height: 420,
    defaultSrc: '/images/landing/why.jpg'
  },
  step1: {
    id: 'step1',
    devLabel: 'FIELD MAP PHOTO',
    defaultGradient: 'linear-gradient(135deg, #a4cb69 0%, #8db854 100%)',
    width: 380,
    height: 220,
    defaultSrc: '/images/landing/step1.jpg'
  },
  step2: {
    id: 'step2',
    devLabel: 'SOIL PHOTO',
    defaultGradient: 'linear-gradient(135deg, #7da552 0%, #a2c86e 100%)',
    width: 380,
    height: 220,
    defaultSrc: '/images/landing/step2.jpg'
  },
  step3: {
    id: 'step3',
    devLabel: 'HARVEST PHOTO',
    defaultGradient: 'linear-gradient(135deg, #4f9ec4 0%, #6ab79e 50%, #8ec56f 100%)',
    width: 380,
    height: 220,
    defaultSrc: '/images/landing/step3.jpg'
  }
};
