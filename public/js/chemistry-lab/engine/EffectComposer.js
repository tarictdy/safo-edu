import { getAction, getEffectProfile, getObject, normalizeActionId } from './CatalogManager.js';

function pushEffect(effectRefs, effectId, targetInstanceId, params = {}) {
  if (!effectId || !targetInstanceId) return;
  const key = `${effectId}:${targetInstanceId}`;
  if (effectRefs.some((entry) => entry.key === key)) return;
  effectRefs.push({
    key,
    effectId,
    targetInstanceId,
    params
  });
}

function mapObservableToEffectIds(observables = {}, reaction = {}) {
  const ids = [];
  if (observables.heatRelease && observables.heatRelease !== 'none') {
    ids.push(observables.heatRelease === 'high' ? 'heat_glow_strong' : 'heat_glow_medium');
    ids.push('heat_shimmer_medium');
  }
  if (observables.bubbles && observables.bubbles !== 'none') ids.push(reaction.reactionType === 'electrolysis' ? 'bubble_emitter_electrolysis' : 'bubble_emitter_light');
  if (observables.steam && observables.steam !== 'none') ids.push(observables.steam === 'hot' ? 'steam_emitter_hot' : 'steam_emitter_light');
  if (observables.smoke && observables.smoke !== 'none') ids.push('smoke_emitter_reaction');
  if (observables.precipitate && observables.precipitate !== 'none') ids.push('precipitate_bottom_light');
  if (observables.surfaceDeposit && observables.surfaceDeposit !== 'none') ids.push('surface_deposit_medium');
  if (observables.flash && observables.flash !== 'none') ids.push(observables.flash === 'high' ? 'flash_reaction_strong' : 'flash_reaction_soft');
  if (observables.flameBurst && observables.flameBurst !== 'none') ids.push('flame_burst_reaction');
  if (observables.explosion && observables.explosion !== 'none') ids.push('explosion_ring_soft');
  if (observables.foam && observables.foam !== 'none') ids.push('foam_layer_light');
  return ids;
}

export function composeEffects(command, nextState, reactionOutput) {
  const effectRefs = [];
  const action = getAction(command.canonicalActionId, nextState);
  const canonicalActionId = normalizeActionId(command.canonicalActionId || command.rawActionId);

  (action?.defaultEffectHints || []).forEach((effectId) => {
    if (canonicalActionId === 'pour') {
      const sourceInstanceId = reactionOutput?.nextState?.selectedItemId ? command.sourceItem?.instanceId || command.targetItem?.instanceId : command.sourceItem?.instanceId;
      pushEffect(effectRefs, effectId, sourceInstanceId);
      return;
    }
    pushEffect(effectRefs, effectId, command.targetItem?.instanceId);
  });

  if (canonicalActionId === 'stir') {
    pushEffect(effectRefs, 'liquid_mix_medium', command.targetItem?.instanceId);
    pushEffect(effectRefs, 'container_shake_light', command.targetItem?.instanceId);
  }

  if (canonicalActionId === 'tilt' || canonicalActionId === 'pour') {
    pushEffect(effectRefs, 'tilt_pour_standard', command.sourceItem?.instanceId || command.targetItem?.instanceId);
  }

  if (canonicalActionId === 'heat') {
    const heatedItemId = command.targetItem?.instanceId;
    pushEffect(effectRefs, 'heat_glow_medium', heatedItemId);
    pushEffect(effectRefs, 'heat_shimmer_medium', heatedItemId);
  }

  (reactionOutput.results || []).forEach((result) => {
    const targetInstanceId = result.itemInstanceId;
    mapObservableToEffectIds(result.observables, result.reaction || {}).forEach((effectId) => {
      const effectTargetId = effectId === 'surface_deposit_medium'
        ? (result.depositTargetItemId || targetInstanceId)
        : targetInstanceId;
      pushEffect(effectRefs, effectId, effectTargetId);
    });

    if (!result.matched && result.journalMessages?.length && getObject(nextState.items.find((item) => item.instanceId === targetInstanceId)?.catalogId, nextState)?.type === 'container') {
      const targetItem = nextState.items.find((item) => item.instanceId === targetInstanceId);
      if (targetItem?.state?.visual?.steam) {
        pushEffect(effectRefs, Number(targetItem.state.temperature || 0) >= 75 ? 'steam_emitter_hot' : 'steam_emitter_light', targetInstanceId);
      }
      if (targetItem?.state?.visual?.bubbles) {
        pushEffect(effectRefs, 'bubble_emitter_light', targetInstanceId);
      }
      if (targetItem?.state?.visual?.heatHaze) {
        pushEffect(effectRefs, 'heat_shimmer_medium', targetInstanceId);
      }
    }
  });

  return effectRefs.map(({ key, ...entry }) => entry);
}
