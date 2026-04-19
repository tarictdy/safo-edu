const { normalizeActionId, validateActionPayload, validatePresetPayload, validateReactionPayload } = require('../modules/chemistry-lab/chemistryLab.schemas');
const { listSvgManifest, readManifest, readManifestWithFallback } = require('../modules/chemistry-lab/chemistryLab.repository');
const { CONTAINER_SUB_TYPES, createError } = require('../modules/chemistry-lab/chemistryLab.constants');

function buildIndex(entries = []) {
  return entries.reduce((accumulator, entry) => {
    accumulator[entry.id] = entry;
    return accumulator;
  }, {});
}

function toLegacyActionId(actionId = '') {
  return String(actionId || '').replace(/_/g, '-');
}

function inferObjectType(entry = {}) {
  if (entry.kind === 'object' && entry.type) return entry.type;
  if (entry.subType === 'container') return 'container';
  if (entry.subType === 'heater') return 'heater';
  if (entry.subType === 'support') return 'support';
  if (entry.subType === 'measurement-tool') return 'sensor';
  return 'tool';
}

function inferObjectZones(entry = {}) {
  const asset = String(entry.asset || '');
  if (asset.includes('beaker')) {
    return {
      shell: 'beaker-shell',
      liquidZone: 'beaker-liquid-zone',
      effectZone: 'beaker-effect-zone',
      heatZone: 'beaker-effect-zone'
    };
  }
  if (asset.includes('erlenmeyer')) {
    return {
      shell: 'flask-shell',
      liquidZone: 'flask-liquid-zone',
      effectZone: 'flask-effect-zone',
      heatZone: 'flask-effect-zone'
    };
  }
  if (asset.includes('test-tube')) {
    return {
      shell: 'tube-shell',
      liquidZone: 'tube-liquid-zone',
      effectZone: 'tube-effect-zone',
      heatZone: 'tube-effect-zone'
    };
  }
  if (asset.includes('bunsen-burner')) {
    return {
      shell: 'burner-base',
      effectZone: 'burner-effect-zone',
      heatZone: 'burner-flame-zone'
    };
  }
  if (asset.includes('thermometer')) {
    return {
      shell: 'thermometer-shell',
      heatZone: 'thermometer-heat-zone'
    };
  }
  return {
    shell: 'shell',
    effectZone: 'effect-zone'
  };
}

function normalizeObject(entry = {}) {
  const objectType = inferObjectType(entry);
  const category = entry.category || entry.type || 'equipment';
  const canonicalAllowedActions = Array.isArray(entry.allowedActions)
    ? entry.allowedActions.map((actionId) => normalizeActionId(actionId))
    : [];

  return {
    kind: 'object',
    attachPoints: Array.isArray(entry.attachPoints) ? entry.attachPoints : [],
    zones: entry.zones || inferObjectZones(entry),
    constraints: {
      needsSupport: Boolean(entry.constraints?.needsSupport),
      canBeHeatedDirectly: typeof entry.constraints?.canBeHeatedDirectly === 'boolean'
        ? entry.constraints.canBeHeatedDirectly
        : Boolean(entry.acceptsHeat),
      canReceivePour: typeof entry.constraints?.canReceivePour === 'boolean'
        ? entry.constraints.canReceivePour
        : objectType === 'container'
    },
    acceptsChemicals: Boolean(entry.acceptsChemicals),
    acceptsHeat: Boolean(entry.acceptsHeat),
    capacityMl: Number(entry.capacityMl || 0),
    allowedActions: canonicalAllowedActions,
    defaultPlacement: entry.defaultPlacement || { width: 120, height: 120 },
    ...entry,
    type: objectType,
    category
  };
}

function createLegacyItemView(objectEntry = {}) {
  return {
    id: objectEntry.id,
    name: objectEntry.name,
    type: objectEntry.category,
    category: objectEntry.category,
    subType: objectEntry.type,
    asset: objectEntry.asset,
    capacityMl: objectEntry.capacityMl || 0,
    allowedActions: (objectEntry.allowedActions || []).map(toLegacyActionId),
    acceptsChemicals: Boolean(objectEntry.acceptsChemicals),
    acceptsHeat: Boolean(objectEntry.acceptsHeat),
    stackable: Boolean(objectEntry.stackable),
    defaultPlacement: objectEntry.defaultPlacement || { width: 120, height: 120 }
  };
}

