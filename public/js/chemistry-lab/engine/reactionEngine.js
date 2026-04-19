import { getState } from '../state/labStore.js';
import { buildRenderInstructions } from './RendererBridge.js';
import { deepClone } from '../data/localDefaults.js';
import { composeEffects } from './EffectComposer.js';
import { evaluateReactions as evaluateReactionPipeline } from './ReactionEvaluator.js';
import { commitRuntimeState } from './StateManager.js';

export async function evaluateItemReaction(instanceId) {
  const state = getState();
  const item = state.items.find((entry) => entry.instanceId === instanceId);
  if (!item || !(item.state.contents || []).length) return null;

  const reactionOutput = evaluateReactionPipeline(deepClone(state), {
    affectedItemIds: [instanceId]
  });
  const effectRefs = composeEffects({
    canonicalActionId: item.state.lastAction || 'inspect',
    targetItem: item
  }, reactionOutput.nextState, reactionOutput);

  buildRenderInstructions(effectRefs, reactionOutput.nextState);
  commitRuntimeState(reactionOutput.nextState);
  return reactionOutput.results[0] || null;
}
