import { getState } from '../state/labStore.js';
import { getItemInstance } from './StateManager.js';
import { getAction, getChemical, getObject, normalizeActionId } from './CatalogManager.js';
import { resolveActionTargetItem } from './SpatialEngine.js';

export function resolveActionCommand(actionId, options = {}, state = getState()) {
  const canonicalActionId = normalizeActionId(actionId);
  const action = getAction(actionId, state);
  const hasExplicitTarget = Boolean(options.instanceId || options.targetInstanceId);
  const hasExplicitSource = Boolean(options.sourceInstanceId || options.sourceItemId);
  const selectedItemId = options.instanceId || options.targetInstanceId || state.selectedItemId;
  const sourceInstanceId = options.sourceInstanceId || options.sourceItemId || '';
  const rawTargetItem = selectedItemId ? getItemInstance(selectedItemId, state) : null;
  const sourceItem = sourceInstanceId ? getItemInstance(sourceInstanceId, state) : null;
  const targetItem = resolveActionTargetItem(rawTargetItem, canonicalActionId, state);
  const effectiveSourceItem = canonicalActionId === 'pour' ? (sourceItem || targetItem) : sourceItem;
  const effectiveTargetItem = canonicalActionId === 'pour'
    ? (hasExplicitTarget && hasExplicitSource ? targetItem : null)
    : targetItem;

  return {
    rawActionId: actionId,
    canonicalActionId,
    action,
    hasExplicitTarget,
    hasExplicitSource,
    interactionItem: rawTargetItem,
    targetInstanceId: effectiveTargetItem?.instanceId || targetItem?.instanceId || '',
    sourceInstanceId: effectiveSourceItem?.instanceId || '',
    targetItem: effectiveTargetItem || targetItem,
    sourceItem: effectiveSourceItem,
    targetObject: (effectiveTargetItem || targetItem) ? getObject((effectiveTargetItem || targetItem).catalogId, state) : null,
    sourceObject: effectiveSourceItem ? getObject(effectiveSourceItem.catalogId, state) : null,
    chemical: options.chemicalId ? getChemical(options.chemicalId, state) : null,
    chemicalId: options.chemicalId || '',
    volumeMl: Number(options.volumeMl || 0),
    payload: {
      ...options
    }
  };
}