function normalizeChemical(entry = {}) {
  const baseColor = entry.baseColor || entry.color || '#99d7ff';
  const category = entry.category || 'solution';
  const dangerLevel = entry.dangerLevel || entry.safety?.level || 'low';
  const reactionTags = Array.isArray(entry.reactionTags) ? entry.reactionTags : [category].filter(Boolean);

  return {
    kind: 'chemical',
    state: entry.state || 'aqueous',
    baseColor,
    color: baseColor,
    opacity: typeof entry.opacity === 'number' ? entry.opacity : 0.82,
    mixBehavior: entry.mixBehavior || (entry.state === 'solid' ? 'heterogeneous' : 'homogeneous'),
    heatBehavior: {
      stable: entry.heatBehavior?.stable ?? true,
      canSteam: entry.heatBehavior?.canSteam ?? (entry.id === 'h2o'),
      canDarken: entry.heatBehavior?.canDarken ?? false
    },
    reactionTags,
    visualTraits: {
      defaultBubbleProfile: entry.visualTraits?.defaultBubbleProfile || null,
      defaultSteamProfile: entry.visualTraits?.defaultSteamProfile || null,
      defaultPrecipitateProfile: entry.visualTraits?.defaultPrecipitateProfile || null
    },
    safety: {
      level: dangerLevel,
      requiresWarning: entry.safety?.requiresWarning ?? (dangerLevel === 'medium' || dangerLevel === 'high')
    },
    defaultVolumeMl: Number(entry.defaultVolumeMl || 10),
    compatibleContainers: Array.isArray(entry.compatibleContainers) ? entry.compatibleContainers : [],
    ...entry,
    category,
    dangerLevel
  };
}

function normalizeAction(entry = {}) {
  const legacyId = entry.id || 'inspect';
  const canonicalId = entry.canonicalId || normalizeActionId(legacyId);
  return {
    kind: 'action',
    requiresTarget: true,
    requiresSource: false,
    needsConstraintValidation: true,
    stateTransformers: [],
    defaultEffectHints: [],
    ...entry,
    id: legacyId,
    canonicalId,
    allowedTargetTypes: Array.isArray(entry.allowedTargetTypes) ? entry.allowedTargetTypes : []
  };
}

function deriveObservables(reaction = {}) {
  const effects = Array.isArray(reaction.effects) ? reaction.effects : [];
  const visual = reaction.visual || {};
  return {
    colorShift: reaction.observables?.colorShift || (visual.liquidColor ? 'medium' : 'none'),
    heatRelease: reaction.observables?.heatRelease || (effects.includes('heat') ? 'medium' : 'none'),
    bubbles: reaction.observables?.bubbles || (visual.bubbles ? 'light' : (effects.some((effect) => effect.includes('bubbles')) ? 'light' : 'none')),
    steam: reaction.observables?.steam || (visual.steam ? 'light' : 'none'),
    smoke: reaction.observables?.smoke || (visual.smoke ? 'medium' : (effects.includes('smoke') ? 'medium' : 'none')),
    precipitate: reaction.observables?.precipitate || (visual.precipitate ? 'medium' : 'none'),
    flash: reaction.observables?.flash || (visual.flash ? 'light' : 'none'),
    flameBurst: reaction.observables?.flameBurst || (effects.includes('flame') ? 'medium' : 'none'),
    explosion: reaction.observables?.explosion || (effects.includes('explosion') ? 'medium' : 'none'),
    surfaceDeposit: reaction.observables?.surfaceDeposit || (effects.includes('surfaceDeposit') ? 'medium' : 'none'),
    foam: reaction.observables?.foam || 'none',
    noVisibleReaction: reaction.observables?.noVisibleReaction || 'none'
  };
}

function normalizeReaction(entry = {}) {
  const journalMessages = Array.isArray(entry.journalMessages)
    ? entry.journalMessages
    : (entry.message ? [entry.message] : []);

  return {
    kind: 'reaction',
    reactionType: entry.reactionType || entry.type || 'mixing',
    observables: deriveObservables(entry),
    stateChanges: entry.stateChanges || {},
    journalMessages,
    conditions: entry.conditions || {},
    products: Array.isArray(entry.products) ? entry.products : (entry.results || []),
    effects: Array.isArray(entry.effects) ? entry.effects : [],
    ...entry
  };
}

function normalizeExperiment(entry = {}) {
  return {
    expectedReactionIds: Array.isArray(entry.expectedReactionIds)
      ? entry.expectedReactionIds
      : (entry.reactionModel?.reactants ? [] : []),
    requiredObjects: Array.isArray(entry.requiredObjects) ? entry.requiredObjects : (entry.instruments || []),
    requiredChemicals: Array.isArray(entry.requiredChemicals) ? entry.requiredChemicals : (entry.reactifs || []),
    successCriteria: Array.isArray(entry.successCriteria) ? entry.successCriteria : (entry.reactionModel?.observables || []),
    ...entry
  };
}

