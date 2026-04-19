import { addJournalEntry } from '../state/historyStore.js';
import { clearGuideSession, getState, setGuideSession, updateGuideSession } from '../state/labStore.js';
import { getAction, getChemical, getExperiment, getObjectLabel, normalizeActionId } from './CatalogManager.js';

function toArray(values) {
  return Array.isArray(values) ? values : [];
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildStep(id, kind, title, description, extra = {}) {
  return {
    id,
    kind,
    title,
    description,
    status: 'pending',
    ...extra
  };
}

function finalizeSteps(steps = []) {
  let firstPendingAssigned = false;
  const normalizedSteps = steps.map((step) => {
    if (step.status === 'completed') return step;
    if (!firstPendingAssigned) {
      firstPendingAssigned = true;
      return {
        ...step,
        status: 'active'
      };
    }
    return {
      ...step,
      status: 'pending'
    };
  });

  const completedCount = normalizedSteps.filter((step) => step.status === 'completed').length;
  const activeStepIndex = normalizedSteps.findIndex((step) => step.status === 'active');
  const isComplete = normalizedSteps.length > 0 && completedCount === normalizedSteps.length;

  return {
    steps: normalizedSteps,
    completedCount,
    totalCount: normalizedSteps.length,
    activeStepIndex: isComplete ? -1 : activeStepIndex,
    isComplete
  };
}

function getActionLabel(actionId, state) {
  return getAction(actionId, state)?.label || actionId;
}

function getChemicalLabel(chemicalId, state) {
  const chemical = getChemical(chemicalId, state);
  if (!chemical) return chemicalId;
  return chemical.name || chemical.formula || chemical.id;
}

function getMaterials(experiment, state) {
  return {
    objects: unique(toArray(experiment.requiredObjects).length ? experiment.requiredObjects : experiment.instruments).map((catalogId) => getObjectLabel(catalogId, state)),
    chemicals: unique(toArray(experiment.requiredChemicals).length ? experiment.requiredChemicals : experiment.reactifs).map((chemicalId) => getChemicalLabel(chemicalId, state))
  };
}

function buildGuideSteps(experiment, state) {
  const steps = [];
  const chemicalIds = unique(toArray(experiment.requiredChemicals).length ? experiment.requiredChemicals : experiment.reactifs);
  const actionIds = unique((toArray(experiment.actionsAutorisees) || []).map((actionId) => normalizeActionId(actionId)));
  const nonInspectActionIds = actionIds.filter((actionId) => actionId !== 'inspect' && actionId !== 'add_chemical');
  const needsInspectStep = actionIds.includes('inspect');

  steps.push(
    buildStep(
      'setup',
      'setup',
      'Montage guide charge',
      'Le montage de depart est place dans le bac a sable. Tu peux suivre les etapes ci-dessous.',
      { status: 'completed' }
    )
  );

  chemicalIds.forEach((chemicalId, index) => {
    const chemicalName = getChemicalLabel(chemicalId, state);
    steps.push(
      buildStep(
        `chemical_${chemicalId}_${index}`,
        'chemical',
        `Ajouter ${chemicalName}`,
        'Selectionne le recipient concerne, coche le produit a droite puis clique sur Ajouter au recipient.',
        {
          chemicalId
        }
      )
    );
  });

  nonInspectActionIds.forEach((actionId, index) => {
    const actionLabel = getActionLabel(actionId, state);
    steps.push(
      buildStep(
        `action_${actionId}_${index}`,
        'action',
        actionLabel,
        `Execute l action ${actionLabel.toLowerCase()} sur l element selectionne pour faire avancer l experience.`,
        {
          actionId
        }
      )
    );
  });

  if (needsInspectStep) {
    const observables = unique(toArray(experiment.reactionModel?.observables)).join(', ');
    steps.push(
      buildStep(
        'observe',
        'observe',
        'Inspecter le resultat',
        observables
          ? `Observe les signes attendus: ${observables}.`
          : (experiment.reactionModel?.teacherNarration || 'Observe le resultat experimental et compare-le a l objectif pedagogique.'),
        {
          actionId: 'inspect'
        }
      )
    );
  }

  return finalizeSteps(steps);
}

export function buildGuideSession(experimentId, presetId = '', state = getState()) {
  const experiment = getExperiment(experimentId, state);
  if (!experiment) return null;

  const stepBundle = buildGuideSteps(experiment, state);

  return {
    enabled: true,
    experimentId: experiment.id,
    presetId,
    title: experiment.titre || experiment.id,
    objective: experiment.objectifPedagogique || '',
    safetyLevel: experiment.safetyLevel || '',
    teacherNarration: experiment.reactionModel?.teacherNarration || '',
    materials: getMaterials(experiment, state),
    ...stepBundle
  };
}

export function activateGuideForExperiment(experimentId, presetId = '', state = getState()) {
  const guideSession = buildGuideSession(experimentId, presetId, state);
  if (!guideSession) return false;
  setGuideSession(guideSession);
  addJournalEntry(`Guide actif: ${guideSession.title}.`, 'success');
  return true;
}

export function deactivateGuide(logMessage = false) {
  const guide = getState().guide;
  clearGuideSession();
  if (logMessage && guide?.enabled) {
    addJournalEntry(`Guide arrete: ${guide.title}.`, 'warning');
  }
}

function stepMatches(step, command, reactionOutput) {
  const actionId = normalizeActionId(command.canonicalActionId || command.rawActionId);

  if (step.kind === 'chemical') {
    return actionId === 'add_chemical' && command.chemicalId === step.chemicalId;
  }

  if (step.kind === 'action') {
    return actionId === step.actionId;
  }

  if (step.kind === 'observe') {
    if (step.actionId && actionId === step.actionId) return true;
    return (reactionOutput?.results || []).some((entry) => entry.matched);
  }

  return false;
}

function getCompletionMessage(step) {
  if (step.kind === 'chemical') {
    return `${step.title} termine.`;
  }

  if (step.kind === 'observe') {
    return 'Observation finale validee.';
  }

  return `Etape terminee: ${step.title}.`;
}

export function advanceGuideWithAction(command, reactionOutput) {
  const currentGuide = getState().guide;
  if (!currentGuide?.enabled || currentGuide.isComplete) return;

  const completedSteps = [];
  let guideCompleted = false;

  updateGuideSession((guide) => {
    if (!guide?.enabled || guide.isComplete) return guide;

    const nextSteps = guide.steps.map((step) => ({ ...step }));
    const currentIndex = nextSteps.findIndex((step) => step.status === 'active');
    if (currentIndex < 0) return guide;

    const currentStep = nextSteps[currentIndex];
    if (!stepMatches(currentStep, command, reactionOutput)) {
      return guide;
    }

    currentStep.status = 'completed';
    completedSteps.push(currentStep);

    const nextPendingIndex = nextSteps.findIndex((step) => step.status === 'pending');
    if (nextPendingIndex >= 0) {
      nextSteps[nextPendingIndex].status = 'active';
    }

    const finalized = finalizeSteps(nextSteps);
    guideCompleted = finalized.isComplete;

    return {
      ...guide,
      ...finalized
    };
  });

  completedSteps.forEach((step) => {
    addJournalEntry(getCompletionMessage(step), 'success');
  });

  if (guideCompleted) {
    const guide = getState().guide;
    addJournalEntry(`Guide termine: ${guide.title}.`, 'success');
  }
}
