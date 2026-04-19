# Chemistry Lab Debug Log

## 2026-04-06

### Issue
- Console runtime error: `TypeError: Cannot read properties of undefined (reading 'reduce')`
- Source: `public/js/chemistry-lab/engine/ReactionEvaluator.js`
- Symptom: after placing objects in the sandbox, actions like `Ajouter`, `Tourner`, `Incliner`, `Remuer` and several guided preset steps stopped working because the action pipeline crashed before commit.

### Root Cause
- `ReactionEvaluator` expected `reactionProfiles` from `getCatalogCollections(nextState)`.
- `CatalogManager.getCatalogCollections()` did not expose `reactionProfiles`, so `reactionProfiles` became `undefined` and `.reduce()` crashed.

### Fix Applied
- Added `reactionProfiles` to `getCatalogCollections()` in `public/js/chemistry-lab/engine/CatalogManager.js`.
- Added a defensive fallback in `public/js/chemistry-lab/engine/ReactionEvaluator.js`:
  - `const { reactions = [], reactionProfiles = [] } = getCatalogCollections(nextState);`

### Extra Debug Instrumentation
- Added runtime diagnostic capture with persistence in:
  - `public/js/chemistry-lab/state/diagnosticsStore.js`
- Global handlers now record:
  - `window.error`
  - `window.unhandledrejection`
- Action pipeline and preset sequence now push diagnostics when exceptions occur:
  - `public/js/chemistry-lab/engine/actionEngine.js`
  - `public/js/chemistry-lab/engine/sandboxEngine.js`
- Diagnostics are now visible in the lab journal UI:
  - `public/js/chemistry-lab/renderer/journalRenderer.js`
  - `public/js/chemistry-lab/components/experimentJournal.js`

### Notes
- This log is intended to keep a persistent trace of major chemistry-lab engine issues and applied fixes across debugging sessions.

### Follow-up UI and Content Pass
- Added a dedicated free sandbox page:
  - `public/chemistry-lab-free.html`
  - `public/js/chemistry-lab/app-free.js`
- Corrected quick placement logic in `public/js/chemistry-lab/components/catalogPanel.js`:
  - container / heater / support placement now keys off `item.type` instead of `item.subType`
- Reworked liquid rendering in:
  - `public/js/chemistry-lab/renderer/liquidRenderer.js`
  - `public/css/chemistry-lab/chemistry-lab-effects.css`
  - goal: stronger color readability with gradients, highlights, lower shadow and surface ripple
- Expanded the playable experiment catalog:
  - added `neutralisation_simple`
  - added `precipitation_solution_sels`
  - promoted multiple preset-backed experiments from planned to implemented
- Added a matching preset and curriculum wiring:
  - `storage/chemistry-lab/manifests/presets.json`
  - `storage/chemistry-lab/manifests/curriculum.json`
- Adjusted several chemical and reaction color values to improve contrast without making the lab look cartoonish.

### Apparatus Expansion Pass
- Added new glassware and apparatus entries in `storage/chemistry-lab/manifests/objects.json`:
  - `round_bottom_flask_250ml`
  - `boiling_tube_large`
  - `burette_50ml`
  - `separatory_funnel_250ml`
  - `watch_glass_small`
  - `hotplate_basic`
  - `wash_bottle_lab`
  - `conductivity_meter_basic`
- Added corresponding SVG assets under:
  - `storage/chemistry-lab/svg/glassware/`
  - `storage/chemistry-lab/svg/equipment/`
  - `storage/chemistry-lab/svg/instruments/`
- Upgraded the realism of:
  - `storage/chemistry-lab/svg/equipment/voltmeter.svg`
  - `storage/chemistry-lab/svg/instruments/ph-meter.svg`
- Extended functional sensor rendering:
  - voltmeter now shows a live digital value and mode label
  - pH meter now shows a computed pH when immersed in a container
  - conductivity meter now shows a computed conductivity value when immersed
- Engine hooks added in:
  - `public/js/chemistry-lab/engine/ReactionEvaluator.js`
  - `public/js/chemistry-lab/renderer/effectRenderer.js`
  - `public/js/chemistry-lab/components/itemInspector.js`
  - `public/js/chemistry-lab/engine/SpatialEngine.js`
