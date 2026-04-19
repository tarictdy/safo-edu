import { renderJournal } from '../renderer/journalRenderer.js';

let rootElement = null;

export function initExperimentJournal(root) {
  rootElement = root;
}

export function renderExperimentJournal(state) {
  if (!rootElement) return;
  renderJournal(rootElement, state.history, state.diagnostics || []);
}
