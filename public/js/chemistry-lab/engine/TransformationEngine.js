import { deepClone } from '../data/localDefaults.js';
import { createContentEntry } from '../model/ContentEntry.js';
import { getChemical, getObject, normalizeActionId } from './CatalogManager.js';

export function getTotalVolume(contents = []) {
  return contents.reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
}

function blendHexColors(colors = []) {
  if (!colors.length) return '#99d7ff';

  const totals = colors.reduce((accumulator, color) => {
    const normalized = String(color || '').replace('#', '');
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

function getChemicalProfile(chemicalId, state) {
  return getChemical(chemicalId, state);
}

function getBlendOpacity(contents = [], state) {
  const entries = contents
    .map((entry) => getChemicalProfile(entry.chemicalId, state)?.opacity)
    .filter((value) => typeof value === 'number');

  if (!entries.length) return 0.82;
  return entries.reduce((sum, value) => sum + value, 0) / entries.length;
}

function getViscosity(contents = [], state) {
  const profiles = contents.map((entry) => getChemicalProfile(entry.chemicalId, state)).filter(Boolean);
  if (profiles.some((chemical) => chemical.category === 'organic' || chemical.id.includes('oil') || chemical.id.includes('savon'))) return 0.8;
  if (profiles.some((chemical) => chemical.state === 'powder' || chemical.state === 'solid')) return 0.62;
  return 0.28;
}

function getMixState(contents = [], state) {
  const profiles = contents.map((entry) => getChemicalProfile(entry.chemicalId, state)).filter(Boolean);
  if (profiles.some((chemical) => chemical.mixBehavior === 'heterogeneous' || chemical.state === 'powder' || chemical.state === 'solid')) {
    return 'heterogeneous';
  }
  return contents.length > 1 ? 'mixed' : 'homogeneous';
}

function getContentsColor(contents = [], state) {
  const colors = contents
    .map((entry) => getChemicalProfile(entry.chemicalId, state)?.baseColor || getChemicalProfile(entry.chemicalId, state)?.color)
    .filter(Boolean);

  return blendHexColors(colors);
}

function normalizeContainerVisual(item, state) {
  const contents = item.state.contents || [];
  const catalogObject = getObject(item.catalogId, state);
  const totalVolume = getTotalVolume(contents);
  const mixState = getMixState(contents, state);
  const hasVisibleContent = totalVolume > 0;

  item.state.visual = {
    ...item.state.visual,
    fillLevel: catalogObject?.capacityMl ? Math.min(totalVolume / Number(catalogObject.capacityMl), 1) : 0,
    liquidColor: hasVisibleContent ? getContentsColor(contents, state) : '#99d7ff',
    liquidOpacity: hasVisibleContent ? getBlendOpacity(contents, state) : 0,
    meniscusCurve: mixState === 'heterogeneous' ? 2 : 7,
    mixingState: mixState,
    viscosity: hasVisibleContent ? getViscosity(contents, state) : 0.22,
    heatIntensity: Math.max(0, Math.min(1, (Number(item.state.temperature || 24) - 24) / 72)),
    precipitate: mixState === 'heterogeneous' || Boolean(item.state.visual.precipitate),
    bubbles: Boolean(item.state.visual.bubbles),
    steam: Boolean(item.state.isHeated && item.state.visual.steam),
    smoke: Boolean(item.state.visual.smoke),
    flash: Boolean(item.state.visual.flash),
    explosion: Boolean(item.state.visual.explosion),
    heatHaze: Boolean(item.state.isHeated || item.state.visual.heatHaze),
    reactionFlame: Boolean(item.state.visual.reactionFlame),
    surfaceDeposit: Boolean(item.state.visual.surfaceDeposit),
    flame: Boolean(item.state.visual.flame)
  };
}

function applyTemperatureToContents(item) {
  (item.state.contents || []).forEach((content) => {
    content.temperature = Number(item.state.temperature || 24);
  });
}

function transferContents(sourceItem, targetItem, transferVolumeMl, state) {
  const sourceTotal = getTotalVolume(sourceItem.state.contents || []);
  if (!sourceTotal) return 0;

  const actualTransferVolume = Math.min(Number(transferVolumeMl || 0), sourceTotal);
  if (!actualTransferVolume) return 0;

  const ratios = (sourceItem.state.contents || []).map((entry) => ({
    chemicalId: entry.chemicalId,
    transferVolume: actualTransferVolume * (Number(entry.volumeMl || 0) / sourceTotal)
  }));

  ratios.forEach((entry) => {
    const sourceEntry = sourceItem.state.contents.find((content) => content.chemicalId === entry.chemicalId);
    if (sourceEntry) {
      sourceEntry.volumeMl = Math.max(0, Number(sourceEntry.volumeMl || 0) - entry.transferVolume);
    }

    const targetEntry = targetItem.state.contents.find((content) => content.chemicalId === entry.chemicalId);
    if (targetEntry) {
      targetEntry.volumeMl += entry.transferVolume;
    } else {
      const chemical = getChemical(entry.chemicalId, state);
      if (chemical) {
        targetItem.state.contents.push(createContentEntry(chemical, entry.transferVolume, {
          temperature: sourceItem.state.temperature,
          mixState: chemical.mixBehavior || 'homogeneous'
        }));
      }
    }
  });

  sourceItem.state.contents = sourceItem.state.contents.filter((entry) => Number(entry.volumeMl || 0) > 0.1);
  sourceItem.state.lastAction = 'pour';
  targetItem.state.lastAction = 'pour';
  sourceItem.state.isTilted = true;
  sourceItem.rotation = -28;
  normalizeContainerVisual(sourceItem, state);
  normalizeContainerVisual(targetItem, state);
  return actualTransferVolume;
}

export function applyTransformation(command, state, validation = {}) {
  const nextState = deepClone(state);
  const canonicalActionId = normalizeActionId(command.canonicalActionId || command.rawActionId);
  const targetItem = nextState.items.find((entry) => entry.instanceId === command.targetItem?.instanceId) || null;
  const sourceItem = nextState.items.find((entry) => entry.instanceId === validation.resolvedSourceItem?.instanceId || entry.instanceId === command.sourceItem?.instanceId) || null;
  const receiverItem = nextState.items.find((entry) => entry.instanceId === validation.resolvedTargetItem?.instanceId) || null;
  const heaterItem = nextState.items.find((entry) => entry.instanceId === validation.resolvedHeaterItem?.instanceId) || null;

  const result = {
    nextState,
    affectedItemIds: [],
    details: {},
    summary: {}
  };

  switch (canonicalActionId) {
    case 'add_chemical': {
      if (!targetItem || !command.chemical) break;
      const catalogObject = getObject(targetItem.catalogId, nextState);
      const currentVolume = getTotalVolume(targetItem.state.contents || []);
      const capacity = Number(catalogObject?.capacityMl || 0);
      const desiredVolume = Number(command.volumeMl || command.chemical.defaultVolumeMl || 10);
      const volumeMl = capacity ? Math.min(desiredVolume, Math.max(capacity - currentVolume, 0)) : desiredVolume;
      if (volumeMl <= 0) break;

      const existingEntry = targetItem.state.contents.find((entry) => entry.chemicalId === command.chemical.id);
      if (existingEntry) {
        existingEntry.volumeMl += volumeMl;
      } else {
        targetItem.state.contents.push(createContentEntry(command.chemical, volumeMl));
      }

      targetItem.state.lastAction = 'add_chemical';
      normalizeContainerVisual(targetItem, nextState);
      result.affectedItemIds.push(targetItem.instanceId);
      result.summary = { volumeMl, chemicalId: command.chemical.id };
      break;
    }

    case 'stir': {
      if (!targetItem) break;
      targetItem.state.lastAction = 'stir';
      normalizeContainerVisual(targetItem, nextState);
      result.affectedItemIds.push(targetItem.instanceId);
      break;
    }

    case 'tilt': {
      if (!targetItem) break;
      targetItem.state.lastAction = 'tilt';
      targetItem.state.isTilted = !targetItem.state.isTilted;
      targetItem.rotation = targetItem.state.isTilted ? -22 : 0;
      result.affectedItemIds.push(targetItem.instanceId);
      break;
    }

    case 'heat': {
      if (!targetItem) break;
      targetItem.state.lastAction = 'heat';

      if (getObject(targetItem.catalogId, nextState)?.type === 'heater') {
        targetItem.state.visual.flame = !targetItem.state.visual.flame;
        targetItem.state.isHeated = targetItem.state.visual.flame;
        result.summary = { heaterToggled: true, flame: targetItem.state.visual.flame };
      } else {
        targetItem.state.isHeated = !targetItem.state.isHeated;
        targetItem.state.temperature = targetItem.state.isHeated ? 85 : 24;
        targetItem.state.visual.steam = targetItem.state.isHeated && (targetItem.state.visual.steam || false);
        applyTemperatureToContents(targetItem);
        normalizeContainerVisual(targetItem, nextState);
        if (heaterItem) {
          heaterItem.state.visual.flame = targetItem.state.isHeated;
          heaterItem.state.isHeated = targetItem.state.isHeated;
          result.affectedItemIds.push(heaterItem.instanceId);
        }
        result.summary = { heated: targetItem.state.isHeated, temperature: targetItem.state.temperature };
      }

      result.affectedItemIds.push(targetItem.instanceId);
      break;
    }

    case 'empty': {
      if (!targetItem) break;
      targetItem.state.contents = [];
      targetItem.state.lastAction = 'empty';
      targetItem.state.reactionId = '';
      targetItem.state.visual = {
        ...targetItem.state.visual,
        liquidColor: '#99d7ff',
        liquidOpacity: 0,
        bubbles: false,
        steam: false,
        smoke: false,
        precipitate: false,
        flash: false,
        explosion: false,
        heatHaze: false,
        reactionFlame: false,
        surfaceDeposit: false,
        fillLevel: 0
      };
      result.affectedItemIds.push(targetItem.instanceId);
      break;
    }

    case 'rotate': {
      if (!targetItem) break;
      targetItem.rotation = (targetItem.rotation + 45) % 360;
      targetItem.state.lastAction = 'rotate';
      result.affectedItemIds.push(targetItem.instanceId);
      break;
    }

    case 'pour': {
      const effectiveSource = sourceItem || targetItem;
      if (!effectiveSource || !receiverItem) break;
      const effectiveTarget = receiverItem;
      const requestedVolume = Number(command.volumeMl || 15);
      const transferVolumeMl = transferContents(effectiveSource, effectiveTarget, requestedVolume, nextState);
      result.affectedItemIds.push(effectiveSource.instanceId, effectiveTarget.instanceId);
      result.summary = {
        transferVolumeMl,
        sourceInstanceId: effectiveSource.instanceId,
        targetInstanceId: effectiveTarget.instanceId
      };
      break;
    }

    case 'inspect':
    default:
      break;
  }

  result.nextState.selectedItemId = canonicalActionId === 'pour'
    ? validation.resolvedTargetItem?.instanceId || validation.resolvedSourceItem?.instanceId || nextState.selectedItemId || ''
    : command.targetItem?.instanceId || validation.resolvedTargetItem?.instanceId || nextState.selectedItemId || '';
  return result;
}
