import { BOARD_SIZE, deepClone } from '../data/localDefaults.js';

const listeners = new Set();

const initialState = {
  status: 'idle',
  error: '',
  mode: 'free',
  searchTerm: '',
  curriculumFilter: 'all',
  selectedItemId: '',
  selectedExperimentId: '',
  currentExperimentId: '',
  currentPresetId: '',
  catalog: {
    objects: [],
    items: [],
    itemsByCategory: {},
    chemicals: [],
    actions: [],
    reactions: [],
    presets: [],
    curriculum: {},
    experiments: [],
    reactionProfiles: [],
    effectProfiles: [],
    constraints: [],
    assets: {}
  },
  board: {
    ...BOARD_SIZE
  },
  items: [],
  history: [],
  diagnostics: [],
  activeEffects: [],
  renderInstructions: [],
  alerts: [],
  guide: {
    enabled: false,
    experimentId: '',
    presetId: '',
    title: '',
    objective: '',
    safetyLevel: '',
    teacherNarration: '',
    materials: {
      objects: [],
      chemicals: []
    },
    steps: [],
    activeStepIndex: -1,
    completedCount: 0,
    totalCount: 0,
    isComplete: false
  }
};

let state = deepClone(initialState);

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function updateState(updater) {
  const draft = deepClone(state);
  const nextState = updater(draft) || draft;
  state = nextState;
  notify();
}

export function setStatus(status, error = '') {
  updateState((draft) => {
    draft.status = status;
    draft.error = error;
    return draft;
  });
}

export function initializeCatalog(catalog) {
  updateState((draft) => {
    draft.catalog = {
      objects: catalog.objects || [],
      items: catalog.items || [],
      itemsByCategory: catalog.itemsByCategory || {},
      chemicals: catalog.chemicals || [],
      actions: catalog.actions || [],
      reactions: catalog.reactions || [],
      presets: catalog.presets || [],
      curriculum: catalog.curriculum || {},
      experiments: catalog.experiments || [],
      reactionProfiles: catalog.reactionProfiles || [],
      effectProfiles: catalog.effectProfiles || [],
      constraints: catalog.constraints || [],
      assets: catalog.assets || {}
    };
    draft.status = 'ready';
    draft.error = '';
    return draft;
  });
}

export function setSearchTerm(searchTerm) {
  updateState((draft) => {
    draft.searchTerm = searchTerm;
    return draft;
  });
}

export function setCurriculumFilter(curriculumFilter) {
  updateState((draft) => {
    draft.curriculumFilter = curriculumFilter;
    return draft;
  });
}

export function setSelectedExperiment(selectedExperimentId = '') {
  updateState((draft) => {
    draft.selectedExperimentId = selectedExperimentId;
    draft.currentExperimentId = selectedExperimentId;
    return draft;
  });
}

export function replaceRuntime(runtimePatch = {}) {
  updateState((draft) => {
    draft.items = runtimePatch.items || [];
    draft.selectedItemId = runtimePatch.selectedItemId || '';
    if (Object.prototype.hasOwnProperty.call(runtimePatch, 'selectedExperimentId')) {
      draft.selectedExperimentId = runtimePatch.selectedExperimentId || '';
      draft.currentExperimentId = runtimePatch.selectedExperimentId || '';
    }
    if (Object.prototype.hasOwnProperty.call(runtimePatch, 'currentExperimentId')) {
      draft.currentExperimentId = runtimePatch.currentExperimentId || '';
    }
    if (Object.prototype.hasOwnProperty.call(runtimePatch, 'currentPresetId')) {
      draft.currentPresetId = runtimePatch.currentPresetId || '';
    }
    draft.activeEffects = runtimePatch.activeEffects || [];
    draft.renderInstructions = runtimePatch.renderInstructions || [];
    draft.alerts = runtimePatch.alerts || [];
    return draft;
  });
}

export function setGuideSession(guideSession) {
  updateState((draft) => {
    draft.guide = {
      enabled: Boolean(guideSession?.enabled),
      experimentId: guideSession?.experimentId || '',
      presetId: guideSession?.presetId || '',
      title: guideSession?.title || '',
      objective: guideSession?.objective || '',
      safetyLevel: guideSession?.safetyLevel || '',
      teacherNarration: guideSession?.teacherNarration || '',
      materials: {
        objects: guideSession?.materials?.objects || [],
        chemicals: guideSession?.materials?.chemicals || []
      },
      steps: guideSession?.steps || [],
      activeStepIndex: Number.isInteger(guideSession?.activeStepIndex) ? guideSession.activeStepIndex : -1,
      completedCount: Number(guideSession?.completedCount || 0),
      totalCount: Number(guideSession?.totalCount || 0),
      isComplete: Boolean(guideSession?.isComplete)
    };
    return draft;
  });
}

export function updateGuideSession(updater) {
  updateState((draft) => {
    const nextGuide = updater(deepClone(draft.guide)) || draft.guide;
    draft.guide = nextGuide;
    return draft;
  });
}

export function clearGuideSession() {
  updateState((draft) => {
    draft.guide = deepClone(initialState.guide);
    return draft;
  });
}

export function resetStore() {
  state = deepClone(initialState);
  notify();
}
