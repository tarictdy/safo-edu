import { addJournalEntry } from '../state/historyStore.js';
import { pushDiagnosticEntry } from '../state/diagnosticsStore.js';
import { getState, updateState } from '../state/labStore.js';
import { selectItem } from '../state/selectionStore.js';
import { flashReaction, triggerItemAnimation } from './animationEngine.js';
import { resolveActionCommand } from './ActionResolver.js';
import { composeEffects } from './EffectComposer.js';
import { buildJournalEntries, commitJournalEntries } from './JournalEngine.js';
import { buildRenderInstructions } from './RendererBridge.js';
import { evaluateReactions } from './ReactionEvaluator.js';
import { advanceGuideWithAction } from './GuideEngine.js';
import { validateCommand } from './ConstraintEngine.js';
import { applyTransformation, getTotalVolume } from './TransformationEngine.js';
import { commitRuntimeState } from './StateManager.js';
import { getItemLabel } from './ruleEngine.js';

function setAlerts(errors = [], warnings = []) {
  updateState((draft) => {
    draft.alerts = [
      ...errors.map((message) => ({ level: 'error', message })),
      ...warnings.map((message) => ({ level: 'warning', message }))
    ];
    return draft;
  });
}

function triggerActionAnimation(command, reactionOutput) {
  const targetId = command.targetItem?.instanceId;
  const sourceId = command.sourceItem?.instanceId;
  const interactionId = command.interactionItem?.instanceId || '';
  const actionId = command.canonicalActionId;

  const animate = (instanceId, animationName, duration) => {
    if (!instanceId) return;
    triggerItemAnimation(instanceId, animationName, duration);
  };

  switch (actionId) {
    case 'stir':
      animate(targetId, 'stir');
      if (interactionId && interactionId !== targetId) animate(interactionId, 'stir');
      break;
    case 'tilt':
      animate(targetId, 'tilt');
      if (interactionId && interactionId !== targetId) animate(interactionId, 'tilt');
      break;
    case 'heat':
      animate(targetId, 'pulse-heat');
      if (interactionId && interactionId !== targetId) animate(interactionId, 'pulse-heat');
      break;
    case 'rotate':
      animate(interactionId || targetId, 'rotate-item', 420);
      break;
    case 'pour':
      animate(sourceId || interactionId || targetId, 'tilt');
      break;
    case 'add_chemical':
      animate(targetId, 'stir', 520);
      break;
    default:
      break;
  }

  const matchedReaction = (reactionOutput.results || []).find((result) => result.matched) || null;
  if (matchedReaction) {
    const flashTargetId = matchedReaction.itemInstanceId || targetId;
    if (flashTargetId) {
      if (matchedReaction.observables?.explosion && matchedReaction.observables.explosion !== 'none') {
        triggerItemAnimation(flashTargetId, 'pulse-heat', 1200);
      }
      flashReaction(flashTargetId);
    }
  }
}

function logValidationErrors(validation) {
  validation.errors.forEach((message) => addJournalEntry(message, 'error'));
}

export async function runAction(actionId, options = {}) {
  const state = getState();
  const command = resolveActionCommand(actionId, options, state);

  if (!command.action) {
    addJournalEntry('Action introuvable.', 'error');
    return false;
  }

  if (!command.targetItem && command.canonicalActionId !== 'pour') {
    addJournalEntry('Selectionne un objet du sandbox.', 'warning');
    return false;
  }

  if (command.targetItem) {
    selectItem(command.targetItem.instanceId);
  }

  const validation = validateCommand(command, state);
  if (!validation.isValid) {
    setAlerts(validation.errors, validation.warnings);
    logValidationErrors(validation);
    return false;
  }

  try {
    const transformationResult = applyTransformation(command, state, validation);
    const reactionOutput = evaluateReactions(transformationResult.nextState, transformationResult);
    const effectRefs = composeEffects(command, reactionOutput.nextState, reactionOutput);
    buildRenderInstructions(effectRefs, reactionOutput.nextState);
    reactionOutput.nextState.alerts = validation.warnings.map((message) => ({ level: 'warning', message }));

    commitRuntimeState(reactionOutput.nextState);
    advanceGuideWithAction(command, reactionOutput);
    triggerActionAnimation(command, reactionOutput);

    if (command.canonicalActionId === 'inspect') {
      const inspectedState = getState();
      const inspectedItem = inspectedState.items.find((entry) => entry.instanceId === (command.targetItem?.instanceId || ''));
      if (inspectedItem) {
        addJournalEntry(
          `${getItemLabel(inspectedItem, inspectedState)} inspecte: ${getTotalVolume(inspectedItem.state.contents || [])} mL, ${Math.round(inspectedItem.state.temperature || 24)} C.`,
          'info'
        );
      }
      return true;
    }

    const journalEntries = buildJournalEntries(command, validation, transformationResult, reactionOutput, reactionOutput.nextState);
    commitJournalEntries(journalEntries);
    return true;
  } catch (error) {
    const runtimeMessage = `Erreur moteur pendant l action ${command.canonicalActionId || actionId}.`;
    setAlerts([runtimeMessage], validation.warnings);
    addJournalEntry(runtimeMessage, 'error');
    pushDiagnosticEntry(error.message || runtimeMessage, {
      context: 'runAction',
      details: [
        `action=${command.canonicalActionId || actionId}`,
        `target=${command.targetItem?.instanceId || ''}`,
        `source=${command.sourceItem?.instanceId || ''}`,
        error.stack || ''
      ].filter(Boolean).join('\n')
    });
    return false;
  }
}
