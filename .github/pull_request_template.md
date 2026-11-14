## Summary

<!-- Briefly describe what this PR changes, why, and which problem it solves. -->

Closes #

---

## Type of change

- [ ] 🚀 Feature (new user-facing functionality or pilot capability)
- [ ] 🐛 Fix (bug resolution, UI glitch, or broken calculation)
- [ ] 🌾 Agronomic Engine / Scoring (changes to `src/engine/` rules or multipliers)
- [ ] 🛰️ Telemetry & API (NASA POWER, SoilGrids, or GIBS layer integration)
- [ ] 📝 Documentation / Chore (rules, guides, dependency updates)
- [ ] 🧪 Tests / CI (new test suites or GitHub Actions workflows)

---

## Screenshots (UI changes)

<!-- Paste before/after or relevant UI screenshots here. Use representative pilot coordinates. -->

---

## Data & Agronomic Engine

- [ ] No engine or scoring logic modified
- [ ] Modifies crop rotation recommendation engine (`src/engine/`):
  - [ ] Every rule modification cites explicit rule IDs (e.g. `[AGRO-RULE-*]`)
  - [ ] Validated with corresponding unit tests in `src/tests/`
- [ ] Modifies external API telemetry (`src/services/`):
  - [ ] Implements resilient fallback hierarchy (Live $\to$ Cache $\to$ Bundled sample)
  - [ ] Preserves 7-day persistent `localStorage` / IndexedDB caching
- [ ] Pre-bundled sample datasets (`public/sample-data/`) validated and uncorrupted

---

## AI involvement

- [ ] Not AI-generated (100% human-authored)
- [ ] AI-assisted or generated (Agent: ____________)
  - [ ] I have reviewed and verified every changed line of code and documentation
  - [ ] Output complies strictly with `AGENTS.md` and repository guidelines

---

## Quality gates checklist

- [ ] `npm test` passes locally (100% pass across Vitest test suites)
- [ ] `npm run lint` (Oxlint) passes with zero errors
- [ ] `npx tsc -b` (strict TypeScript check) and `npm run build` pass with zero errors
- [ ] No API keys, secret tokens, or private credentials committed
- [ ] **Non-Prescriptive Mandate:** Recommendations present glass-box evidence and satellite uncertainty disclosures (never rigid "do not plant" commands)
- [ ] **Bilingual Parity:** All newly added UI strings are registered in both `src/i18n/en.json` and `src/i18n/fil.json`
- [ ] **Outdoor Usability:** UI maintains high sunlight contrast (WCAG AA) on mobile viewports (360px+)

---

## How to test

<!-- Provide step-by-step instructions to verify this change locally. -->
<!-- Refer to docs/LOCAL_TESTING_GUIDE.md for visual and mobile simulation workflows. -->

1. Checkout this branch and run `npm install`.
2. Start the local dev server: `npm run dev`.
3. Open `http://localhost:5173/` and navigate to:
4. Verify:
