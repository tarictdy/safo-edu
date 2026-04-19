import { addJournalEntry } from '../state/historyStore.js';
import { pushDiagnosticEntry } from '../state/diagnosticsStore.js';
import { getState, replaceRuntime, updateState } from '../state/labStore.js';
import { selectItem } from '../state/selectionStore.js';
import { createLabStatePatch } from '../model/LabState.js';
import {
  addItemInstance,
  createRuntimeItem,
  getItemInstance,
  getNextZIndex,
  removeItemInstance,
  replaceRuntimeState
} from './StateManager.js';
import { deactivateGuide } from './GuideEngine.js';
import { syncSpatialLayout } from './SpatialEngine.js';
import { getItemLabel } from './ruleEngine.js';

const presetSequenceTimers = new Set();

function clearPresetSequenceTimers() {
  presetSequenceTimers.forEach((timerId) => window.clearTimeout(timerId));
  presetSequenceTimers.clear();
}

function schedulePresetStep(callback, delayMs = 0) {
  const timerId = window.setTimeout(async () => {
    presetSequenceTimers.delete(timerId);
    try {
      await callback();
    } catch (error) {
      pushDiagnosticEntry(error.message || 'Erreur pendant une etape de preset.', {
        context: 'preset-sequence',
        details: error.stack || ''
      });
      addJournalEntry('Une etape automatique du preset a echoue.', 'error');
    }
  }, Math.max(0, Number(delayMs || 0)));
  presetSequenceTimers.add(timerId);
}

async function schedulePresetSequence(preset, instanceKeyMap) {
  const { runAction } = await import('./actionEngine.js');
  const initialContents = Array.isArray(preset.initialContents) ? preset.initialContents : [];
  const demoSequence = Array.isArray(preset.demoSequence) ? preset.demoSequence : [];

  initialContents.forEach((step) => {
    const instanceId = instanceKeyMap[step.instanceKey];
    if (!instanceId) return;
    schedulePresetStep(async () => {
      await runAction('add-chemical', {
        instanceId,
        chemicalId: step.chemicalId,
        volumeMl: step.volumeMl
      });
    }, step.delayMs);
  });

  demoSequence.forEach((step) => {
    const instanceId = step.instanceKey ? instanceKeyMap[step.instanceKey] : '';
    const sourceInstanceId = step.sourceInstanceKey ? instanceKeyMap[step.sourceInstanceKey] : '';
    const targetInstanceId = step.targetInstanceKey ? instanceKeyMap[step.targetInstanceKey] : '';
    schedulePresetStep(async () => {
      if (step.kind === 'journal' || step.message) {
        addJournalEntry(step.message || '', step.level || 'info');
        return;
      }

      await runAction(step.actionId, {
        instanceId,
        sourceInstanceId,
        targetInstanceId,
        chemicalId: step.chemicalId,
        volumeMl: step.volumeMl,
        ...(step.payload || {})
      });
    }, step.delayMs);
  });
}

export function instantiateCatalogItem(catalogId, point = { x: 120, y: 140 }, state = getState()) {
  return createRuntimeItem(catalogId, point, state);
}

export function addItemFromCatalog(catalogId, point) {
  const state = getState();
  const instance = instantiateCatalogItem(catalogId, point, state);
  if (!instance) return null;

  addItemInstance(instance);
  updateState((draft) => {
    syncSpatialLayout(draft.items, draft);
    return draft;
  });
  addJournalEntry(`${getItemLabel(instance, getState())} place dans le sandbox.`, 'info');
  return instance;
}

export function moveItem(instanceId, point) {
  updateState((draft) => {
    const item = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return draft;
    const deltaX = Math.round(point.x) - Number(item.x || 0);
    const deltaY = Math.round(point.y) - Number(item.y || 0);
    item.x = Math.round(point.x);
    item.y = Math.round(point.y);
    item.parentContainerId = '';
    item.zIndex = getNextZIndex(draft);
    draft.items
      .filter((entry) => entry.parentContainerId === instanceId)
      .forEach((child) => {
        child.x += deltaX;
        child.y += deltaY;
      });
    draft.items
      .filter((entry) => String(entry.attachedTo || '').includes(instanceId))
      .forEach((child) => {
        child.x += deltaX;
        child.y += deltaY;
      });
    syncSpatialLayout(draft.items, draft);
    return draft;
  });
}

export function bringItemToFront(instanceId) {
  updateState((draft) => {
    const item = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return draft;
    item.zIndex = getNextZIndex(draft);
    return draft;
  });
}

export function rotateItem(instanceId, delta = 20) {
  updateState((draft) => {
    const item = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return draft;
    item.rotation = (item.rotation + delta) % 360;
    item.state.lastAction = 'rotate';
    return draft;
  });
}

export function removeItem(instanceId) {
  const item = getItemInstance(instanceId);
  if (!item) return;
  removeItemInstance(instanceId);
  addJournalEntry(`${getItemLabel(item, getState())} retire du sandbox.`, 'warning');
}

export function clearSandbox() {
  clearPresetSequenceTimers();
  deactivateGuide();
  const patch = createLabStatePatch({
    items: [],
    selectedItemId: '',
    currentExperimentId: '',
    activeEffects: [],
    renderInstructions: [],
    alerts: []
  });

  replaceRuntimeState({
    ...patch,
    selectedExperimentId: '',
    currentPresetId: ''
  });
  addJournalEntry('Sandbox reinitialise.', 'warning');
}

export async function applyPresetToSandbox(preset, options = {}) {
  clearPresetSequenceTimers();
  const {
    runInitialContents = true,
    runDemoSequence = true,
    successMessage = `Preset charge: ${preset.title}.`,
    clearGuide = false
  } = options;

  if (clearGuide) {
    deactivateGuide();
  }

  const state = getState();
  const instanceKeyMap = {};
  const placementState = {
    ...state,
    items: []
  };
  const instances = (preset.initialLayout || [])
    .map((entry) => {
      const instance = instantiateCatalogItem(entry.itemId, { x: entry.x, y: entry.y }, placementState);
      if (instance && entry.instanceKey) {
        instance.instanceKey = entry.instanceKey;
        instanceKeyMap[entry.instanceKey] = instance.instanceId;
      }
      if (instance) {
        placementState.items.push(instance);
      }
      return instance;
    })
    .filter(Boolean);

  syncSpatialLayout(instances, {
    ...state,
    items: instances
  });

  replaceRuntime({
    items: instances,
    selectedItemId: instances[0]?.instanceId || '',
    selectedExperimentId: preset.experimentId || '',
    currentExperimentId: preset.experimentId || '',
    currentPresetId: preset.id,
    activeEffects: [],
    renderInstructions: [],
    alerts: []
  });

  const selectedInstanceId = instanceKeyMap.reactor || instances[0]?.instanceId || '';
  selectItem(selectedInstanceId);
  addJournalEntry(successMessage, 'success');

  if ((runInitialContents && preset.initialContents?.length) || (runDemoSequence && preset.demoSequence?.length)) {
    addJournalEntry('Demonstration automatique en cours...', 'info');
    await schedulePresetSequence({
      ...preset,
      initialContents: runInitialContents ? preset.initialContents : [],
      demoSequence: runDemoSequence ? preset.demoSequence : []
    }, instanceKeyMap);
  }
}
