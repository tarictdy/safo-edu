const {
  generateCurrentSchedule,
  generateEvolvingSchedules,
  getCurrentSchedule,
  getCurrentScheduleStats,
  getEvolvingSchedules
} = require('../services/schedule.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function generate(req, res) {
  try {
    const schedule = await generateCurrentSchedule(req.user.uid, req.body || {});
    return sendSuccess(res, schedule, 'Planning genere.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function generateEvolving(req, res) {
  try {
    const payload = await generateEvolvingSchedules(req.user.uid, req.body || {});
    return sendSuccess(res, payload, 'Planning evolutif genere sur plusieurs semaines.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function evolving(req, res) {
  try {
    const payload = await getEvolvingSchedules(req.user.uid);
    return sendSuccess(res, payload);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function current(req, res) {
  try {
    const schedule = await getCurrentSchedule(req.user.uid);
    if (!schedule) return sendError(res, 'Aucun planning actif.', 404);
    return sendSuccess(res, schedule);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function stats(req, res) {
  try {
    const currentStats = await getCurrentScheduleStats(req.user.uid);
    if (!currentStats) return sendError(res, 'Aucune statistique disponible.', 404);
    return sendSuccess(res, currentStats);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = { generate, generateEvolving, evolving, current, stats };
