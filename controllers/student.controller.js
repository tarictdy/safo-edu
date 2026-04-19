const {
  getProfile,
  updateProfile,
  updateContactSettings,
  updatePreferences,
  updateDifficulties,
  saveFixedCourses,
  saveExams,
  saveAssignments,
  saveImportantDays,
  getParentLinkRequests,
  respondToParentLinkRequest
} = require('../services/student.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function profile(req, res) {
  try {
    const student = await getProfile(req.user.uid);
    return sendSuccess(res, student);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function updateProfileAction(req, res) {
  try {
    const student = await updateProfile(req.user.uid, req.body);
    return sendSuccess(res, student, 'Profil mis a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function updateContactSettingsAction(req, res) {
  try {
    const contact = await updateContactSettings(req.user.uid, req.body || {});
    return sendSuccess(res, contact, 'Contact et notifications mis a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function updatePreferencesAction(req, res) {
  try {
    const preferences = await updatePreferences(req.user.uid, req.body || {});
    return sendSuccess(res, preferences, 'Preferences mises a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function updateDifficultiesAction(req, res) {
  try {
    const difficulties = await updateDifficulties(req.user.uid, req.body.difficulties || req.body);
    return sendSuccess(res, difficulties, 'Difficultes mises a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function saveFixedCoursesAction(req, res) {
  try {
    const fixedCourses = await saveFixedCourses(req.user.uid, req.body.fixedCourses || req.body);
    return sendSuccess(res, fixedCourses, 'Cours fixes enregistres.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function saveExamsAction(req, res) {
  try {
    const exams = await saveExams(req.user.uid, req.body.exams || req.body);
    return sendSuccess(res, exams, 'Compositions enregistrees.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function saveAssignmentsAction(req, res) {
  try {
    const assignments = await saveAssignments(req.user.uid, req.body.assignments || req.body);
    return sendSuccess(res, assignments, 'Devoirs planifies enregistres.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function saveImportantDaysAction(req, res) {
  try {
    const importantDays = await saveImportantDays(req.user.uid, req.body.importantDays || req.body);
    return sendSuccess(res, importantDays, 'Jours importants enregistres.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function parentRequestsAction(req, res) {
  try {
    const requests = await getParentLinkRequests(req.user.uid);
    return sendSuccess(res, requests);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function respondToParentRequestAction(req, res) {
  try {
    const link = await respondToParentLinkRequest(req.user.uid, req.params.linkId, req.body.decision);
    return sendSuccess(res, link, 'Demande parent mise a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = {
  profile,
  updateProfileAction,
  updateContactSettingsAction,
  updatePreferencesAction,
  updateDifficultiesAction,
  saveFixedCoursesAction,
  saveExamsAction,
  saveAssignmentsAction,
  saveImportantDaysAction,
  parentRequestsAction,
  respondToParentRequestAction
};
