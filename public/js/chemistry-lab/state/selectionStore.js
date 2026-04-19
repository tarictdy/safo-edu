import { getState, updateState } from './labStore.js';

export function selectItem(instanceId = '') {
  updateState((draft) => {
    draft.selectedItemId = instanceId;
    return draft;
  });
}

export function getSelectedItem(state = getState()) {
  return state.items.find((item) => item.instanceId === state.selectedItemId) || null;
}

export function clearSelection() {
  selectItem('');
}
