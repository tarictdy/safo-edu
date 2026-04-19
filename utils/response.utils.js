function sendSuccess(res, data = {}, message = 'Succès', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendError(res, message = 'Erreur', statusCode = 400, details = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {})
  });
}

module.exports = { sendSuccess, sendError };