function sanitizeChemicalSet(contents = []) {
  return Array.from(new Set(contents.map((entry) => entry.chemicalId))).sort();
}

function getChemicalMixtureColor(contents = [], chemicalIndex = {}) {
  const colors = contents
    .map((entry) => chemicalIndex[entry.chemicalId]?.baseColor || chemicalIndex[entry.chemicalId]?.color)
    .filter(Boolean);

  if (!colors.length) return '#9ed8ff';

  const totals = colors.reduce((accumulator, color) => {
    const normalized = color.replace('#', '');
    if (normalized.length !== 6) return accumulator;
    accumulator.red += parseInt(normalized.slice(0, 2), 16);
    accumulator.green += parseInt(normalized.slice(2, 4), 16);
    accumulator.blue += parseInt(normalized.slice(4, 6), 16);
    accumulator.count += 1;
    return accumulator;
  }, { red: 0, green: 0, blue: 0, count: 0 });

  if (!totals.count) return '#9ed8ff';

  const toHex = (value) => Math.round(value / totals.count).toString(16).padStart(2, '0');
  return `#${toHex(totals.red)}${toHex(totals.green)}${toHex(totals.blue)}`;
}

function buildReactionConditions(item, providedConditions = []) {
  const conditions = new Set(providedConditions);
  const contents = item?.state?.contents || [];

  if (contents.length > 1) conditions.add('mixed');
  if (item?.state?.isHeated || Number(item?.state?.temperature || 0) >= 60) conditions.add('heated');
  if (item?.state?.lastAction === 'stir') conditions.add('stirred');
  if (item?.state?.lastAction === 'pour') conditions.add('poured');

  return Array.from(conditions);
}

function reactionMatches(reaction, contentIds, conditions) {
  const requiredReactants = Array.isArray(reaction.reactants) ? reaction.reactants : [];
  const reactionConditions = reaction.conditions || {};
  const requiredConditions = Array.isArray(reactionConditions)
    ? reactionConditions
    : (Array.isArray(reactionConditions.actionRequired) ? reactionConditions.actionRequired.map(normalizeActionId) : []);

  return requiredReactants.every((reactantId) => contentIds.includes(reactantId))
    && requiredConditions.every((condition) => conditions.includes(condition) || conditions.includes(normalizeActionId(condition)));
}

async function loadAllData() {
  const [
    objectsRaw,
    chemicalsRaw,
    actionsRaw,
    reactionsRaw,
    presets,
    curriculum,
    experimentsRaw,
    reactionProfiles,
    effectProfiles,
    constraints
  ] = await Promise.all([
    readManifestWithFallback('objects.json', 'instruments.json'),
    readManifest('chemicals.json'),
    readManifest('actions.json'),
    readManifest('reactions.json'),
    readManifest('presets.json'),
    readManifestWithFallback('curriculum.json', 'curriculum.manifest.json'),
    readManifest('experiments.json'),
    readManifestWithFallback('reactionProfiles.json', 'effectProfiles.json'),
    readManifestWithFallback('effectProfiles.json', 'reactionProfiles.json'),
    readManifestWithFallback('constraints.json')
      .catch((error) => {
        if (error.statusCode === 404) return [];
        throw error;
      })
  ]);

  const objects = objectsRaw.map(normalizeObject);
  const items = objects.map(createLegacyItemView);
  const chemicals = chemicalsRaw.map(normalizeChemical);
  const actions = actionsRaw.map(normalizeAction);
  const reactions = reactionsRaw.map(normalizeReaction);
  const experiments = experimentsRaw.map(normalizeExperiment);

  return {
    objects,
    items,
    chemicals,
    actions,
    reactions,
    presets,
    curriculum,
    experiments,
    reactionProfiles,
    effectProfiles,
    constraints
  };
}

function findAction(actionId, actions = []) {
  const normalized = normalizeActionId(actionId);
  return actions.find((action) => normalizeActionId(action.id) === normalized || action.canonicalId === normalized) || null;
}

async function getCatalog() {
  const [data, assets] = await Promise.all([loadAllData(), listSvgManifest()]);
  const itemsByCategory = data.items.reduce((accumulator, entry) => {
    const key = entry.category || entry.type || 'other';
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(entry);
    return accumulator;
  }, {});

  return {
    objects: data.objects,
    items: data.items,
    itemsByCategory,
    chemicals: data.chemicals,
    actions: data.actions,
    reactions: data.reactions,
    presets: data.presets,
    curriculum: data.curriculum,
    experiments: data.experiments,
    reactionProfiles: data.reactionProfiles,
    effectProfiles: data.effectProfiles,
    constraints: data.constraints,
    assets
  };
}

