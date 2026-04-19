import { clearSelection, selectItem } from '../state/selectionStore.js';

export function initSelection(boardRoot) {
  boardRoot.addEventListener('click', (event) => {
    const itemElement = event.target.closest('.sandbox-item');
    if (!itemElement) {
      clearSelection();
      return;
    }

    selectItem(itemElement.dataset.instanceId);
  });
}
