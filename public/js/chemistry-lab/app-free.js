import { fetchCatalog } from './api/chemistryLabApi.js';
import { initActionPanel, renderActionPanel } from './components/actionPanel.js';
import { initCatalogPanel, renderCatalogPanel } from './components/catalogPanel.js';
import { initExperimentJournal, renderExperimentJournal } from './components/experimentJournal.js';
import { initItemInspector, renderItemInspector } from './components/itemInspector.js';
import { initSearchBar, renderSearchBar } from './components/searchBar.js';
import { clearSandbox } from './engine/sandboxEngine.js';
import { getCatalogItem } from './engine/ruleEngine.js';
import { hydrateDiagnostics, installGlobalDiagnosticHandlers } from './state/diagnosticsStore.js';
import { addJournalEntry } from './state/historyStore.js';
import { initializeCatalog, setStatus, subscribe } from './state/labStore.js';
import { getSelectedItem } from './state/selectionStore.js';
import { initDragDrop } from './interactions/dragDrop.js';
import { initSelection } from './interactions/selection.js';
import { initShortcuts } from './interactions/shortcuts.js';
import { initSandboxRenderer, renderSandbox } from './renderer/sandboxRenderer.js';

const searchRoot = document.getElementById('searchBar');
const catalogRoot = document.getElementById('catalogPanel');
const boardRoot = document.getElementById('sandboxBoard');
const boardStatusRoot = document.getElementById('boardStatus');
const clearButton = document.getElementById('clearFreeSandbox');
const actionRoot = document.getElementById('actionPanel');
const inspectorRoot = document.getElementById('itemInspector');
const journalRoot = document.getElementById('experimentJournal');

function renderBoardStatus(state) {
  if (!boardStatusRoot) return;

  const selectedItem = getSelectedItem(state);
  if (selectedItem) {
    const catalogItem = getCatalogItem(selectedItem.catalogId, state);
    const contentsCount = selectedItem.state?.contents?.length || 0;
    boardStatusRoot.textContent = catalogItem
      ? `${catalogItem.name} selectionne${contentsCount ? `, ${contentsCount} contenu(s)` : ''}.`
      : 'Objet selectionne dans le bac a sable.';
    return;
  }

  const itemCount = state.items?.length || 0;
  boardStatusRoot.textContent = itemCount
    ? `${itemCount} objet(s) dans le bac a sable. Selectionne un recipient pour agir dessus.`
    : 'Ajoute des objets, selectionne un recipient et manipule librement tes montages.';
}

function renderApp(state) {
  renderSearchBar(state);
  renderCatalogPanel(state);
  renderSandbox(state);
  renderBoardStatus(state);
  renderItemInspector(state);
  renderActionPanel(state);
  renderExperimentJournal(state);
}

async function bootstrap() {
  hydrateDiagnostics();
  installGlobalDiagnosticHandlers();

  initSearchBar(searchRoot);
  initCatalogPanel(catalogRoot);
  initItemInspector(inspectorRoot);
  initActionPanel(actionRoot);
  initExperimentJournal(journalRoot);
  initSandboxRenderer(boardRoot);

  initDragDrop({ catalogRoot, boardRoot });
  initSelection(boardRoot);
  initShortcuts();

  clearButton?.addEventListener('click', () => {
    clearSandbox();
    addJournalEntry('Le bac a sable libre a ete vide.', 'info');
  });

  subscribe(renderApp);

  try {
    setStatus('loading');
    addJournalEntry('Chargement du mode libre du laboratoire...', 'info');
    const catalog = await fetchCatalog();
    initializeCatalog(catalog);
    addJournalEntry('Mode libre pret. Tu peux construire ton montage sans guide.', 'success');
  } catch (error) {
    setStatus('error', error.message || 'Impossible de charger le laboratoire.');
    addJournalEntry(error.message || 'Impossible de charger le laboratoire.', 'error');
  }
}

bootstrap();
