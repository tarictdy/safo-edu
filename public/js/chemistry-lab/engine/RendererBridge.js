import { createEffectInstruction } from '../model/EffectInstruction.js';
import { getEffectProfile, getObject } from './CatalogManager.js';

function resolveZone(catalogObject, targetZoneType) {
  if (!catalogObject) return '';
  const zones = catalogObject.zones || {};

  switch (targetZoneType) {
    case 'liquidZone':
      return zones.liquidZone || 'liquid-zone';
    case 'heatZone':
      return zones.heatZone || 'heat-zone';
    case 'effectZone':
      return zones.effectZone || 'effect-zone';
    case 'shell':
      return zones.shell || 'shell';
    default:
      return zones.effectZone || zones.shell || '';
  }
}

export function buildRenderInstructions(effectRefs = [], nextState) {
  const activeEffects = (nextState.activeEffects || []).filter((effect) => {
    const startedAt = Number(effect.startedAt || 0);
    const durationMs = Number(effect.durationMs || 0);
    return !startedAt || !durationMs || Date.now() < startedAt + durationMs;
  });

  const newInstructions = effectRefs
    .map((entry) => {
      const effectProfile = getEffectProfile(entry.effectId, nextState);
      const targetItem = nextState.items.find((item) => item.instanceId === entry.targetInstanceId) || null;
      const targetObject = targetItem ? getObject(targetItem.catalogId, nextState) : null;
      if (!effectProfile || !targetItem) return null;
      return createEffectInstruction(effectProfile, {
        targetInstanceId: targetItem.instanceId,
        zone: resolveZone(targetObject, effectProfile.targetZoneType),
        params: entry.params || {}
      });
    })
    .filter(Boolean);

  nextState.activeEffects = [
    ...activeEffects.filter((effect) => !newInstructions.some((instruction) => instruction.targetInstanceId === effect.targetInstanceId && instruction.effectId === effect.effectId)),
    ...newInstructions
  ];
  nextState.renderInstructions = nextState.activeEffects.slice();

  return newInstructions;
}

