const {
  listClasses,
  getProgramByClass,
  listPrograms,
  saveProgram,
  addSubject,
  updateSubject,
  removeSubject,
  syncOfficialCoefficientPrograms
} = require('../services/academic.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function getClasses(req, res) {
  try {
    const classes = await listClasses();
    return sendSuccess(res, classes);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function getProgram(req, res) {
  try {
    const program = await getProgramByClass(req.params.classCode);
    if (!program) return sendError(res, 'Classe introuvable.', 404);
    return sendSuccess(res, program);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function getPrograms(req, res) {
  try {
    const programs = await listPrograms();
    return sendSuccess(res, programs);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function putProgram(req, res) {
  try {
    const program = await saveProgram(req.params.classCode, req.body || {});
    return sendSuccess(res, program, 'Programme academique enregistre.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function postSubject(req, res) {
  try {
    const program = await addSubject(req.params.classCode, req.body || {});
    return sendSuccess(res, program, 'Matiere ajoutee.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function putSubject(req, res) {
  try {
    const program = await updateSubject(req.params.classCode, req.params.subjectCode, req.body || {});
    return sendSuccess(res, program, 'Matiere mise a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function deleteSubject(req, res) {
  try {
    const program = await removeSubject(req.params.classCode, req.params.subjectCode);
    return sendSuccess(res, program, 'Matiere supprimee de la classe.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function syncOfficialPrograms(req, res) {
  try {
    const result = await syncOfficialCoefficientPrograms();
    return sendSuccess(res, result, 'Coefficients officiels appliques sans suppression de classe.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = {
  getClasses,
  getProgram,
  getPrograms,
  putProgram,
  postSubject,
  putSubject,
  deleteSubject,
  syncOfficialPrograms
};
