import { getCatalogCollections, getChemical, getObject, normalizeActionId } from './CatalogManager.js';
import { getBridgeConnectionItems, getContainedItems, getDepositTargetItem, getImmersedReactantIds, getParentContainer } from './SpatialEngine.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTotalVolume(contents = []) {
  return contents.reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
}

function sanitizeChemicalSet(contents = [], extraChemicalIds = []) {
  return Array.from(new Set([
    ...contents.map((entry) => entry.chemicalId),
    ...extraChemicalIds
  ])).sort();
}

function buildConditions(item, extraReactantCount = 0) {
  const conditions = new Set();
  const contents = item.state.contents || [];
  if (contents.length + Number(extraReactantCount || 0) > 1) conditions.add('mixed');
  if (item.state.lastAction) conditions.add(normalizeActionId(item.state.lastAction));
  if (item.state.isHeated || Number(item.state.temperature || 0) >= 60) conditions.add('heated');
  if (Number(item.state.temperature || 0) >= 70) conditions.add('hot');
  return Array.from(conditions);
}

function getRequiredConditions(reaction) {
  if (Array.isArray(reaction.conditions)) return reaction.conditions.map(normalizeActionId);
  if (Array.isArray(reaction.conditions?.actionRequired)) return reaction.conditions.actionRequired.map(normalizeActionId);
  return [];
}

function reactionMatches(reaction, item, contentIds, conditions, state) {
  const requiredReactants = Array.isArray(reaction.reactants) ? reaction.reactants : [];
  const requiredConditions = getRequiredConditions(reaction);
  const targetObject = getObject(item.catalogId, state);
  const allowedContainerTypes = Array.isArray(reaction.conditions?.containerTypes) ? reaction.conditions.containerTypes : [];
  const temperatureMin = Number(reaction.conditions?.temperatureMin || 0);

  if (!requiredReactants.every((reactant) => contentIds.includes(reactant))) return false;
  if (!requiredConditions.every((condition) => conditions.includes(condition))) return false;
  if (allowedContainerTypes.length && !allowedContainerTypes.includes(targetObject?.type)) return false;
  if (temperatureMin && Number(item.state.temperature || 0) < temperatureMin) return false;
  return true;
}

function buildObservableState(item, reaction, state) {
  const contents = item.state.contents || [];
  const firstContent = contents[0] ? getChemical(contents[0].chemicalId, state) : null;
  const observables = reaction?.observables || {};
  const reactionProfile = reaction?.reactionProfile || {};

  return {
    liquidColor: reaction?.visual?.liquidColor || reactionProfile?.visual?.liquidColor || item.state.visual.liquidColor,
    bubbles: observables.bubbles && observables.bubbles !== 'none',
    steam: observables.steam && observables.steam !== 'none',
    smoke: observables.smoke && observables.smoke !== 'none',
    precipitate: observables.precipitate && observables.precipitate !== 'none',
    flash: observables.flash && observables.flash !== 'none',
    explosion: observables.explosion && observables.explosion !== 'none',
    reactionFlame: observables.flameBurst && observables.flameBurst !== 'none',
    heatHaze: Boolean((observables.heatRelease && observables.heatRelease !== 'none') || item.state.isHeated),
    heatIntensity: observables.heatRelease === 'high'
      ? 1
      : observables.heatRelease === 'medium'
        ? 0.7
        : Math.max(0, Math.min(1, (Number(item.state.temperature || 24) - 24) / 72)),
    surfaceDeposit: observables.surfaceDeposit && observables.surfaceDeposit !== 'none',
    noVisibleReaction: observables.noVisibleReaction && observables.noVisibleReaction !== 'none',
    shouldSteamFromHeat: !reaction && item.state.isHeated && contents.some((entry) => getChemical(entry.chemicalId, state)?.heatBehavior?.canSteam) && Number(item.state.temperature || 0) >= 70,
    isWaterHeating: !reaction && firstContent?.id === 'h2o' && item.state.isHeated
  };
}

function applyReactionState(item, matchedReaction, reactionProfile, state) {
  item.state.reactionId = matchedReaction.id;
  item.state.visual = {
    ...item.state.visual,
    ...buildObservableState(item, {
      ...matchedReaction,
      reactionProfile
    }, state)
  };

  const temperatureDelta = Number(matchedReaction.stateChanges?.temperatureDelta || 0);
  if (temperatureDelta) {
    item.state.temperature += temperatureDelta;
    item.state.isHeated = true;
  }
}