async function getInstruments() {
  const { items } = await loadAllData();
  return items.filter((entry) => entry.category === 'glassware' || entry.category === 'instrument');
}

async function getChemicals() {
  const { chemicals } = await loadAllData();
  return chemicals;
}

async function getEquipment() {
  const { items } = await loadAllData();
  return items.filter((entry) => entry.category === 'equipment');
}

async function getPresets() {
  const { presets } = await loadAllData();
  return presets;
}

async function getReactions() {
  const { reactions } = await loadAllData();
  return reactions;
}

async function getCurriculum() {
  const { curriculum } = await loadAllData();
  return curriculum;
}

async function getExperiments() {
  const { experiments } = await loadAllData();
  return experiments;
}

async function getReactionProfiles() {
  const { reactionProfiles } = await loadAllData();
  return reactionProfiles;
}

async function getEffectProfiles() {
  const { effectProfiles } = await loadAllData();
  return effectProfiles;
}

async function getConstraints() {
  const { constraints } = await loadAllData();
  return constraints;
}

async function getActions() {
  const { actions } = await loadAllData();
  return actions;
}

async function getAssetsManifest() {
  return listSvgManifest();
}

async function validateAction(payload) {
  const { actionId, item, sourceItem, chemicalId } = validateActionPayload(payload);
  const { objects, actions, chemicals } = await loadAllData();
  const objectIndex = buildIndex(objects);
  const chemicalIndex = buildIndex(chemicals);
  const catalogObject = objectIndex[item.catalogId];
  const sourceObject = sourceItem?.catalogId ? objectIndex[sourceItem.catalogId] : null;
  const action = findAction(actionId, actions);

  if (!catalogObject) {
    throw createError('Objet de catalogue introuvable.', 404, { catalogId: item.catalogId });
  }
  if (!action) {
    throw createError('Action introuvable.', 404, { actionId });
  }

  const allowedActions = Array.isArray(catalogObject.allowedActions)
    ? catalogObject.allowedActions
    : [];

  if (!allowedActions.includes(action.canonicalId)) {
    return {
      valid: false,
      reason: 'action_not_allowed',
      message: `${catalogObject.name} ne supporte pas l action ${action.label}.`
    };
  }

  if (action.canonicalId === 'add_chemical') {
    const chemical = chemicalIndex[chemicalId];
    if (!chemical) {
      return { valid: false, reason: 'chemical_missing', message: 'Produit chimique introuvable.' };
    }
    if (!catalogObject.acceptsChemicals || !CONTAINER_SUB_TYPES.includes(catalogObject.type)) {
      return { valid: false, reason: 'invalid_container', message: 'Ce materiel ne peut pas contenir de produit.' };
    }
    if (Array.isArray(chemical.compatibleContainers) && !chemical.compatibleContainers.includes(catalogObject.id)) {
      return { valid: false, reason: 'incompatible_container', message: `${chemical.name} n est pas prevu pour ${catalogObject.name}.` };
    }
  }

  if (action.canonicalId === 'heat' && !catalogObject.acceptsHeat && catalogObject.type !== 'heater') {
    return { valid: false, reason: 'heat_not_supported', message: `${catalogObject.name} ne supporte pas le chauffage.` };
  }

  if ((action.canonicalId === 'empty' || action.canonicalId === 'tilt' || action.canonicalId === 'pour')
    && !Array.isArray(item?.state?.contents)?.length) {
    const contentCount = Array.isArray(item?.state?.contents) ? item.state.contents.length : 0;
    if (!contentCount) {
      return { valid: false, reason: 'container_empty', message: 'Aucun contenu a manipuler.' };
    }
  }

  if (action.canonicalId === 'pour' && sourceItem && sourceObject && sourceObject.type !== 'container' && sourceObject.type !== 'tool') {
    return { valid: false, reason: 'invalid_source', message: 'La source selectionnee ne peut pas verser.' };
  }

  return {
    valid: true,
    action,
    item: catalogObject,
    sourceItem: sourceObject,
    chemical: chemicalId ? chemicalIndex[chemicalId] || null : null,
    message: `Action ${action.label} validee pour ${catalogObject.name}.`
  };
}

