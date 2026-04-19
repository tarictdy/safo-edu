import { createInitialItemState, uid } from '../data/localDefaults.js';

function getNextZIndex(state) {
  return (state.items || []).reduce((max, item) => Math.max(max, item.zIndex || 1), 0) + 1;
}

export function createItemInstance(catalogObject, point = { x: 120, y: 140 }, state = { items: [] }) {
  const defaultPlacement = catalogObject.defaultPlacement || { width: 120, height: 120 };

  return {
    instanceId: uid('lab'),
    catalogId: catalogObject.id,
    type: catalogObject.type,
    category: catalogObject.category,
    x: Math.round(point.x || 0),
    y: Math.round(point.y || 0),
    width: defaultPlacement.width,
    height: defaultPlacement.height,
    rotation: 0,
    zIndex: getNextZIndex(state),
    locked: false,
    attachedTo: '',
    parentContainerId: '',
    state: createInitialItemState(catalogObject),
    ui: {
      animation: ''
    }
  };
}