function applyPassiveHeatingState(item, state) {
  const observableState = buildObservableState(item, null, state);
  item.state.visual = {
    ...item.state.visual,
    steam: Boolean(observableState.shouldSteamFromHeat || observableState.isWaterHeating),
    bubbles: Boolean(item.state.isHeated && Number(item.state.temperature || 0) >= 80),
    smoke: false,
    flash: false,
    explosion: false,
    reactionFlame: false,
    heatHaze: Boolean(item.state.isHeated),
    heatIntensity: Math.max(0, Math.min(1, (Number(item.state.temperature || 24) - 24) / 72))
  };
}

function hasChemical(item, chemicalId) {
  return (item.state.contents || []).some((entry) => entry.chemicalId === chemicalId);
}

function clearPremiumSystemVisuals(nextState) {
  (nextState.items || []).forEach((item) => {
    item.state.visual = {
      ...item.state.visual,
      meterActive: false,
      meterValue: '',
      meterMode: '',
      phMeterActive: false,
      phValue: '',
      phTone: '',
      conductivityActive: false,
      conductivityValue: '',
      conductivityUnit: '',
      conductivityTone: '',
      currentFlow: false,
      ionicBridge: false,
      splitBubbles: false,
      electrolysisGlow: false,
      chargeLabels: false,
      currentPulse: false,
      electrodeGlow: false,
      anodeLabel: '',
      cathodeLabel: ''
    };

    if (['electrode_zinc', 'electrode_copper', 'electrode_pair'].includes(item.catalogId)) {
      item.state.visual.surfaceDeposit = false;
    }
  });
}

function buildSystemReactionResult(itemInstanceId, journalMessages, message, extra = {}) {
  return {
    matched: true,
    suppressFlash: true,
    itemInstanceId,
    observables: {},
    journalMessages,
    message,
    ...extra
  };
}

function getChemicalSignal(chemical, mode) {
  if (!chemical) return mode === 'ph' ? 0 : 0.08;

  if (mode === 'ph') {
    switch (chemical.id) {
      case 'hcl':
        return -6;
      case 'naoh':
        return 6;
      case 'acide_carboxylique_simple':
        return -3.8;
      case 'cuso4':
        return -2.4;
      case 'agno3':
        return -1.1;
      case 'znso4':
        return -0.8;
      default:
        if (chemical.category === 'acid') return -4.2;
        if (chemical.category === 'base') return 4.2;
        if (chemical.category === 'salt') return -0.4;
        return 0;
    }
  }

  switch (chemical.id) {
    case 'h2o':
      return 0.06;
    case 'hcl':
    case 'naoh':
      return 11.8;
    case 'electrolyte_support':
      return 8.9;
    case 'cuso4':
    case 'agno3':
    case 'znso4':
      return 8.2;
    default:
      if (chemical.category === 'salt') return 7.4;
      if (chemical.category === 'acid' || chemical.category === 'base') return 9.6;
      if (chemical.category === 'organic') return 0.14;
      if (chemical.category === 'indicator') return 0.34;
      return 0.2;
  }
}

function getPhReading(containerItem, state) {
  const contents = containerItem?.state?.contents || [];
  const totalVolume = getTotalVolume(contents);
  if (!totalVolume) return null;

  const weightedSignal = contents.reduce((sum, entry) => {
    const chemical = getChemical(entry.chemicalId, state);
    return sum + (getChemicalSignal(chemical, 'ph') * Number(entry.volumeMl || 0));
  }, 0) / totalVolume;

  const value = clamp(7 + weightedSignal, 0, 14);
  const tone = value < 3
    ? '#ff8d72'
    : value < 6
      ? '#ffbf72'
      : value < 8
        ? '#8dff9a'
        : value < 11
          ? '#7ed7ff'
          : '#8ea5ff';

  return {
    value: value.toFixed(1),
    tone
  };
}

function getConductivityReading(containerItem, state) {
  const contents = containerItem?.state?.contents || [];
  const totalVolume = getTotalVolume(contents);
  if (!totalVolume) return null;

  const milliSiemens = contents.reduce((sum, entry) => {
    const chemical = getChemical(entry.chemicalId, state);
    return sum + (getChemicalSignal(chemical, 'conductivity') * Number(entry.volumeMl || 0));
  }, 0) / totalVolume;

  const normalizedValue = clamp(milliSiemens, 0.03, 18);
  const tone = normalizedValue < 1
    ? '#8feaff'
    : normalizedValue < 6
      ? '#76f5ff'
      : '#62ffd8';

  if (normalizedValue < 1) {
    return {
      value: String(Math.round(normalizedValue * 1000)),
      unit: 'uS/cm',
      tone
    };
  }

  return {
    value: normalizedValue >= 10 ? normalizedValue.toFixed(1) : normalizedValue.toFixed(2),
    unit: 'mS/cm',
    tone
  };
}

