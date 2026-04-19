import { deepClone } from '../data/localDefaults.js';
import { createItemInstance } from '../model/ItemInstance.js';
import { getState, replaceRuntime, updateState } from '../state/labStore.js';
import { getObject } from './CatalogManager.js';

function runtimeState(state) {
  return state || getState();
}

export function getNextZIndex(state = getState()) {
  return (runtimeState(state).items || []).reduce((max, item) => Math.max(max, item.zIndex || 1), 0) + 1;
}

export function getItemInstance(instanceId, state = getState()) {
  return runtimeState(state).items.find((entry) => entry.instanceId === instanceId) || null;
}

export function cloneRuntimeState(state = getState()) {
  return deepClone(runtimeState(state));
}

export function createRuntimeItem(catalogId, point, state = getState()) {
  const catalogObject = getObject(catalogId, state);
  if (!catalogObject) return null;
  return createItemInstance(catalogObject, point, state);
}

export function commitRuntimeState(nextState) {
  updateState(() => nextState);
}

export function replaceRuntimeState(runtimePatch) {
  replaceRuntime(runtimePatch);
}

export function addItemInstance(instance) {
  updateState((draft) => {
    draft.items.push(instance);
    draft.selectedItemId = instance.instanceId;
    return draft;
  });
}

export function removeItemInstance(instanceId) {
  updateState((draft) => {
    draft.items = draft.items.filter((entry) => entry.instanceId !== instanceId);
    draft.activeEffects = draft.activeEffects.filter((entry) => entry.targetInstanceId !== instanceId && entry.itemId !== instanceId);
    draft.renderInstructions = draft.renderInstructions.filter((entry) => entry.targetInstanceId !== instanceId);
    if (draft.selectedItemId === instanceId) {
      draft.selectedItemId = '';
    }
    return draft;
  });
}

export function updateItemInstance(instanceId, updater) {
  updateState((draft) => {
    const item = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return draft;
    updater(item, draft);
    return draft;
  });
}

export function clearExpiredEffects(now = Date.now()) {
  updateState((draft) => {
    draft.activeEffects = draft.activeEffects.filter((effect) => {
      const startedAt = Number(effect.startedAt || 0);
      const durationMs = Number(effect.durationMs || 0);
      return !startedAt || !durationMs || now < startedAt + durationMs;
    });
    draft.renderInstructions = draft.activeEffects.slice();
    return draft;
  });
}

