import { loadPresetById } from '../api/chemistryLabApi.js';
import { activateGuideForExperiment, deactivateGuide } from '../engine/GuideEngine.js';
import { applyPresetToSandbox } from '../engine/sandboxEngine.js';
import { addJournalEntry } from '../state/historyStore.js';
import { setCurriculumFilter, setSelectedExperiment } from '../state/labStore.js';

let rootElement = null;
const DEFAULT_EXPERIMENT_LIMIT = 8;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function matchesSearch(state, experiment) {
  const searchTerm = normalizeText(state.searchTerm);
  if (!searchTerm) return true;

  return [
    experiment.titre,
    experiment.niveau,
    experiment.lecon,
    experiment.objectifPedagogique,
    experiment.theme,
    ...(experiment.reactifs || []),
    ...(experiment.instruments || [])
  ].some((value) => normalizeText(value).includes(searchTerm));
}

function getLevelLabel(levelId, state) {
  return state.catalog.curriculum?.[levelId]?.title || levelId;
}

function resolvePresetId(experiment, state) {
  const candidateId = experiment.presetId || experiment.id || '';
  if (!candidateId) return '';

  return (state.catalog.presets || []).some((preset) => preset.id === candidateId)
    ? candidateId
    : '';
}

function getAvailabilityLabel(availability, canOpen) {
  if (canOpen || availability === 'implemented') return 'jouable';
  if (availability === 'guided') return 'guide';
  return 'planifie';
}

function getAvailabilityVariant(availability, canOpen) {
  if (canOpen) return 'implemented';
  return availability || 'planned';
}

export function initCurriculumPanel(root) {
  rootElement = root;

  rootElement.addEventListener('click', async (event) => {
    const filterButton = event.target.closest('[data-level-filter]');
    if (filterButton) {
      setCurriculumFilter(filterButton.dataset.levelFilter);
      return;
    }

    const experimentButton = event.target.closest('[data-experiment-id]');
    if (!experimentButton) return;

    const experimentId = experimentButton.dataset.experimentId;
    const presetId = experimentButton.dataset.experimentPreset || '';
    const experimentMode = experimentButton.dataset.experimentMode || 'open';
    const experimentTitle = experimentButton.dataset.experimentTitle || experimentId;

    setSelectedExperiment(experimentId);

    if (!presetId) {
      addJournalEntry('Experience selectionnee. Aucun preset interactif n est encore disponible pour celle-ci.', 'info');
      return;
    }

    try {
      const preset = await loadPresetById(presetId);
      if (experimentMode === 'guide') {
        await applyPresetToSandbox(preset, {
          runInitialContents: false,
          runDemoSequence: false,
          successMessage: `Montage guide charge: ${preset.title}.`
        });
        activateGuideForExperiment(experimentId, presetId);
      } else {
        deactivateGuide();
        await applyPresetToSandbox(preset, {
          clearGuide: false
        });
      }
      setSelectedExperiment(experimentId);
      addJournalEntry(
        experimentMode === 'guide'
          ? `Guide applique: ${experimentTitle}.`
          : `Experience chargee: ${experimentTitle}.`,
        'success'
      );
    } catch (error) {
      addJournalEntry(error.message || 'Impossible de charger ce preset.', 'error');
    }
  });
}

export function renderCurriculumPanel(state) {
  if (!rootElement) return;

  const levelEntries = Object.entries(state.catalog.curriculum || {});
  const filter = state.curriculumFilter || 'all';
  const filteredExperiments = (state.catalog.experiments || []).filter((experiment) => {
    const levelMatches = filter === 'all' || experiment.niveau === filter;
    return levelMatches && matchesSearch(state, experiment);
  });
  const searchActive = Boolean(state.searchTerm);
  const experiments = (!searchActive && filter === 'all')
    ? filteredExperiments.slice(0, DEFAULT_EXPERIMENT_LIMIT)
    : filteredExperiments;
  const hiddenCount = Math.max(0, filteredExperiments.length - experiments.length);

  rootElement.innerHTML = `
    <div class="panel-card">
      <h3>Programme et experiences</h3>
      <p class="panel-copy">Entree par niveau, lecon et experience. Toute carte avec preset ouvre directement le montage dans le sandbox.</p>
      <div class="chip-list chip-list--filters">
        <button type="button" class="filter-chip ${filter === 'all' ? 'is-active' : ''}" data-level-filter="all">Tout</button>
        ${levelEntries.map(([levelId, level]) => `
          <button type="button" class="filter-chip ${filter === levelId ? 'is-active' : ''}" data-level-filter="${levelId}">
            ${level.title}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="catalog-list">
      ${experiments.map((experiment) => {
        const presetId = resolvePresetId(experiment, state);
        const canOpen = Boolean(presetId);
        const availabilityVariant = getAvailabilityVariant(experiment.availability, canOpen);

        return `
          <article class="experiment-card ${state.selectedExperimentId === experiment.id ? 'is-selected' : ''}">
            <div class="experiment-card__head">
              <div>
                <div class="experiment-card__eyebrow">${getLevelLabel(experiment.niveau, state)} - ${experiment.lecon}</div>
                <h4 class="experiment-card__title">${experiment.titre}</h4>
              </div>
              <span class="experiment-card__badge experiment-card__badge--${availabilityVariant}">${getAvailabilityLabel(experiment.availability, canOpen)}</span>
            </div>
            <p class="experiment-card__objective">${experiment.objectifPedagogique}</p>
            <div class="experiment-card__meta">
              <span>${experiment.reactionModel?.type || 'experience'}</span>
              <span>${experiment.safetyLevel}</span>
            </div>
            <p class="experiment-card__note">${canOpen ? 'Montage direct, demo auto et guide pas a pas disponibles.' : 'Fiche pedagogique seule pour le moment.'}</p>
            <div class="experiment-card__actions">
              <button
                type="button"
                class="lab-btn ${canOpen ? 'is-primary' : ''}"
                data-experiment-id="${experiment.id}"
                data-experiment-preset="${presetId}"
                data-experiment-availability="${experiment.availability || 'planned'}"
                data-experiment-title="${experiment.titre}"
                data-experiment-mode="open"
              >
                ${canOpen ? 'Ouvrir dans le labo' : 'Voir la fiche'}
              </button>
              ${canOpen ? `
                <button
                  type="button"
                  class="lab-btn"
                  data-experiment-id="${experiment.id}"
                  data-experiment-preset="${presetId}"
                  data-experiment-title="${experiment.titre}"
                  data-experiment-mode="guide"
                >
                  Appliquer le guide
                </button>
              ` : ''}
            </div>
          </article>
        `;
      }).join('') || '<div class="status-banner">Aucune experience pour ce filtre.</div>'}
    </div>
    ${hiddenCount ? `<p class="catalog-note">${hiddenCount} autre(s) experience(s) sont masquees. Utilise un filtre ou la recherche pour les afficher.</p>` : ''}
  `;
}
