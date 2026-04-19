const {
  getNotificationInbox,
  respondToNotification,
  getMissedSessions
} = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function inbox(req, res) {
  try {
    const payload = await getNotificationInbox(req.user.uid);
    return sendSuccess(res, payload);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function respond(req, res) {
  try {
    const result = await respondToNotification(req.user.uid, req.params.notificationId, req.body.response);
    return sendSuccess(res, result, 'Reponse enregistree.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function missed(req, res) {
  try {
    const sessions = await getMissedSessions(req.user.uid);
    return sendSuccess(res, sessions);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = {
  inbox,
  respond,
  missed
};
