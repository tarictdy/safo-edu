import { uid } from '../data/localDefaults.js';
import { updateState } from './labStore.js';

const STORAGE_KEY = 'safio:chemistry-lab:diagnostics:v1';
const DIAGNOSTIC_LIMIT = 80;

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function persistDiagnostics(entries = []) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (_error) {
    // Ignore storage failures.
  }
}

function createDiagnosticEntry(message, options = {}) {
  return {
    id: uid('diag'),
    level: options.level || 'error',
    context: options.context || 'runtime',
    message: String(message || 'Erreur inconnue'),
    details: String(options.details || ''),
    time: new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };
}

export function hydrateDiagnostics() {
  const storage = getStorage();
  if (!storage) return;

  try {
    const rawEntries = storage.getItem(STORAGE_KEY);
    const entries = rawEntries ? JSON.parse(rawEntries) : [];
    updateState((draft) => {
      draft.diagnostics = Array.isArray(entries) ? entries.slice(0, DIAGNOSTIC_LIMIT) : [];
      return draft;
    });
  } catch (_error) {
    // Ignore malformed persisted data.
  }
}

export function pushDiagnosticEntry(message, options = {}) {
  const entry = createDiagnosticEntry(message, options);

  updateState((draft) => {
    draft.diagnostics = [entry, ...(draft.diagnostics || [])].slice(0, DIAGNOSTIC_LIMIT);
    persistDiagnostics(draft.diagnostics);
    return draft;
  });
}

export function clearDiagnostics() {
  updateState((draft) => {
    draft.diagnostics = [];
    persistDiagnostics([]);
    return draft;
  });
}

export function installGlobalDiagnosticHandlers() {
  if (typeof window === 'undefined' || window.__chemLabDiagnosticHandlersInstalled) {
    return;
  }

  window.__chemLabDiagnosticHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    pushDiagnosticEntry(event.message || 'Erreur JavaScript non capturee.', {
      context: 'window.error',
      details: `${event.filename || 'source inconnue'}:${event.lineno || 0}:${event.colno || 0}`
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = typeof reason === 'string'
      ? reason
      : reason?.message || 'Promesse rejetee sans gestionnaire.';

    pushDiagnosticEntry(message, {
      context: 'window.unhandledrejection',
      details: reason?.stack || ''
    });
  });
}
