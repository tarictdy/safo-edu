import { setSearchTerm } from '../state/labStore.js';

let rootElement = null;
let inputElement = null;
let helperElement = null;

export function initSearchBar(root) {
  rootElement = root;
  rootElement.innerHTML = `
    <div class="panel-card search-shell">
      <label class="panel-label" for="lab-search-input">Recherche</label>
      <input id="lab-search-input" type="search" placeholder="Becher, HCl, bruleur..." autocomplete="off" />
      <p class="panel-copy" id="lab-search-helper">Recherche sur les objets physiques et les produits.</p>
    </div>
  `;

  inputElement = rootElement.querySelector('#lab-search-input');
  helperElement = rootElement.querySelector('#lab-search-helper');
  inputElement.addEventListener('input', () => setSearchTerm(inputElement.value.trim()));
}

export function renderSearchBar(state) {
  if (!rootElement || !helperElement || !inputElement) return;
  if (inputElement.value !== state.searchTerm) {
    inputElement.value = state.searchTerm;
  }

  helperElement.textContent = state.searchTerm
    ? `${state.catalog.items.length} objets, ${state.catalog.chemicals.length} produits, ${state.catalog.experiments.length} experiences disponibles.`
    : `Acces rapide: 5 appareils et 5 produits. Recherche pour reveler le reste.`;
}
