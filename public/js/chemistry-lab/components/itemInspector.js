import { formatVolume } from '../data/localDefaults.js';
import { getObject } from '../engine/CatalogManager.js';
import { getParentContainer } from '../engine/SpatialEngine.js';
import { getCatalogItem, getChemicalById } from '../engine/ruleEngine.js';
import { getSelectedItem } from '../state/selectionStore.js';

let rootElement = null;

export function initItemInspector(root) {
  rootElement = root;
}

export function renderItemInspector(state) {
  if (!rootElement) return;

  const selectedItem = getSelectedItem(state);
  if (!selectedItem) {
    rootElement.innerHTML = `
      <div class="panel-card">
        <h3>Inspecteur</h3>
        <p class="panel-copy">Aucun objet selectionne.</p>
      </div>
    `;
    return;
  }

  const catalogItem = getCatalogItem(selectedItem.catalogId, state);
  const objectItem = getObject(selectedItem.catalogId, state);
  const parentContainer = getParentContainer(selectedItem, state);
  const parentCatalogItem = parentContainer ? getCatalogItem(parentContainer.catalogId, state) : null;
  const measurementRows = [];

  if (objectItem?.subType === 'voltmeter') {
    measurementRows.push(`<div class="inspector-row"><span>Tension</span><span>${selectedItem.state.visual.meterValue || '-'}</span></div>`);
  }

  if (objectItem?.subType === 'ph_meter') {
    measurementRows.push(`<div class="inspector-row"><span>Mesure pH</span><span>${selectedItem.state.visual.phValue || '-'}</span></div>`);
  }

  if (objectItem?.subType === 'conductivity_meter') {
    const conductivityLabel = selectedItem.state.visual.conductivityValue
      ? `${selectedItem.state.visual.conductivityValue} ${selectedItem.state.visual.conductivityUnit || ''}`.trim()
      : '-';
    measurementRows.push(`<div class="inspector-row"><span>Conductivite</span><span>${conductivityLabel}</span></div>`);
  }

  rootElement.innerHTML = `
    <div class="panel-card item-inspector">
      <h3>${catalogItem?.name || selectedItem.catalogId}</h3>
      <div class="item-inspector__stats">
        <div class="inspector-row"><span>Type</span><span>${catalogItem?.type || '-'}</span></div>
        ${parentCatalogItem ? `<div class="inspector-row"><span>Dans</span><span>${parentCatalogItem.name}</span></div>` : ''}
        <div class="inspector-row"><span>Rotation</span><span>${Math.round(selectedItem.rotation)} deg</span></div>
        <div class="inspector-row"><span>Temperature</span><span>${Math.round(selectedItem.state.temperature || 24)} C</span></div>
        <div class="inspector-row"><span>Volume</span><span>${formatVolume(selectedItem.state.contents || [])}</span></div>
        ${measurementRows.join('')}
      </div>
      <div class="item-inspector__contents">
        ${(selectedItem.state.contents || []).map((entry) => `
          <div class="inspector-row"><span>${getChemicalById(entry.chemicalId, state)?.formula || entry.chemicalId}</span><span>${Math.round(entry.volumeMl)} mL</span></div>
        `).join('') || '<p class="panel-copy">Aucun contenu.</p>'}
      </div>
    </div>
  `;
}
