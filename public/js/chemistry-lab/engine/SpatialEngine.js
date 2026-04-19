import { getObject, isContainerObject, normalizeActionId } from './CatalogManager.js';

const CONTAINER_ACTIONS = new Set(['add_chemical', 'stir', 'tilt', 'pour', 'heat', 'empty']);
const IMMERSED_REACTANTS_BY_OBJECT = {
  metal_strip: {
    oxydation_metal_solution: 'metal_reducteur',
    cuivre_nitrate_argent: 'copper_sample',
    fer_solution_cuivre: 'iron_sample',
    corrosion_fer: 'iron_sample'
  },
  electrode_zinc: {
    pile_daniell: 'zinc'
  },
  electrode_copper: {
    pile_daniell: 'copper'
  }
};

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getBounds(item) {
  return {
    left: Number(item.x || 0),
    top: Number(item.y || 0),
    right: Number(item.x || 0) + Number(item.width || 0),
    bottom: Number(item.y || 0) + Number(item.height || 0),
    width: Number(item.width || 0),
    height: Number(item.height || 0)
  };
}

function getCenter(item) {
  const bounds = getBounds(item);
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2
  };
}

function distanceBetween(itemA, itemB) {
  const centerA = getCenter(itemA);
  const centerB = getCenter(itemB);
  return Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y);
}

function getContainmentProfile(item, state) {
  const object = getObject(item.catalogId, state);
  if (!object) return 'free';

  switch (object.subType) {
    case 'test_tube':
    case 'thermometer':
    case 'metal_strip':
    case 'zinc_electrode':
    case 'copper_electrode':
      return 'vertical_probe';
    case 'electrode_pair':
      return 'electrode_pair';
    case 'mixing_tool':
      return 'immersed_tool';
    default:
      if (object.type === 'tool' || object.type === 'sensor' || object.type === 'electrode') {
        return 'immersed_tool';
      }
      return 'free';
  }
}

function getInnerBounds(container, state) {
  const bounds = getBounds(container);
  const object = getObject(container.catalogId, state);
  const subType = object?.subType || '';

  switch (subType) {
    case 'test_tube':
      return {
        left: bounds.left + bounds.width * 0.24,
        right: bounds.right - bounds.width * 0.24,
        top: bounds.top + bounds.height * 0.08,
        bottom: bounds.bottom - bounds.height * 0.1
      };
    case 'erlenmeyer':
      return {
        left: bounds.left + bounds.width * 0.24,
        right: bounds.right - bounds.width * 0.24,
        top: bounds.top + bounds.height * 0.18,
        bottom: bounds.bottom - bounds.height * 0.12
      };
    case 'electrolysis_tank':
      return {
        left: bounds.left + bounds.width * 0.12,
        right: bounds.right - bounds.width * 0.12,
        top: bounds.top + bounds.height * 0.14,
        bottom: bounds.bottom - bounds.height * 0.12
      };
    case 'combustion_cup':
      return {
        left: bounds.left + bounds.width * 0.18,
        right: bounds.right - bounds.width * 0.18,
        top: bounds.top + bounds.height * 0.2,
        bottom: bounds.bottom - bounds.height * 0.1
      };
    default:
      return {
        left: bounds.left + bounds.width * 0.18,
        right: bounds.right - bounds.width * 0.18,
        top: bounds.top + bounds.height * 0.14,
        bottom: bounds.bottom - bounds.height * 0.12
      };
  }
}

function getAnchorPoint(item, state) {
  const bounds = getBounds(item);
  const profile = getContainmentProfile(item, state);

  switch (profile) {
    case 'vertical_probe':
      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height * 0.78
      };
    case 'electrode_pair':
      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height * 0.92
      };
    default:
      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2
      };
  }
}

function pointInsideContainer(point, container, state) {
  const inner = getInnerBounds(container, state);
  return point.x >= inner.left && point.x <= inner.right && point.y >= inner.top && point.y <= inner.bottom;
}

