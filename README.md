# CVJFC Match Day App

A phone app for the CVJFC Under 8s coaches. It tracks playing time during
5-a-side matches and suggests who to bring on and off at each 10-minute stop.

- Everything stays on the phone: no server, no accounts, no analytics.
- Works offline after the first visit.
- Every tap is saved straight away, so a locked phone or closed tab never loses the game.

## For coaches: install on your phone

1. Open the link you were sent.
2. **iPhone (Safari):** tap the Share button, then **Add to Home Screen**.
   **Android (Chrome):** tap the ⋮ menu, then **Add to Home screen** / **Install app**.
3. Open it from the home screen icon from then on. Open it once with signal so it
   works offline at the ground.

## For developers

```bash
npm install
npm run dev       # local dev server
npm test          # rule tests (clock, suggestions, gating)
npm run build     # production build into dist/
```

Stack: Vite + TypeScript + Preact, `vite-plugin-pwa` for the manifest and service
worker, and the Baloo 2 font bundled locally (no Google Fonts calls).

| File | What it does |
|---|---|
| `src/clock.ts` | Timestamp-based clock, `settle()`, and auto-stop at 10/20/30/40 |
| `src/logic.ts` | Colour thresholds, suggested changes and tie-breaks, Approve/OFF NEXT gating |
| `src/store.ts` | App state; saves to localStorage on every action |
| `src/screens/` | Home, Live (Normal + Pitch View), Full Time Summary |
| `src/screenshot.ts` | Draws the summary PNG and shares or downloads it |

### Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and
publishes to GitHub Pages. One-time setup: in the repo, go to **Settings → Pages**
and set **Source** to **GitHub Actions**.

The site is unlisted (`noindex`). Never commit player names: the app only stores
them on each phone.
