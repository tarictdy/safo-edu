import { updateState } from '../state/labStore.js';

const animationTimers = new Map();

function scheduleAnimationClear(instanceId, duration) {
  const currentTimer = animationTimers.get(instanceId);
  if (currentTimer) {
    window.clearTimeout(currentTimer);
  }

  animationTimers.set(instanceId, window.setTimeout(() => {
    updateState((draft) => {
      const item = draft.items.find((entry) => entry.instanceId === instanceId);
      if (!item) return draft;
      item.ui.animation = '';
      return draft;
    });
    animationTimers.delete(instanceId);
  }, duration));
}

export function triggerItemAnimation(instanceId, animationName, duration = 820) {
  updateState((draft) => {
    const item = draft.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return draft;
    item.ui.animation = animationName;
    return draft;
  });

  scheduleAnimationClear(instanceId, duration);
}

export function flashReaction(instanceId, duration = 720) {
  triggerItemAnimation(instanceId, 'reaction-flash', duration);
}