function isContainableItem(item, state) {
  const object = getObject(item.catalogId, state);
  if (!object || isContainerObject(object)) return false;
  return ['tool', 'sensor', 'electrode'].includes(object.type);
}

function isSupportObject(item, state) {
  return getObject(item.catalogId, state)?.type === 'support';
}

function isSupportAttachable(item, state) {
  const attachPoints = getObject(item.catalogId, state)?.attachPoints || [];
  return attachPoints.includes('support-clamp');
}

function isBridgeConnector(item, state) {
  return getObject(item.catalogId, state)?.subType === 'salt_bridge';
}

function getSupportClampPoint(supportItem) {
  const bounds = getBounds(supportItem);
  return {
    x: bounds.left + bounds.width * 0.5,
    y: bounds.top + bounds.height * 0.33
  };
}

function parseAttachedIds(item, prefix) {
  const raw = String(item?.attachedTo || '');
  if (!raw.startsWith(`${prefix}:`)) return [];
  return raw.split(':').slice(1).filter(Boolean);
}

function findContainingContainer(item, state) {
  if (!isContainableItem(item, state)) return null;

  const anchor = getAnchorPoint(item, state);
  const candidates = (state.items || [])
    .filter((entry) => entry.instanceId !== item.instanceId)
    .filter((entry) => isContainerObject(getObject(entry.catalogId, state)))
    .filter((entry) => pointInsideContainer(anchor, entry, state))
    .map((entry) => {
      const inner = getInnerBounds(entry, state);
      const centerX = (inner.left + inner.right) / 2;
      const centerY = (inner.top + inner.bottom) / 2;
      return {
        item: entry,
        score: Math.abs(anchor.x - centerX) + Math.abs(anchor.y - centerY)
      };
    })
    .sort((left, right) => left.score - right.score);

  return candidates[0]?.item || null;
}

function findNearestSupport(item, state) {
  if (!isSupportAttachable(item, state)) return null;

  const anchor = getAnchorPoint(item, state);
  const candidates = (state.items || [])
    .filter((entry) => entry.instanceId !== item.instanceId)
    .filter((entry) => isSupportObject(entry, state))
    .map((entry) => {
      const clamp = getSupportClampPoint(entry);
      return {
        item: entry,
        distance: Math.hypot(anchor.x - clamp.x, anchor.y - clamp.y)
      };
    })
    .filter((entry) => entry.distance <= 130)
    .sort((left, right) => left.distance - right.distance);

  return candidates[0]?.item || null;
}

function findBridgeContainers(item, state) {
  if (!isBridgeConnector(item, state)) return [];

  const center = getCenter(item);
  const containers = (state.items || [])
    .filter((entry) => entry.instanceId !== item.instanceId)
    .filter((entry) => isContainerObject(getObject(entry.catalogId, state)))
    .map((entry) => ({
      item: entry,
      center: getCenter(entry)
    }))
    .sort((left, right) => left.center.x - right.center.x);

  const leftCandidates = containers
    .filter((entry) => entry.center.x < center.x)
    .sort((left, right) => Math.abs(left.center.x - center.x) - Math.abs(right.center.x - center.x));
  const rightCandidates = containers
    .filter((entry) => entry.center.x > center.x)
    .sort((left, right) => Math.abs(left.center.x - center.x) - Math.abs(right.center.x - center.x));

  const left = leftCandidates[0]?.item || null;
  const right = rightCandidates[0]?.item || null;
  if (!left || !right) return [];

  const verticalSpread = Math.abs(getCenter(left).y - getCenter(right).y);
  const horizontalGap = Math.abs(getCenter(right).x - getCenter(left).x);
  if (verticalSpread > 120 || horizontalGap < 120 || horizontalGap > 420) {
    return [];
  }

  return [left, right];
}

