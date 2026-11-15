# AniTala Landing Page Assets & Architecture Guide

This directory contains the intro (landing) page for **AniTala** (Smart Crop & Soil Guide), designed for Filipino farmers and agricultural extension workers for the 2026 NASA Space Apps Challenge.

---

## 1. Directory Structure

```
src/landing/
├── AniTalaLanding.tsx          # Main landing page component with semantic landmarks
├── types.ts                   # Landing page TypeScript types & contracts
├── components/
│   ├── LandingHeader.tsx      # Sticky header with navigation, language toggle, & Launch App CTA
│   ├── LandingHero.tsx        # Deep-green hero with contour SVG background and value prop
│   ├── SearchPill.tsx         # Preselection pill for municipality and primary farmer goal
│   ├── WhySection.tsx         # "Why AniTala" section with 10-year NASA climate badge
│   ├── StepsSection.tsx       # "Three Simple Steps" section with 3 actionable cards
│   ├── LandingFooter.tsx      # High-contrast dark footer with S.I. transparency & NASA open data notice
│   └── LandingImage.tsx       # Responsive image component supporting local assets & fallback gradients
├── config/
│   ├── nav.ts                 # Header navigation items and feature flags
│   └── images.ts              # Image slot configurations and fallback gradients
├── i18n/
│   ├── en.ts                  # Canonical English copy dictionary
│   ├── tl.ts                  # Natural Tagalog/Filipino copy dictionary (`needsReview: true`)
│   └── index.ts               # Translation helper and language mapper (`'tl'` <-> `'fil'`)
└── README.md                  # This file
```

---

## 2. Image Asset Specifications

When real photographs are added, place them in `public/images/landing/` using modern WebP formats (or optimized JPEG/PNG) matching the slot dimensions below:

| Slot ID | Asset Path | Recommended Dimensions | Aspect Ratio | Subject Matter / Description |
| :--- | :--- | :--- | :--- | :--- |
| `hero-bg` | `/images/landing/hero-bg.jpg`<br>`hero-bg-desktop.webp`<br>`hero-bg-mobile.webp` | 2400 × 975 px (desktop)<br>900 × 365 px (mobile) | ~2.46:1 | Rolling green terraced fields with pale rising sun. Full-bleed decorative background with `alt=""`, `aria-hidden="true"`, and high fetch priority (`fetchPriority="high"`). Provenance: Pending user confirmation on S.I.-generated status. |
| `logo` | `/images/landing/logo.png` | 600 × 600 px (rendered 36×36 in header, 28×28 in footer) | 1:1 | AniTala pictorial brand emblem (star, sprout, terraced fields) |
| `hero` | `/images/landing/hero-rice-terrace.webp` | 800 × 500 px | 16:10 | Tiered agricultural rice terraces or green Philippine fields under clear daylight |
| `why` | `/images/landing/why-farm.webp` | 800 × 550 px | ~4:3 / 16:11 | Lush, diversified crop rows showing healthy soil and thriving crops |
| `step1` | `/images/landing/step1-field-map.webp` | 600 × 400 px | 3:2 | Agricultural field boundary selection on satellite map |
| `step2` | `/images/landing/step2-soil-priorities.webp` | 600 × 400 px | 3:2 | Field soil texture inspection and agronomic parameter testing |
| `step3` | `/images/landing/step3-harvest.webp` | 600 × 400 px | 3:2 | Bountiful seasonal crop rotation harvest (rice, legumes, corn) |

### Fallback Gradients & Dev Labels
If an image file is not present at the specified path, `LandingImage` gracefully falls back to an accessible CSS gradient matching the Figma prototype colors (`#658a43` to `#8ba65a`, etc.) and displays a developer placeholder label in non-production environments.

---

## 3. Routing & State Flow

- **Zero-Dependency Routing**: AniTala uses hash-based routing (`window.location.hash`).
  - Default route (empty, `#`, or other hash): Renders `<AniTalaLanding />`.
  - App route (`#/app`): Renders `<App />` (AniTala).
- **State Preselection Guard**:
  - The `"Find Crops →"` button on the `SearchPill` is the **only** trigger that preselects state (`selectPilotPreset` and `setPriority(goalKey, 80)`).
  - All other buttons (`"Launch App →"`, `"Start Planning →"`, `"Explore Soil Data"`, and `"Step 01–03 →"`) are clean links (`href="#/app"`) that preserve existing user selections in `useAppStore`.
- **Bilingual Parity**:
  - English (`en`) and Filipino/Tagalog (`tl` mapping to `fil` in `useAppStore`).
  - Language selection is synchronized bi-directionally between the landing page and the AniTala store.
