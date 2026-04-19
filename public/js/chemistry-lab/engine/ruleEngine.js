import {
  getAction,
  getAvailableActionsForObject,
  getChemical,
  getCompatibleChemicalsForObject,
  getLegacyCatalogItem,
  getObject,
  getObjectLabel,
  isContainerObject
} from './CatalogManager.js';

export function getCatalogItem(catalogId, state) {
  return getLegacyCatalogItem(catalogId, state) || getObject(catalogId, state);
}

export function getChemicalById(chemicalId, state) {
  return getChemical(chemicalId, state);
}

export function getActionById(actionId, state) {
  return getAction(actionId, state);
}

export function isContainerItem(item, state) {
  if (!item) return false;
  return isContainerObject(getObject(item.catalogId, state));
}

export function getAvailableActionsForItem(item, state) {
  if (!item) return [];
  return getAvailableActionsForObject(getObject(item.catalogId, state), state);
}

export function getCompatibleChemicalsForItem(item, state) {
  if (!item) return [];
  return getCompatibleChemicalsForObject(getObject(item.catalogId, state), state);
}

export function getItemLabel(item, state) {
  if (!item) return '';
  return getObjectLabel(item.catalogId, state);
}
