import { getState } from '../state/labStore.js';
import { getItemInstance } from './StateManager.js';
import { getAction, getConstraint, getObject, isContainerObject, normalizeActionId } from './CatalogManager.js';

function getCenter(item) {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2
  };
}

function getDistance(sourceItem, targetItem) {
  const sourceCenter = getCenter(sourceItem);
  const targetCenter = getCenter(targetItem);
  return Math.hypot(sourceCenter.x - targetCenter.x, sourceCenter.y - targetCenter.y);
}

function overlapsHorizontally(sourceItem, targetItem) {
  return sourceItem.x < targetItem.x + targetItem.width && sourceItem.x + sourceItem.width > targetItem.x;
}

function findHeaterBelow(targetItem, state) {
  return (state.items || [])
    .map((item) => {
      if (item.instanceId === targetItem.instanceId) return null;
      const catalogObject = getObject(item.catalogId, state);
      if (catalogObject?.type !== 'heater') return null;

      const targetBottomY = (targetItem.y || 0) + (targetItem.height || 0);
      const heaterTopY = item.y || 0;
      const verticalGap = heaterTopY - targetBottomY;
      const horizontalCenterDistance = Math.abs(
        ((item.x || 0) + (item.width || 0) / 2) - ((targetItem.x || 0) + (targetItem.width || 0) / 2)
      );
      const aligned = (overlapsHorizontally(item, targetItem) || horizontalCenterDistance <= Math.max(120, (targetItem.width || 0) * 0.75))
        && verticalGap >= -40
        && verticalGap <= 130;

      return aligned
        ? {
            item,
            score: Math.abs(verticalGap) + horizontalCenterDistance
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score)[0]?.item || null;
}

function findNearbyHeater(targetItem, state) {
  return (state.items || [])
    .map((item) => {
      if (item.instanceId === targetItem.instanceId) return null;
      const catalogObject = getObject(item.catalogId, state);
      if (catalogObject?.type !== 'heater') return null;
      return {
        item,
        distance: getDistance(item, targetItem)
      };
    })
    .filter(Boolean)
    .filter((entry) => entry.distance <= 260)
    .sort((left, right) => left.distance - right.distance)[0]?.item || null;
}

function findNearestPourTarget(sourceItem, state) {
  return (state.items || [])
    .filter((item) => item.instanceId !== sourceItem.instanceId)
    .map((item) => ({
      item,
      object: getObject(item.catalogId, state),
      distance: getDistance(sourceItem, item)
    }))
    .filter((entry) => isContainerObject(entry.object) && entry.distance <= 280)
    .sort((left, right) => left.distance - right.distance)[0]?.item || null;
}

function pushError(result, constraintId, fallbackMessage) {
  const definition = constraintId ? getConstraint(constraintId) : null;
  result.errors.push(definition?.errorMessage || fallbackMessage);
  if (constraintId) {
    result.appliedConstraints.push(constraintId);
  }
}

export function validateCommand(command, state = getState()) {
  const result = {
    isValid: true,
    warnings: [],
    errors: [],
    appliedConstraints: [],
    resolvedTargetItem: command.targetItem || null,
    resolvedSourceItem: command.sourceItem || null,
    resolvedHeaterItem: null
  };

  const action = command.action || getAction(command.canonicalActionId, state);
  if (!action) {
    pushError(result, null, 'Action introuvable.');
  }

  const targetItem = result.resolvedTargetItem;
  const targetObject = targetItem ? getObject(targetItem.catalogId, state) : null;
  const sourceItem = result.resolvedSourceItem;
  const sourceObject = sourceItem ? getObject(sourceItem.catalogId, state) : null;
  const canonicalActionId = normalizeActionId(command.canonicalActionId || command.rawActionId);

  if (action?.requiresTarget && !targetItem && canonicalActionId !== 'pour') {
    pushError(result, null, 'Selectionne un objet du sandbox.');
  }

  if (targetObject && Array.isArray(action?.allowedTargetTypes) && action.allowedTargetTypes.length) {
    const allowedTargetValues = new Set([
      targetObject.type,
      targetObject.category,
      targetObject.subType
    ].filter(Boolean));

    if (!action.allowedTargetTypes.some((entry) => allowedTargetValues.has(entry))) {
      pushError(result, null, `${targetObject.name} ne supporte pas cette action.`);
    }
  }

  if (targetObject && Array.isArray(targetObject.allowedActions) && !targetObject.allowedActions.includes(canonicalActionId)) {
    pushError(result, null, `${targetObject.name} ne supporte pas cette action.`);
  }

  if (canonicalActionId === 'add_chemical') {
    const totalVolume = (targetItem?.state?.contents || []).reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
    if (!targetObject?.acceptsChemicals || !isContainerObject(targetObject)) {
      pushError(result, 'container_accepts_chemicals', 'Ce materiel ne peut pas recevoir de produit.');
    }
    if (!command.chemical) {
      pushError(result, null, 'Produit chimique introuvable.');
    }
    if (Number(targetObject?.capacityMl || 0) && totalVolume >= Number(targetObject.capacityMl)) {
      pushError(result, 'container_has_capacity', `${targetObject.name} est deja plein.`);
    }
  }

  if (canonicalActionId === 'heat') {
    if (targetObject?.type === 'heater') {
      result.warnings.push('Le bruleur sera allume ou eteint.');
    } else {
      if (!targetObject?.acceptsHeat) {
        pushError(result, 'target_accepts_heat', `${targetObject?.name || 'Cet objet'} ne supporte pas le chauffage.`);
      }
      const heaterItem = targetItem ? findHeaterBelow(targetItem, state) : null;
      const nearbyHeater = heaterItem || (targetItem ? findNearbyHeater(targetItem, state) : null);
      if (!nearbyHeater) {
        pushError(result, 'burner_under_container', 'Place le bruleur sous le recipient avant de chauffer.');
      } else {
        result.resolvedHeaterItem = nearbyHeater;
        if (!heaterItem) {
          result.warnings.push('Bruleur proche detecte. Le chauffage est applique meme si le placement n est pas parfait.');
        }
      }
    }
  }

  if (canonicalActionId === 'empty') {
    const hasContent = Boolean((targetItem?.state?.contents || []).length);
    if (!hasContent) {
      pushError(result, 'empty_requires_content', 'Aucun contenu a vider.');
    }
  }

  if (canonicalActionId === 'pour') {
    const effectiveSource = sourceItem || targetItem;
    const effectiveSourceObject = sourceObject || targetObject;

    if (!effectiveSource) {
      pushError(result, 'source_has_content_for_pour', 'Selectionne un recipient source.');
    } else {
      result.resolvedSourceItem = effectiveSource;
    }

    if (!effectiveSourceObject || !isContainerObject(effectiveSourceObject)) {
      pushError(result, 'source_has_content_for_pour', 'La source doit etre un recipient.');
    }

    const sourceHasContent = Boolean((effectiveSource?.state?.contents || []).length);
    if (!sourceHasContent) {
      pushError(result, 'source_has_content_for_pour', 'Le recipient source est vide.');
    }

    const explicitTarget = command.hasExplicitSource && command.hasExplicitTarget ? command.targetItem : null;
    const receiver = explicitTarget || (effectiveSource ? findNearestPourTarget(effectiveSource, state) : null);
    result.resolvedTargetItem = receiver;

    if (!receiver) {
      pushError(result, 'target_can_receive_pour', 'Approche un recipient cible pour verser.');
    } else if (!isContainerObject(getObject(receiver.catalogId, state))) {
      pushError(result, 'target_can_receive_pour', 'La destination doit etre un recipient.');
    } else if (receiver.instanceId === effectiveSource?.instanceId) {
      pushError(result, 'target_can_receive_pour', 'La source et la destination doivent etre differentes.');
    }
  }

  result.isValid = !result.errors.length;
  return result;
}
