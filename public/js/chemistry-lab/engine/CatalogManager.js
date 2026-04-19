import { getState } from '../state/labStore.js';

function normalizeActionId(actionId = '') {
  return String(actionId || '').replace(/-/g, '_').trim().toLowerCase();
}

function fallbackState(state) {
  return state || getState();
}

function getCatalog(state) {
  return fallbackState(state).catalog || {};
}

function byId(entries = []) {
  return entries.reduce((index, entry) => {
    index[entry.id] = entry;
    return index;
  }, {});
}

export function getCatalogIndexes(state) {
  const catalog = getCatalog(state);
  return {
    objects: byId(catalog.objects || []),
    items: byId(catalog.items || []),
    chemicals: byId(catalog.chemicals || []),
    actions: byId(catalog.actions || []),
    reactions: byId(catalog.reactions || []),
    effectProfiles: byId(catalog.effectProfiles || []),
    reactionProfiles: byId(catalog.reactionProfiles || []),
    constraints: byId(catalog.constraints || []),
    experiments: byId(catalog.experiments || [])
  };
}

export function getObject(catalogId, state) {
  const indexes = getCatalogIndexes(state);
  return indexes.objects[catalogId] || null;
}

export function getLegacyCatalogItem(catalogId, state) {
  const indexes = getCatalogIndexes(state);
  return indexes.items[catalogId] || null;
}

export function getChemical(chemicalId, state) {
  return getCatalogIndexes(state).chemicals[chemicalId] || null;
}

export function getAction(actionId, state) {
  const normalized = normalizeActionId(actionId);
  const actions = getCatalog(state).actions || [];
  return actions.find((entry) => {
    return normalizeActionId(entry.id) === normalized || normalizeActionId(entry.canonicalId) === normalized;
  }) || null;
}

export function getReaction(reactionId, state) {
  return getCatalogIndexes(state).reactions[reactionId] || null;
}

export function getEffectProfile(effectId, state) {
  return getCatalogIndexes(state).effectProfiles[effectId] || null;
}

export function getConstraint(constraintId, state) {
  return getCatalogIndexes(state).constraints[constraintId] || null;
}

export function getExperiment(experimentId, state) {
  return getCatalogIndexes(state).experiments[experimentId] || null;
}

export function getAvailableActionsForObject(catalogObject, state) {
  if (!catalogObject) return [];
  const allowedActions = catalogObject.allowedActions || [];
  return (getCatalog(state).actions || []).filter((action) => {
    return allowedActions.includes(normalizeActionId(action.id)) || allowedActions.includes(normalizeActionId(action.canonicalId));
  });
}

export function getCompatibleChemicalsForObject(catalogObject, state) {
  if (!catalogObject?.acceptsChemicals) return [];
  return (getCatalog(state).chemicals || []).filter((chemical) => {
    if (!Array.isArray(chemical.compatibleContainers) || !chemical.compatibleContainers.length) return true;
    return chemical.compatibleContainers.includes(catalogObject.id);
  });
}

export function isContainerObject(catalogObject) {
  return catalogObject?.type === 'container';
}

export function isHeaterObject(catalogObject) {
  return catalogObject?.type === 'heater';
}

export function getObjectLabel(catalogId, state) {
  return getObject(catalogId, state)?.name || getLegacyCatalogItem(catalogId, state)?.name || catalogId;
}

export function getCurriculumMap(state) {
  return getCatalog(state).curriculum || {};
}

export function getCatalogCollections(state) {
  const catalog = getCatalog(state);
  return {
    objects: catalog.objects || [],
    items: catalog.items || [],
    chemicals: catalog.chemicals || [],
    actions: catalog.actions || [],
    reactions: catalog.reactions || [],
    reactionProfiles: catalog.reactionProfiles || [],
    effectProfiles: catalog.effectProfiles || [],
    constraints: catalog.constraints || [],
    experiments: catalog.experiments || [],
    curriculum: catalog.curriculum || {}
  };
}

export { normalizeActionId };
