import { fetchCatalog } from './api/chemistryLabApi.js';
import { initActionPanel, renderActionPanel } from './components/actionPanel.js';
import { initCatalogPanel, renderCatalogPanel } from './components/catalogPanel.js';
import { initCurriculumPanel, renderCurriculumPanel } from './components/curriculumPanel.js';
import { initExperimentJournal, renderExperimentJournal } from './components/experimentJournal.js';
import { initGuidePanel, renderGuidePanel } from './components/guidePanel.js';
import { initItemInspector, renderItemInspector } from './components/itemInspector.js';
import { initSandboxBoard, renderSandboxBoard } from './components/sandboxBoard.js';
import { initSearchBar, renderSearchBar } from './components/searchBar.js';
import { initTutorialPanel, renderTutorialPanel } from './components/tutorialPanel.js';
import { hydrateDiagnostics, installGlobalDiagnosticHandlers } from './state/diagnosticsStore.js';
import { addJournalEntry } from './state/historyStore.js';
import { initializeCatalog, setStatus, subscribe } from './state/labStore.js';
import { initDragDrop } from './interactions/dragDrop.js';
import { initSelection } from './interactions/selection.js';
import { initShortcuts } from './interactions/shortcuts.js';
import { initSandboxRenderer, renderSandbox } from './renderer/sandboxRenderer.js';

const searchRoot = document.getElementById('searchBar');
const tutorialRoot = document.getElementById('tutorialPanel');
const curriculumRoot = document.getElementById('curriculumPanel');
const catalogRoot = document.getElementById('catalogPanel');
const boardRoot = document.getElementById('sandboxBoard');
const boardStatusRoot = document.getElementById('boardStatus');
const presetRoot = document.getElementById('presetPanel');
const actionRoot = document.getElementById('actionPanel');
const guideRoot = document.getElementById('guidePanel');
const inspectorRoot = document.getElementById('itemInspector');
const journalRoot = document.getElementById('experimentJournal');

function renderApp(state) {
  renderSearchBar(state);
  renderTutorialPanel(state);
  renderCurriculumPanel(state);
  renderCatalogPanel(state);
  renderSandboxBoard(state);
  renderSandbox(state);
  renderItemInspector(state);
  renderActionPanel(state);
  renderGuidePanel(state);
  renderExperimentJournal(state);
}

async function bootstrap() {
  hydrateDiagnostics();
  installGlobalDiagnosticHandlers();

  initSearchBar(searchRoot);
  initTutorialPanel(tutorialRoot);
  initCurriculumPanel(curriculumRoot);
  initCatalogPanel(catalogRoot);
  initSandboxBoard({ presetContainer: presetRoot, statusContainer: boardStatusRoot });
  initItemInspector(inspectorRoot);
  initActionPanel(actionRoot);
  initGuidePanel(guideRoot);
  initExperimentJournal(journalRoot);
  initSandboxRenderer(boardRoot);

  initDragDrop({ catalogRoot, boardRoot });
  initSelection(boardRoot);
  initShortcuts();

  subscribe(renderApp);

  try {
    setStatus('loading');
    addJournalEntry('Chargement du catalogue laboratoire...', 'info');
    const catalog = await fetchCatalog();
    initializeCatalog(catalog);
    addJournalEntry('Catalogue charge. Le sandbox est pret.', 'success');
  } catch (error) {
    setStatus('error', error.message || 'Impossible de charger le laboratoire.');
    addJournalEntry(error.message || 'Impossible de charger le laboratoire.', 'error');
  }
}

bootstrap();
