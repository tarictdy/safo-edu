import { uid } from '../data/localDefaults.js';

export function createEffectInstruction(effectProfile, overrides = {}) {
  return {
    id: overrides.id || uid('effect'),
    effectId: effectProfile.id,
    effectType: effectProfile.type,
    targetInstanceId: overrides.targetInstanceId || '',
    targetZoneType: overrides.targetZoneType || effectProfile.targetZoneType,
    zone: overrides.zone || '',
    startedAt: overrides.startedAt || Date.now(),
    durationMs: Number(overrides.durationMs ?? effectProfile.durationMs ?? 900),
    intensity: Number(overrides.intensity ?? effectProfile.intensity ?? 0.5),
    params: {
      ...(effectProfile.params || {}),
      ...(overrides.params || {})
    }
  };
}