function computeContainedPose(item, container, index, count, state) {
  const inner = getInnerBounds(container, state);
  const profile = getContainmentProfile(item, state);
  const horizontalSlot = count > 1
    ? (inner.right - inner.left) / Math.max(count, 1)
    : 0;
  const slotCenterX = count > 1
    ? inner.left + horizontalSlot * index + horizontalSlot / 2
    : (inner.left + inner.right) / 2;
  const centeredX = Math.round(slotCenterX - Number(item.width || 0) / 2);

  switch (profile) {
    case 'vertical_probe':
      return {
        x: centeredX,
        y: Math.round(inner.top - Number(item.height || 0) * 0.18),
        rotation: 0
      };
    case 'electrode_pair':
      return {
        x: Math.round((inner.left + inner.right) / 2 - Number(item.width || 0) / 2),
        y: Math.round(inner.top - Number(item.height || 0) * 0.24),
        rotation: 0
      };
    case 'immersed_tool':
      return {
        x: centeredX,
        y: Math.round(inner.top + (inner.bottom - inner.top) * 0.16),
        rotation: -18
      };
    default:
      return {
        x: centeredX,
        y: Math.round(inner.top + (inner.bottom - inner.top) * 0.12),
        rotation: Number(item.rotation || 0)
      };
  }
}

function computeSupportPose(item, supportItem, state) {
  const clamp = getSupportClampPoint(supportItem);
  const object = getObject(item.catalogId, state);

  if (object?.subType === 'test_tube') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.78),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.3),
      rotation: -6
    };
  }

  if (object?.subType === 'boiling_tube') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.72),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.26),
      rotation: -5
    };
  }

  if (object?.subType === 'thermometer') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.16),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.3),
      rotation: 0
    };
  }

  if (object?.subType === 'burette') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.42),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.1),
      rotation: 0
    };
  }

  if (object?.subType === 'separatory_funnel') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.5),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.08),
      rotation: 0
    };
  }

  if (object?.subType === 'round_bottom_flask') {
    return {
      x: Math.round(clamp.x - Number(item.width || 0) * 0.52),
      y: Math.round(clamp.y - Number(item.height || 0) * 0.06),
      rotation: 0
    };
  }

  return {
    x: Math.round(clamp.x - Number(item.width || 0) / 2),
    y: Math.round(clamp.y - Number(item.height || 0) * 0.3),
    rotation: Number(item.rotation || 0)
  };
}

function computeBridgePose(bridgeItem, leftContainer, rightContainer) {
  const leftBounds = getBounds(leftContainer);
  const rightBounds = getBounds(rightContainer);
  const bridgeWidth = Number(bridgeItem.width || 0);
  const bridgeHeight = Number(bridgeItem.height || 0);
  const leftCenterX = leftBounds.left + leftBounds.width / 2;
  const rightCenterX = rightBounds.left + rightBounds.width / 2;
  const topY = Math.min(leftBounds.top, rightBounds.top);

  return {
    x: Math.round((leftCenterX + rightCenterX) / 2 - bridgeWidth / 2),
    y: Math.round(topY - bridgeHeight * 0.74),
    rotation: 0
  };
}

export function getParentContainer(item, state) {
  if (!item?.parentContainerId) return null;
  return (state.items || []).find((entry) => entry.instanceId === item.parentContainerId) || null;
}

export function getContainedItems(containerItem, state) {
  return (state.items || []).filter((entry) => entry.parentContainerId === containerItem.instanceId);
}

export function getAttachedSupport(item, state) {
  const [supportId] = parseAttachedIds(item, 'support');
  if (!supportId) return null;
  return (state.items || []).find((entry) => entry.instanceId === supportId) || null;
}

export function getBridgeConnectionItems(bridgeItem, state) {
  const containerIds = parseAttachedIds(bridgeItem, 'bridge');
  if (containerIds.length !== 2) return [];
  return containerIds
    .map((instanceId) => (state.items || []).find((entry) => entry.instanceId === instanceId))
    .filter(Boolean);
}

export function resolveActionTargetItem(targetItem, actionId, state) {
  if (!targetItem) return null;
  const normalizedActionId = normalizeActionId(actionId);
  const object = getObject(targetItem.catalogId, state);
  if (!CONTAINER_ACTIONS.has(normalizedActionId)) return targetItem;
  if (isContainerObject(object) || object?.type === 'heater') return targetItem;
  return getParentContainer(targetItem, state) || targetItem;
}

