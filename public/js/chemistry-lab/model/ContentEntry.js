export function createContentEntry(chemical, volumeMl, overrides = {}) {
  return {
    chemicalId: chemical.id,
    volumeMl: Number(volumeMl || chemical.defaultVolumeMl || 0),
    temperature: Number(overrides.temperature ?? 24),
    mixState: overrides.mixState || chemical.mixBehavior || 'homogeneous'
  };
}

