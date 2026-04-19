import { addItemFromCatalog } from '../engine/sandboxEngine.js';
import { getState } from '../state/labStore.js';

let rootElement = null;

const QUICK_OBJECT_LIMIT = 5;
const QUICK_CHEMICAL_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 12;
const PRIORITY_OBJECTS = [
  'beaker_250ml',
  'test_tube_standard',
  'erlenmeyer_250ml',
  'bunsen_burner_basic',
  'pipette_basic',
  'ph_meter_basic',
  'conductivity_meter_basic',
  'hotplate_basic',
  'round_bottom_flask_250ml',
  'graduated_cylinder_100ml'
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function matchesSearch(state, values = []) {
  const searchTerm = normalizeText(state.searchTerm);
  if (!searchTerm) return true;
  return values.some((value) => normalizeText(value).includes(searchTerm));
}

function sortByPriority(items = []) {
  return [...items].sort((left, right) => {
    const leftRank = PRIORITY_OBJECTS.indexOf(left.id);
    const rightRank = PRIORITY_OBJECTS.indexOf(right.id);
    const normalizedLeft = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
    const normalizedRight = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;
    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
    return String(left.name || left.id).localeCompare(String(right.name || right.id), 'fr');
  });
}

function getQuickAddPoint(item, state) {
  const boardWidth = Number(state.board?.width || 960);
  const boardHeight = Number(state.board?.height || 640);
  const existingContainers = (state.items || []).filter((entry) => entry.type === 'container');
  const existingTools = (state.items || []).filter((entry) => entry.type === 'tool' || entry.type === 'sensor' || entry.type === 'electrode' || entry.type === 'connector');
  const placement = item.defaultPlacement || { width: 120, height: 120 };

  if (item.type === 'container') {
    const containerIndex = existingContainers.length;
    const col = containerIndex % 3;
    const row = Math.floor(containerIndex / 3);
    return {
      x: Math.min(140 + (col * 190), boardWidth - placement.width - 30),
      y: Math.min(130 + (row * 110), boardHeight - placement.height - 50)
    };
  }

  if (item.type === 'heater') {
    const anchorContainer = existingContainers[existingContainers.length - 1];
    if (anchorContainer) {
      return {
        x: Math.max(20, Math.min(anchorContainer.x + Math.round((anchorContainer.width - placement.width) / 2), boardWidth - placement.width - 20)),
        y: Math.max(20, Math.min(anchorContainer.y + anchorContainer.height + 26, boardHeight - placement.height - 20))
      };
    }
    return {
      x: 170,
      y: Math.max(30, boardHeight - placement.height - 70)
    };
  }

  if (item.type === 'support') {
    return {
      x: Math.max(20, boardWidth - placement.width - 110),
      y: 120
    };
  }

  const toolIndex = existingTools.length % 5;
  return {
    x: Math.max(20, boardWidth - placement.width - 40),
    y: Math.min(90 + (toolIndex * 86), boardHeight - placement.height - 30)
  };
}

function renderItemCard(item) {
  return `
    <article class="catalog-card" draggable="true" data-catalog-id="${item.id}">
      <div class="catalog-card__thumb">
        <img src="${item.asset}" alt="${item.name}" />
      </div>
      <div>
        <div class="catalog-card__head">
          <h4 class="catalog-card__title">${item.name}</h4>
          <span class="catalog-card__tag">${item.type}</span>
        </div>
        <div class="catalog-card__meta">${item.subType || item.category}</div>
        <div class="catalog-card__tags">
          ${item.capacityMl ? `<span class="catalog-card__tag">${item.capacityMl} mL</span>` : ''}
          ${item.acceptsHeat ? '<span class="catalog-card__tag">heat</span>' : ''}
          ${item.acceptsChemicals ? '<span class="catalog-card__tag">mix</span>' : ''}
        </div>
        <div class="catalog-card__actions">
          <button class="lab-btn is-primary" type="button" data-catalog-add="${item.id}">Ajouter</button>
          <span class="catalog-card__hint">ou glisser</span>
        </div>
      </div>
    </article>
  `;
}

function renderChemicalCard(chemical) {
  return `
    <article class="catalog-card is-chemical">
      <div>
        <div class="catalog-card__head">
          <h4 class="catalog-card__title">${chemical.name}</h4>
          <span class="catalog-card__tag">${chemical.formula}</span>
        </div>
        <div class="catalog-card__meta">${chemical.category}</div>
        <div class="catalog-card__tags">
          <span class="catalog-card__tag"><span class="catalog-swatch" style="background:${chemical.color};"></span>${chemical.defaultVolumeMl} mL</span>
          <span class="catalog-card__tag">${chemical.dangerLevel}</span>
        </div>
      </div>
    </article>
  `;
}

export function initCatalogPanel(root) {
  rootElement = root;

  rootElement.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-catalog-add]');
    if (!addButton) return;
    const state = getState();
    const catalogItem = state.catalog.items.find((entry) => entry.id === addButton.dataset.catalogAdd);
    addItemFromCatalog(addButton.dataset.catalogAdd, getQuickAddPoint(catalogItem || {}, state));
  });
}

export function renderCatalogPanel(state) {
  if (!rootElement) return;

  const searchActive = Boolean(state.searchTerm);
  const matchedItems = sortByPriority(state.catalog.items.filter((item) => matchesSearch(state, [
    item.name,
    item.id,
    item.type,
    item.subType,
    item.category
  ])));

  const matchedChemicals = state.catalog.chemicals.filter((chemical) => matchesSearch(state, [
    chemical.name,
    chemical.id,
    chemical.formula,
    chemical.category
  ]));

  const visibleItems = searchActive ? matchedItems.slice(0, SEARCH_RESULT_LIMIT) : matchedItems.slice(0, QUICK_OBJECT_LIMIT);
  const visibleChemicals = searchActive ? matchedChemicals.slice(0, SEARCH_RESULT_LIMIT) : matchedChemicals.slice(0, QUICK_CHEMICAL_LIMIT);

  const hiddenItemCount = Math.max(0, matchedItems.length - visibleItems.length);
  const hiddenChemicalCount = Math.max(0, matchedChemicals.length - visibleChemicals.length);

  rootElement.innerHTML = `
    <section class="catalog-section">
      <div class="panel-card">
        <h3>Objets physiques</h3>
        <p class="panel-copy">${searchActive ? 'Resultats de recherche affiches progressivement.' : '5 appareils en acces rapide pour eviter le scroll long. Utilise la recherche pour les autres.'}</p>
      </div>
      <div class="catalog-list catalog-list--compact">${visibleItems.map(renderItemCard).join('') || '<div class="status-banner">Aucun objet trouve.</div>'}</div>
      ${hiddenItemCount ? `<p class="catalog-note">${hiddenItemCount} autre(s) appareil(s) caches. Tape par exemple phmetre, conductivimetre, burette, hotplate, voltmetre ou entonnoir pour les afficher.</p>` : ''}
    </section>
    <section class="catalog-section">
      <div class="panel-card">
        <h3>Produits chimiques</h3>
        <p class="panel-copy">Les produits s ajoutent depuis le panneau d actions quand un recipient est selectionne.</p>
      </div>
      <div class="catalog-list catalog-list--compact">${visibleChemicals.map(renderChemicalCard).join('') || '<div class="status-banner">Aucun produit trouve.</div>'}</div>
      ${hiddenChemicalCount && !searchActive ? `<p class="catalog-note">${hiddenChemicalCount} autre(s) produit(s) sont disponibles via la recherche.</p>` : ''}
    </section>
  `;
}
