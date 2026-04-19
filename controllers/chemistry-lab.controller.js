const {
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
} = require('../services/chemistry-lab.service');
const { sendError, sendSuccess } = require('../utils/response.utils');

async function catalog(req, res) {
  try {
    const data = await getCatalog();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function instruments(req, res) {
  try {
    const data = await getInstruments();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function chemicals(req, res) {
  try {
    const data = await getChemicals();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function equipment(req, res) {
  try {
    const data = await getEquipment();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function presets(req, res) {
  try {
    const data = await getPresets();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function reactions(req, res) {
  try {
    const data = await getReactions();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function curriculum(req, res) {
  try {
    const data = await getCurriculum();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function experiments(req, res) {
  try {
    const data = await getExperiments();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function reactionProfiles(req, res) {
  try {
    const data = await getReactionProfiles();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function effectProfiles(req, res) {
  try {
    const data = await getEffectProfiles();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function constraints(req, res) {
  try {
    const data = await getConstraints();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function actions(req, res) {
  try {
    const data = await getActions();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function assetManifest(req, res) {
  try {
    const data = await getAssetsManifest();
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function validateSandboxAction(req, res) {
  try {
    const data = await validateAction(req.body || {});
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function evaluateSandboxReaction(req, res) {
  try {
    const data = await evaluateReaction(req.body || {});
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

async function loadSandboxPreset(req, res) {
  try {
    const data = await loadPreset(req.body || {});
    return sendSuccess(res, data);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500, error.details || null);
  }
}

module.exports = {
  actions,
  assetManifest,
  catalog,
  chemicals,
  constraints,
  curriculum,
  equipment,
  effectProfiles,
  evaluateSandboxReaction,
  experiments,
  instruments,
  loadSandboxPreset,
  presets,
  reactionProfiles,
  reactions,
  validateSandboxAction
};