export function syncSpatialLayout(items = [], state) {
  const workingState = {
    ...(state || {}),
    items
  };

  items.forEach((item) => {
    item.parentContainerId = '';
    if (!String(item.attachedTo || '').startsWith('bridge:') && !String(item.attachedTo || '').startsWith('support:')) {
      item.attachedTo = '';
    }
  });

  items.forEach((item) => {
    if (isContainerObject(getObject(item.catalogId, workingState))) return;
    const container = findContainingContainer(item, workingState);
    if (container) {
      item.parentContainerId = container.instanceId;
      item.attachedTo = '';
      return;
    }

    const support = findNearestSupport(item, workingState);
    if (support) {
      item.attachedTo = `support:${support.instanceId}`;
    } else if (String(item.attachedTo || '').startsWith('support:')) {
      item.attachedTo = '';
    }
  });

  items
    .filter((item) => isBridgeConnector(item, workingState))
    .forEach((bridgeItem) => {
      const containers = findBridgeContainers(bridgeItem, workingState);
      if (containers.length === 2) {
        bridgeItem.attachedTo = `bridge:${containers[0].instanceId}:${containers[1].instanceId}`;
      } else if (String(bridgeItem.attachedTo || '').startsWith('bridge:')) {
        bridgeItem.attachedTo = '';
      }
    });

  const containers = items.filter((item) => isContainerObject(getObject(item.catalogId, workingState)));
  containers.forEach((container) => {
    const children = items.filter((item) => item.parentContainerId === container.instanceId);
    children.forEach((child, index) => {
      const pose = computeContainedPose(child, container, index, children.length, workingState);
      child.x = pose.x;
      child.y = pose.y;
      child.rotation = pose.rotation;
      child.zIndex = Math.max(Number(container.zIndex || 1) + 1 + index, Number(child.zIndex || 1));
    });
  });

  items.forEach((item) => {
    const support = getAttachedSupport(item, workingState);
    if (!support || item.parentContainerId) return;
    const pose = computeSupportPose(item, support, workingState);
    item.x = pose.x;
    item.y = pose.y;
    item.rotation = pose.rotation;
    item.zIndex = Math.max(Number(support.zIndex || 1) + 1, Number(item.zIndex || 1));
  });

  items
    .filter((item) => isBridgeConnector(item, workingState))
    .forEach((bridgeItem) => {
      const containersForBridge = getBridgeConnectionItems(bridgeItem, workingState);
      if (containersForBridge.length !== 2) return;
      const pose = computeBridgePose(bridgeItem, containersForBridge[0], containersForBridge[1]);
      bridgeItem.x = pose.x;
      bridgeItem.y = pose.y;
      bridgeItem.rotation = pose.rotation;
      bridgeItem.zIndex = Math.max(
        Number(containersForBridge[0].zIndex || 1),
        Number(containersForBridge[1].zIndex || 1)
      ) + 2;
    });

  return items;
}

export function getImmersedReactantIds(containerItem, state) {
  const experimentId = state.currentExperimentId || state.selectedExperimentId || '';
  const immersedItems = getContainedItems(containerItem, state);

  return unique(immersedItems.flatMap((item) => {
    const object = getObject(item.catalogId, state);
    const byExperiment = IMMERSED_REACTANTS_BY_OBJECT[object?.id || ''];
    if (byExperiment && experimentId && byExperiment[experimentId]) {
      return [byExperiment[experimentId]];
    }

    return unique([
      object?.immersedChemicalId,
      ...(Array.isArray(object?.immersedChemicalIds) ? object.immersedChemicalIds : [])
    ]);
  }));
}

export function getDepositTargetItem(containerItem, state) {
  const immersedItems = getContainedItems(containerItem, state);
  return immersedItems[0] || null;
}

export function getNearestContainerPair(state, item) {
  if (!item) return [];
  return findBridgeContainers(item, state);
}

export function getDistanceBetweenItems(leftItem, rightItem) {
  return distanceBetween(leftItem, rightItem);
}
