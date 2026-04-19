const {
  getParentProfile,
  updateParentContactSettings,
  linkStudent,
  getMyStudents,
  getStudentOverview,
  respondToStudentNotificationAsParent
} = require('../services/parent.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function me(req, res) {
  try {
    const parent = await getParentProfile(req.user.uid);
    return sendSuccess(res, parent);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function updateContactAction(req, res) {
  try {
    const contact = await updateParentContactSettings(req.user.uid, req.body || {});
    return sendSuccess(res, contact, 'Contact parent mis a jour.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function linkStudentAction(req, res) {
  try {
    const link = await linkStudent(req.user.uid, req.body);
    return sendSuccess(res, link, 'Demande de liaison envoyee a l eleve.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function myStudents(req, res) {
  try {
    const students = await getMyStudents(req.user.uid);
    return sendSuccess(res, students);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function studentOverview(req, res) {
  try {
    const overview = await getStudentOverview(req.user.uid, req.params.studentUid);
    return sendSuccess(res, overview);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function respondStudentNotificationAction(req, res) {
  try {
    const result = await respondToStudentNotificationAsParent(
      req.user.uid,
      req.params.studentUid,
      req.params.notificationId,
      req.body.response
    );
    return sendSuccess(res, result, 'Notification eleve traitee.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = {
  me,
  updateContactAction,
  linkStudentAction,
  myStudents,
  studentOverview,
  respondStudentNotificationAction
};