function findItemByCatalogId(nextState, catalogId) {
  return (nextState.items || []).find((item) => item.catalogId === catalogId) || null;
}

function evaluateDaniellSystem(nextState, transformationResult, results) {
  const meter = findItemByCatalogId(nextState, 'voltmeter_simple');
  const bridge = findItemByCatalogId(nextState, 'salt_bridge');
  if (!meter || !bridge) return;

  const bridgeContainers = getBridgeConnectionItems(bridge, nextState);
  if (bridgeContainers.length !== 2) return;

  const zincCell = bridgeContainers.find((item) => hasChemical(item, 'znso4') && getContainedItems(item, nextState).some((child) => child.catalogId === 'electrode_zinc')) || null;
  const copperCell = bridgeContainers.find((item) => hasChemical(item, 'cuso4') && getContainedItems(item, nextState).some((child) => child.catalogId === 'electrode_copper')) || null;
  if (!zincCell || !copperCell) return;

  const zincElectrode = getContainedItems(zincCell, nextState).find((child) => child.catalogId === 'electrode_zinc') || null;
  const copperElectrode = getContainedItems(copperCell, nextState).find((child) => child.catalogId === 'electrode_copper') || null;
  if (!zincElectrode || !copperElectrode) return;
  const zincVolume = getTotalVolume(zincCell.state.contents || []);
  const copperVolume = getTotalVolume(copperCell.state.contents || []);
  const referenceVolume = Math.max(zincVolume, copperVolume, 1);
  const imbalance = Math.abs(zincVolume - copperVolume) / referenceVolume;
  const voltage = clamp(1.10 - (imbalance * 0.04), 1.04, 1.10);

  const wasActive = Boolean(meter.state.visual.meterActive);

  meter.state.visual = {
    ...meter.state.visual,
    meterActive: true,
    meterValue: `${voltage.toFixed(2)} V`,
    meterMode: 'DC',
    currentFlow: true
  };
  bridge.state.visual = {
    ...bridge.state.visual,
    ionicBridge: true,
    currentFlow: true
  };
  zincElectrode.state.visual = {
    ...zincElectrode.state.visual,
    currentFlow: true,
    electrodeGlow: true
  };
  copperElectrode.state.visual = {
    ...copperElectrode.state.visual,
    currentFlow: true,
    electrodeGlow: true,
    surfaceDeposit: true
  };
  zincCell.state.visual = {
    ...zincCell.state.visual,
    heatHaze: false
  };
  copperCell.state.visual = {
    ...copperCell.state.visual,
    heatHaze: false
  };

  if (!wasActive) {
    results.push(buildSystemReactionResult(
      meter.instanceId,
      [
        'La pile Daniell est fermee: le zinc s oxyde et le cuivre se reduit.',
        'Le pont salin laisse migrer les ions et le voltmetre affiche une tension.'
      ],
      'Pile Daniell active.',
      {
        systemType: 'daniell'
      }
    ));
  }
}

function evaluateSensorSystems(nextState) {
  (nextState.items || []).forEach((item) => {
    if (item.catalogId === 'ph_meter_basic') {
      const container = getParentContainer(item, nextState);
      const reading = container ? getPhReading(container, nextState) : null;
      if (!reading) return;

      item.state.visual = {
        ...item.state.visual,
        phMeterActive: true,
        phValue: reading.value,
        phTone: reading.tone
      };
    }

    if (item.catalogId === 'conductivity_meter_basic') {
      const container = getParentContainer(item, nextState);
      const reading = container ? getConductivityReading(container, nextState) : null;
      if (!reading) return;

      item.state.visual = {
        ...item.state.visual,
        conductivityActive: true,
        conductivityValue: reading.value,
        conductivityUnit: reading.unit,
        conductivityTone: reading.tone
      };
    }
  });
}

