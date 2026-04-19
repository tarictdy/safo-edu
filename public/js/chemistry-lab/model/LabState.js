export function createLabStatePatch(overrides = {}) {
  return {
    mode: overrides.mode || 'free',
    selectedItemId: overrides.selectedItemId || '',
    currentExperimentId: overrides.currentExperimentId || '',
    items: overrides.items || [],
    activeEffects: overrides.activeEffects || [],
    renderInstructions: overrides.renderInstructions || [],
    history: overrides.history || [],
    alerts: overrides.alerts || []
  };
}