async function evaluateReaction(payload) {
  const { item, conditions: providedConditions } = validateReactionPayload(payload);
  const { objects, chemicals, reactions, reactionProfiles, effectProfiles } = await loadAllData();
  const objectIndex = buildIndex(objects);
  const chemicalIndex = buildIndex(chemicals);
  const reactionProfileIndex = buildIndex(reactionProfiles);
  const catalogObject = objectIndex[item.catalogId];

  if (!catalogObject) {
    throw createError('Objet de catalogue introuvable.', 404, { catalogId: item.catalogId });
  }

  const contents = item.state.contents || [];
  const contentIds = sanitizeChemicalSet(contents);
  const conditions = buildReactionConditions(item, providedConditions);
  const matchedReaction = reactions.find((reaction) => reactionMatches(reaction, contentIds, conditions)) || null;
  const baseColor = getChemicalMixtureColor(contents, chemicalIndex);

  if (!matchedReaction) {
    return {
      matched: false,
      contentIds,
      conditions,
      visual: {
        liquidColor: baseColor,
        bubbles: false,
        steam: Boolean(item.state.isHeated && item.state.temperature >= 70),
        precipitate: false,
        flash: false
      },
      message: contents.length > 1
        ? 'Melange stable detecte. Pas de reaction referencee.'
        : 'Aucune reaction detectee.',
      observables: {
        noVisibleReaction: contents.length ? 'medium' : 'low'
      }
    };
  }

  return {
    matched: true,
    contentIds,
    conditions,
    reaction: matchedReaction,
    reactionProfile: matchedReaction.reactionProfileId ? reactionProfileIndex[matchedReaction.reactionProfileId] || null : null,
    suggestedEffects: effectProfiles.filter((effectProfile) => {
      const effectId = String(effectProfile.id || '');
      const observables = matchedReaction.observables || {};
      if (effectId.includes('heat') && observables.heatRelease && observables.heatRelease !== 'none') return true;
      if (effectId.includes('bubble') && observables.bubbles && observables.bubbles !== 'none') return true;
      if (effectId.includes('steam') && observables.steam && observables.steam !== 'none') return true;
      if (effectId.includes('smoke') && observables.smoke && observables.smoke !== 'none') return true;
      if (effectId.includes('precipitate') && observables.precipitate && observables.precipitate !== 'none') return true;
      if (effectId.includes('surface_deposit') && observables.surfaceDeposit && observables.surfaceDeposit !== 'none') return true;
      if (effectId.includes('flash') && observables.flash && observables.flash !== 'none') return true;
      if (effectId.includes('flame') && observables.flameBurst && observables.flameBurst !== 'none') return true;
      if (effectId.includes('explosion') && observables.explosion && observables.explosion !== 'none') return true;
      return false;
    }),
    products: matchedReaction.products || [],
    effects: matchedReaction.effects || [],
    observables: matchedReaction.observables || {},
    stateChanges: matchedReaction.stateChanges || {},
    journalMessages: matchedReaction.journalMessages || [],
    visual: {
      liquidColor: matchedReaction.visual?.liquidColor || baseColor,
      bubbles: Boolean(matchedReaction.visual?.bubbles || (matchedReaction.effects || []).some((effect) => effect.includes('bubbles'))),
      steam: Boolean(matchedReaction.visual?.steam),
      smoke: Boolean(matchedReaction.visual?.smoke),
      precipitate: Boolean(matchedReaction.visual?.precipitate),
      flash: Boolean(matchedReaction.visual?.flash),
      reactionFlame: Boolean(matchedReaction.observables?.flameBurst && matchedReaction.observables.flameBurst !== 'none'),
      explosion: Boolean(matchedReaction.observables?.explosion && matchedReaction.observables.explosion !== 'none')
    },
    message: matchedReaction.message || 'Reaction detectee.'
  };
}

async function loadPreset(payload) {
  const { presetId } = validatePresetPayload(payload);
  const { objects, chemicals, presets } = await loadAllData();
  const preset = presets.find((entry) => entry.id === presetId);

  if (!preset) {
    throw createError('Preset introuvable.', 404, { presetId });
  }

  const objectIndex = buildIndex(objects);
  const chemicalIndex = buildIndex(chemicals);

  return {
    ...preset,
    resolvedItems: (preset.requiredItems || [])
      .map((entryId) => objectIndex[entryId] || chemicalIndex[entryId] || null)
      .filter(Boolean)
  };
}

module.exports = {
  evaluateReaction,
  getActions,
  getAssetsManifest,
  getCatalog,
  getChemicals,
  getConstraints,
  getCurriculum,
  getEffectProfiles,
  getEquipment,
  getExperiments,
  getInstruments,
  getPresets,
  getReactionProfiles,
  getReactions,
  loadPreset,
  validateAction
};
