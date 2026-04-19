import { runAction } from '../engine/actionEngine.js';
import { removeItem } from '../engine/sandboxEngine.js';
import { getAvailableActionsForItem, getCompatibleChemicalsForItem, isContainerItem } from '../engine/ruleEngine.js';
import { resolveActionTargetItem } from '../engine/SpatialEngine.js';
import { getState } from '../state/labStore.js';
import { getSelectedItem } from '../state/selectionStore.js';

let rootElement = null;

const chemicalSelectionByItem = new Map();
const DEFAULT_CHEMICAL_LIMIT = 8;
const SEARCH_CHEMICAL_LIMIT = 16;
const PRIORITY_CHEMICALS = ['h2o', 'hcl', 'naoh', 'cuso4', 'agno3', 'znso4'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function matchesSearch(searchTerm, chemical) {
  if (!searchTerm) return true;
  return [
    chemical.name,
    chemical.formula,
    chemical.id,
    chemical.category
  ].some((value) => normalizeText(value).includes(searchTerm));
}

function sortChemicals(entries, requiredChemicalIds) {
  return [...entries].sort((left, right) => {
    const leftRequired = requiredChemicalIds.has(left.id) ? 0 : 1;
    const rightRequired = requiredChemicalIds.has(right.id) ? 0 : 1;
    if (leftRequired !== rightRequired) return leftRequired - rightRequired;

    const leftPriority = PRIORITY_CHEMICALS.includes(left.id) ? PRIORITY_CHEMICALS.indexOf(left.id) : Number.MAX_SAFE_INTEGER;
    const rightPriority = PRIORITY_CHEMICALS.includes(right.id) ? PRIORITY_CHEMICALS.indexOf(right.id) : Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    return String(left.name || left.id).localeCompare(String(right.name || right.id), 'fr');
  });
}

function getSelectedChemicalIds(instanceId, allowedChemicalIds = null) {
  const selectedIds = chemicalSelectionByItem.get(instanceId) || [];
  if (!allowedChemicalIds) return [...selectedIds];
  return selectedIds.filter((chemicalId) => allowedChemicalIds.has(chemicalId));
}

function toggleChemicalSelection(instanceId, chemicalId, checked) {
  const currentSelection = new Set(chemicalSelectionByItem.get(instanceId) || []);
  if (checked) {
    currentSelection.add(chemicalId);
  } else {
    currentSelection.delete(chemicalId);
  }

  if (currentSelection.size) {
    chemicalSelectionByItem.set(instanceId, Array.from(currentSelection));
  } else {
    chemicalSelectionByItem.delete(instanceId);
  }
}

function getVisibleChemicals(selectedItem, state) {
  const chemicals = getCompatibleChemicalsForItem(selectedItem, state);
  const selectedExperiment = (state.catalog.experiments || []).find((experiment) => experiment.id === (state.currentExperimentId || state.selectedExperimentId)) || null;
  const requiredChemicalIds = new Set(selectedExperiment?.requiredChemicals || selectedExperiment?.reactifs || []);
  const searchTerm = normalizeText(state.searchTerm);
  const filteredChemicals = chemicals.filter((chemical) => matchesSearch(searchTerm, chemical));
  const searchFallbackUsed = Boolean(searchTerm) && !filteredChemicals.length;
  const sortedChemicals = sortChemicals(searchFallbackUsed ? chemicals : filteredChemicals, requiredChemicalIds);
  const limit = searchTerm ? SEARCH_CHEMICAL_LIMIT : DEFAULT_CHEMICAL_LIMIT;
  const visibleChemicals = sortedChemicals.slice(0, limit);
  const allowedChemicalIds = new Set(chemicals.map((chemical) => chemical.id));
  const selectedChemicalIds = getSelectedChemicalIds(selectedItem.instanceId, allowedChemicalIds);
  if (selectedChemicalIds.length) {
    chemicalSelectionByItem.set(selectedItem.instanceId, selectedChemicalIds);
  } else {
    chemicalSelectionByItem.delete(selectedItem.instanceId);
  }
  const chemicalIndex = (state.catalog.chemicals || []).reduce((index, chemical) => {
    index[chemical.id] = chemical;
    return index;
  }, {});

  return {
    visibleChemicals,
    hiddenCount: Math.max(0, sortedChemicals.length - limit),
    selectedExperiment,
    searchFallbackUsed,
    selectedChemicalIds,
    selectedChemicals: selectedChemicalIds
      .map((chemicalId) => chemicalIndex[chemicalId] || visibleChemicals.find((chemical) => chemical.id === chemicalId))
      .filter(Boolean)
  };
}

export function initActionPanel(root) {
  rootElement = root;

  rootElement.addEventListener('change', (event) => {
    const chemicalCheckbox = event.target.closest('[data-chemical-checkbox]');
    if (!chemicalCheckbox) return;
    const state = getState();
    const selectedItem = getSelectedItem(state);
    if (!selectedItem) return;
    const actionContextItem = resolveActionTargetItem(selectedItem, 'add_chemical', state) || selectedItem;
    toggleChemicalSelection(actionContextItem.instanceId, chemicalCheckbox.dataset.chemicalCheckbox, chemicalCheckbox.checked);
    renderActionPanel(state);
  });

  rootElement.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action-id]');
    if (actionButton) {
      await runAction(actionButton.dataset.actionId);
      return;
    }

    const chemicalApplyButton = event.target.closest('[data-chemical-apply]');
    if (chemicalApplyButton) {
      const state = getState();
      const selectedItem = getSelectedItem(state);
      if (!selectedItem) return;
      const actionContextItem = resolveActionTargetItem(selectedItem, 'add_chemical', state) || selectedItem;
      const chemicalIds = getSelectedChemicalIds(actionContextItem.instanceId);
      if (!chemicalIds.length) return;
      for (const chemicalId of chemicalIds) {
        await runAction('add-chemical', { chemicalId });
      }
      return;
    }

    const removeButton = event.target.closest('[data-remove-item]');
    if (removeButton) {
      chemicalSelectionByItem.delete(removeButton.dataset.removeItem);
      removeItem(removeButton.dataset.removeItem);
    }
  });
}

