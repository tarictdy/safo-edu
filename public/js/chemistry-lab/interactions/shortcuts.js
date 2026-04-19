import { runAction } from '../engine/actionEngine.js';
import { removeItem } from '../engine/sandboxEngine.js';
import { getState } from '../state/labStore.js';
import { clearSelection } from '../state/selectionStore.js';
import { rotateSelectedItem } from './rotate.js';
import { tiltSelectedItem } from './pour.js';

function isTypingContext(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
}

export function initShortcuts() {
  window.addEventListener('keydown', async (event) => {
    if (isTypingContext(event.target)) return;

    const state = getState();
    if (!state.selectedItemId && !['Escape'].includes(event.key)) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      removeItem(state.selectedItemId);
      return;
    }

    if (event.key === 'Escape') {
      clearSelection();
      return;
    }

    if (event.key.toLowerCase() === 'r') {
      await rotateSelectedItem();
    }

    if (event.key.toLowerCase() === 't') {
      await tiltSelectedItem();
    }

    if (event.key.toLowerCase() === 's') {
      await runAction('stir');
    }

    if (event.key.toLowerCase() === 'h') {
      await runAction('heat');
    }
  });
}
