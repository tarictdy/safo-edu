export const BOARD_SIZE = {
  width: 960,
  height: 640
};

export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function uid(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createInitialItemState(catalogItem = {}) {
  const isHeater = catalogItem.subType === 'heater' || catalogItem.type === 'heater';
  return {
    temperature: 24,
    isHeated: false,
    isTilted: false,
    lastAction: '',
    reactionId: '',
    contents: [],
    visual: {
      liquidColor: '#99d7ff',
      liquidOpacity: 0,
      fillLevel: 0,
      meniscusCurve: 7,
      mixingState: 'empty',
      viscosity: 0.22,
      heatIntensity: 0,
      bubbles: false,
      steam: false,
      smoke: false,
      precipitate: false,
      flash: false,
      explosion: false,
      heatHaze: false,
      reactionFlame: false,
      surfaceDeposit: false,
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
      flame: isHeater ? false : false
    }
  };
}

export function formatVolume(contents = []) {
  const total = contents.reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
  return `${Math.round(total)} mL`;
}
