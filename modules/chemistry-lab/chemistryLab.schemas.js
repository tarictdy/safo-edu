const { ACTION_IDS, REACTION_CONDITIONS, createError } = require('./chemistryLab.constants');

function normalizeActionId(actionId) {
  return String(actionId || '').trim().replace(/-/g, '_');
}

function ensureObject(payload, message = 'Payload invalide.') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError(message, 400);
  }
  return payload;
}

function normalizeContents(contents) {
  if (!Array.isArray(contents)) return [];

  return contents
    .map((entry) => {
      const chemicalId = String(entry?.chemicalId || '').trim();
      const volumeMl = Number(entry?.volumeMl || 0);
      if (!chemicalId || !Number.isFinite(volumeMl) || volumeMl <= 0) return null;
      return { chemicalId, volumeMl };
    })
    .filter(Boolean);
}

function validateActionPayload(payload) {
  const data = ensureObject(payload, 'Action invalide.');
  const actionId = normalizeActionId(data.actionId);
  const item = ensureObject(data.item, 'Objet source manquant.');
  const sourceItem = data.sourceItem && typeof data.sourceItem === 'object' ? data.sourceItem : null;
  const chemicalId = data.chemicalId ? String(data.chemicalId).trim() : '';

  if (!ACTION_IDS.map((entry) => normalizeActionId(entry)).includes(actionId)) {
    throw createError('Action inconnue.', 400, { actionId });
  }

  if (!String(item.catalogId || '').trim()) {
    throw createError('catalogId manquant pour l objet.', 400);
  }

  return {
    actionId,
    item: {
      catalogId: String(item.catalogId).trim(),
      type: String(item.type || '').trim(),
      state: ensureObject(item.state || {}, 'Etat objet invalide.')
    },
    sourceItem: sourceItem ? {
      catalogId: String(sourceItem.catalogId || '').trim(),
      type: String(sourceItem.type || '').trim(),
      state: ensureObject(sourceItem.state || {}, 'Etat source invalide.')
    } : null,
    chemicalId
  };
}

function validateReactionPayload(payload) {
  const data = ensureObject(payload, 'Reaction invalide.');
  const item = ensureObject(data.item, 'Objet source manquant.');
  const state = ensureObject(item.state || {}, 'Etat objet invalide.');
  const conditions = Array.isArray(data.conditions)
    ? data.conditions.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];

  conditions.forEach((condition) => {
    if (!REACTION_CONDITIONS.includes(condition)) {
      throw createError('Condition de reaction inconnue.', 400, { condition });
    }
  });

  return {
    item: {
      catalogId: String(item.catalogId || '').trim(),
      type: String(item.type || '').trim(),
      state: {
        temperature: Number(state.temperature || 24),
        isHeated: Boolean(state.isHeated),
        contents: normalizeContents(state.contents)
      }
    },
    conditions
  };
}

function validatePresetPayload(payload) {
  const data = ensureObject(payload, 'Preset invalide.');
  const presetId = String(data.presetId || '').trim();
  if (!presetId) {
    throw createError('presetId requis.', 400);
  }

  return { presetId };
}

module.exports = {
  normalizeActionId,
  validateActionPayload,
  validatePresetPayload,
  validateReactionPayload
};