export function renderActionPanel(state) {
  if (!rootElement) return;

  const selectedItem = getSelectedItem(state);
  if (!selectedItem) {
    rootElement.innerHTML = `
      <div class="panel-card">
        <h3>Actions</h3>
        <p class="panel-copy">Selectionne un objet du sandbox pour afficher les actions disponibles.</p>
      </div>
    `;
    return;
  }

  const actionContextItem = resolveActionTargetItem(selectedItem, 'add_chemical', state) || selectedItem;
  const actions = getAvailableActionsForItem(actionContextItem, state).filter((action) => {
    const normalizedId = String(action.canonicalId || action.id || '').replace(/-/g, '_');
    return normalizedId !== 'add_chemical';
  });
  const {
    visibleChemicals,
    hiddenCount,
    selectedExperiment,
    searchFallbackUsed,
    selectedChemicalIds,
    selectedChemicals
  } = getVisibleChemicals(actionContextItem, state);
  const alertsMarkup = (state.alerts || []).map((alert) => `
    <div class="status-banner ${alert.level === 'error' ? 'is-error' : ''}">${alert.message}</div>
  `).join('');
  const actionContextLabel = actionContextItem.instanceId !== selectedItem.instanceId ? 'Actions appliquees au recipient lie.' : 'Action directe sur l objet selectionne. Les blocages du moteur s affichent ici.';

  rootElement.innerHTML = `
    <div class="panel-card">
      <h3>Actions</h3>
      <p class="action-copy">${actionContextLabel}</p>
      ${alertsMarkup}
      <div class="action-grid">
        ${actions.map((action) => `
          <button class="lab-btn ${action.id === 'heat' ? 'is-warning' : ''}" type="button" data-action-id="${action.id}">
            ${action.label}
          </button>
        `).join('')}
      </div>
    </div>
    ${isContainerItem(actionContextItem, state) ? `
      <div class="panel-card">
        <h3>Ajouter un produit</h3>
        <p class="panel-copy">${searchFallbackUsed
          ? 'La recherche en haut ne cible aucun produit. Une liste utile reste affichee.'
          : selectedExperiment
            ? `Coche un ou plusieurs produits prioritaires pour ${selectedExperiment.titre}.`
            : 'Coche un ou plusieurs produits ci-dessous, puis clique sur Ajouter au recipient.'}</p>
        <div class="chemical-picker" role="group" aria-label="Produits chimiques compatibles">
          ${visibleChemicals.map((chemical) => `
            <label class="chem-chip ${selectedChemicalIds.includes(chemical.id) ? 'is-selected' : ''}" title="${chemical.name}">
              <input
                type="checkbox"
                data-chemical-checkbox="${chemical.id}"
                ${selectedChemicalIds.includes(chemical.id) ? 'checked' : ''}
              />
              <span class="chem-chip__check" aria-hidden="true"></span>
              <span class="chem-chip__content">
                <span class="chem-chip__formula-row">
                  <span class="catalog-swatch" style="background:${chemical.color};"></span>
                  <strong>${chemical.formula}</strong>
                </span>
                <span class="chem-chip__name">${chemical.name}</span>
              </span>
            </label>
          `).join('') || '<div class="status-banner">Aucun produit correspondant au filtre courant.</div>'}
        </div>
        <div class="panel-inline-actions">
          <p class="panel-copy">Selection: <strong>${selectedChemicals.length ? selectedChemicals.map((chemical) => chemical.name).join(', ') : 'aucun produit'}</strong></p>
          <button
            class="lab-btn is-primary"
            type="button"
            data-chemical-apply="selected"
            ${selectedChemicalIds.length ? '' : 'disabled'}
          >
            Ajouter la selection
          </button>
        </div>
        ${hiddenCount ? `<p class="catalog-note">${hiddenCount} autre(s) produit(s) sont masques. Utilise la recherche en haut de page pour filtrer.</p>` : ''}
      </div>
    ` : ''}
    <div class="panel-card">
      <h3>Gestion</h3>
      <button class="lab-btn is-danger" type="button" data-remove-item="${selectedItem.instanceId}">Retirer du sandbox</button>
    </div>
  `;
}