function evaluateElectrolysisSystem(nextState, transformationResult, results) {
  const tank = findItemByCatalogId(nextState, 'electrolysis_tank');
  const source = findItemByCatalogId(nextState, 'power_source');
  if (!tank || !source) return;

  const electrodePair = getContainedItems(tank, nextState).find((child) => child.catalogId === 'electrode_pair') || null;
  const sourceActive = Boolean(source.state.isHeated || source.state.visual.flame);
  const electrolyticSolutionReady = hasChemical(tank, 'h2o') && hasChemical(tank, 'electrolyte_support');
  if (!electrodePair || !electrolyticSolutionReady || !sourceActive) return;

  const wasActive = Boolean(tank.state.visual.splitBubbles);

  tank.state.visual = {
    ...tank.state.visual,
    bubbles: true,
    splitBubbles: true,
    electrolysisGlow: true,
    chargeLabels: true,
    anodeLabel: 'O2',
    cathodeLabel: 'H2'
  };
  source.state.visual = {
    ...source.state.visual,
    currentPulse: true
  };
  electrodePair.state.visual = {
    ...electrodePair.state.visual,
    currentFlow: true,
    electrodeGlow: true
  };

  if (!wasActive) {
    results.push(buildSystemReactionResult(
      tank.instanceId,
      [
        'Le courant traverse la cuve et des bulles apparaissent aux deux electrodes.',
        'Le degagement gazeux est plus important du cote du dihydrogene.'
      ],
      'Electrolyse active.',
      {
        systemType: 'electrolysis'
      }
    ));
  }
}

export function evaluateReactions(nextState, transformationResult) {
  const { reactions = [], reactionProfiles = [] } = getCatalogCollections(nextState);
  const reactionProfileIndex = reactionProfiles.reduce((index, profile) => {
    index[profile.id] = profile;
    return index;
  }, {});

  const results = [];
  clearPremiumSystemVisuals(nextState);
  const affectedItems = Array.from(new Set(transformationResult.affectedItemIds || []))
    .map((instanceId) => nextState.items.find((entry) => entry.instanceId === instanceId))
    .filter(Boolean);

  affectedItems.forEach((item) => {
    const targetObject = getObject(item.catalogId, nextState);
    if (targetObject?.type !== 'container') return;

    const immersedReactantIds = getImmersedReactantIds(item, nextState);
    const contentIds = sanitizeChemicalSet(item.state.contents || [], immersedReactantIds);
    if (!contentIds.length) return;

    const conditions = buildConditions(item, immersedReactantIds.length);
    const matchedReaction = reactions.find((reaction) => reactionMatches(reaction, item, contentIds, conditions, nextState)) || null;

    if (!matchedReaction) {
      applyPassiveHeatingState(item, nextState);
      results.push({
        matched: false,
        itemInstanceId: item.instanceId,
        contentIds,
        conditions,
        observables: {
          noVisibleReaction: item.state.contents.length > 1 ? 'medium' : 'low'
        },
        journalMessages: item.state.visual.steam ? ['De la vapeur apparait.'] : []
      });
      return;
    }

    const reactionProfile = matchedReaction.reactionProfileId ? reactionProfileIndex[matchedReaction.reactionProfileId] || null : null;
    applyReactionState(item, matchedReaction, reactionProfile, nextState);
    const depositTargetItem = matchedReaction.observables?.surfaceDeposit && matchedReaction.observables.surfaceDeposit !== 'none'
      ? getDepositTargetItem(item, nextState)
      : null;
    if (depositTargetItem) {
      depositTargetItem.state.reactionId = matchedReaction.id;
      depositTargetItem.state.visual = {
        ...depositTargetItem.state.visual,
        surfaceDeposit: true
      };
    }

    results.push({
      matched: true,
      itemInstanceId: item.instanceId,
      immersedItemIds: getContainedItems(item, nextState).map((entry) => entry.instanceId),
      depositTargetItemId: depositTargetItem?.instanceId || '',
      reaction: matchedReaction,
      reactionProfile,
      contentIds,
      conditions,
      products: matchedReaction.products || [],
      observables: matchedReaction.observables || {},
      stateChanges: matchedReaction.stateChanges || {},
      journalMessages: matchedReaction.journalMessages || [],
      message: matchedReaction.message || 'Reaction detectee.'
    });
  });

  evaluateDaniellSystem(nextState, transformationResult, results);
  evaluateElectrolysisSystem(nextState, transformationResult, results);
  evaluateSensorSystems(nextState);

  return {
    nextState,
    results
  };
}
