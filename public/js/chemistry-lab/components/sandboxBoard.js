import { loadPresetById } from '../api/chemistryLabApi.js';
import { deactivateGuide } from '../engine/GuideEngine.js';
import { getCatalogItem } from '../engine/ruleEngine.js';
import { applyPresetToSandbox, clearSandbox } from '../engine/sandboxEngine.js';
import { addJournalEntry } from '../state/historyStore.js';
import { getSelectedItem } from '../state/selectionStore.js';

let presetRoot = null;
let statusRoot = null;

export function initSandboxBoard({ presetContainer, statusContainer }) {
  presetRoot = presetContainer;
  statusRoot = statusContainer;

  presetRoot.addEventListener('click', async (event) => {
    const presetButton = event.target.closest('[data-preset-id]');
    if (presetButton) {
      try {
        const preset = await loadPresetById(presetButton.dataset.presetId);
        deactivateGuide();
        await applyPresetToSandbox(preset);
      } catch (error) {
        addJournalEntry(error.message || 'Impossible de charger ce preset.', 'error');
      }
      return;
    }

    const clearButton = event.target.closest('[data-clear-sandbox]');
    if (clearButton) {
      clearSandbox();
    }
  });
}

export function renderSandboxBoard(state) {
  if (!presetRoot || !statusRoot) return;

  const selectedItem = getSelectedItem(state);
  const selectedExperiment = state.catalog.experiments.find((experiment) => experiment.id === state.selectedExperimentId) || null;
  const selectedCatalogItem = selectedItem ? getCatalogItem(selectedItem.catalogId, state) : null;
  const contentCount = selectedItem?.state?.contents?.length || 0;
  const currentGuideStep = state.guide?.steps?.find((step) => step.status === 'active') || null;
  const selectedCopy = state.guide?.enabled
    ? `Guide actif: ${state.guide.title}. ${state.guide.isComplete ? 'Toutes les etapes sont terminees.' : `Etape en cours: ${currentGuideStep?.title || 'suivre le panneau guide'}.`}`
    : selectedCatalogItem
    ? `${selectedCatalogItem.name} selectionne${contentCount ? `, ${contentCount} produit(s)` : ''}.`
    : selectedExperiment
      ? `Experience active: ${selectedExperiment.titre}.`
      : 'Glisse un instrument dans le sandbox ou charge un preset.';

  statusRoot.textContent = selectedCopy;

  presetRoot.innerHTML = `
    ${state.catalog.presets.map((preset) => `
      <button class="preset-chip ${state.currentPresetId === preset.id ? 'is-active' : ''}" type="button" data-preset-id="${preset.id}">
        ${preset.title}
      </button>
    `).join('')}
    <button class="preset-chip" type="button" data-clear-sandbox="true">Vider</button>
  `;
}
