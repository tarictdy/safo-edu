import { validateSandboxAction } from '../api/chemistryLabApi.js';
import { addJournalEntry } from '../state/historyStore.js';
import { getState, updateState } from '../state/labStore.js';
import { getCatalogItem, getChemicalById } from './ruleEngine.js';

function blendHexColors(colors = []) {
  if (!colors.length) return '#99d7ff';

  const totals = colors.reduce((accumulator, color) => {
    const normalized = String(color).replace('#', '');
    if (normalized.length !== 6) return accumulator;
    accumulator.red += parseInt(normalized.slice(0, 2), 16);
    accumulator.green += parseInt(normalized.slice(2, 4), 16);
    accumulator.blue += parseInt(normalized.slice(4, 6), 16);
    accumulator.count += 1;
    return accumulator;
  }, { red: 0, green: 0, blue: 0, count: 0 });

  if (!totals.count) return '#99d7ff';

  const toHex = (value) => Math.round(value / totals.count).toString(16).padStart(2, '0');
  return `#${toHex(totals.red)}${toHex(totals.green)}${toHex(totals.blue)}`;
}

export function getTotalVolume(contents = []) {
  return contents.reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
}

function getContentsColor(contents, state) {
  const colors = contents
    .map((entry) => getChemicalById(entry.chemicalId, state)?.color)
    .filter(Boolean);
  return blendHexColors(colors);
}

export async function addChemicalToItem(instanceId, chemicalId, requestedVolumeMl) {
  const state = getState();
  const item = state.items.find((entry) => entry.instanceId === instanceId);
  const chemical = getChemicalById(chemicalId, state);

  if (!item || !chemical) return null;

  const validation = await validateSandboxAction({
    actionId: 'add-chemical',
    item,
    chemicalId
  });

  if (!validation.valid) {
    addJournalEntry(validation.message || 'Ajout refuse.', 'error');
    return null;
  }

  const catalogItem = getCatalogItem(item.catalogId, state);
  const capacity = Number(catalogItem?.capacityMl || 0);
  const currentVolume = getTotalVolume(item.state.contents || []);
  const remainingVolume = capacity ? Math.max(capacity - currentVolume, 0) : 0;

  if (capacity && remainingVolume <= 0) {
    addJournalEntry(`Le recipient ${catalogItem.name} est deja plein.`, 'warning');
    return null;
  }

  const desiredVolume = Number(requestedVolumeMl || chemical.defaultVolumeMl || 10);
  const volumeMl = capacity ? Math.min(desiredVolume, remainingVolume) : desiredVolume;

  updateState((draft) => {
    const target = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!target) return draft;

    const existing = target.state.contents.find((entry) => entry.chemicalId === chemicalId);
    if (existing) {
      existing.volumeMl += volumeMl;
    } else {
      target.state.contents.push({ chemicalId, volumeMl });
    }

    target.state.lastAction = 'add-chemical';
    target.state.visual.liquidColor = getContentsColor(target.state.contents, draft);
    target.state.visual.bubbles = false;
    target.state.visual.precipitate = false;
    target.state.visual.flash = false;
    return draft;
  });

  addJournalEntry(`${chemical.formula} ajoute dans ${catalogItem.name} (${Math.round(volumeMl)} mL).`, 'info');
  return getState().items.find((entry) => entry.instanceId === instanceId) || null;
}

export function emptyContainer(instanceId) {
  const state = getState();
  const item = state.items.find((entry) => entry.instanceId === instanceId);
  if (!item) return;

  updateState((draft) => {
    const target = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!target) return draft;
    target.state.contents = [];
    target.state.lastAction = 'empty';
    target.state.reactionId = '';
    target.state.visual = {
      ...target.state.visual,
      liquidColor: '#99d7ff',
      bubbles: false,
      steam: false,
      precipitate: false,
      flash: false
    };
    draft.activeEffects = draft.activeEffects.filter((effect) => effect.itemId !== instanceId);
    return draft;
  });

  addJournalEntry(`${getCatalogItem(item.catalogId, state)?.name || 'Recipient'} vide.`, 'warning');
}
