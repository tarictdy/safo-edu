const {
  registerStudent,
  registerParent,
  loginStudent,
  loginWithEmail,
  getUserByUid
} = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function register(req, res) {
  try {
    const student = await registerStudent(req.body);
    return sendSuccess(res, student, 'Inscription réussie.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function registerStudentAction(req, res) {
  return register(req, res);
}

async function registerParentAction(req, res) {
  try {
    const parent = await registerParent(req.body);
    return sendSuccess(res, parent, 'Compte parent créé.', 201);
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

async function login(req, res) {
  try {
    let result = null;
    if (req.body.email && req.body.password) {
      result = await loginWithEmail(req.body);
    } else {
      result = await loginStudent(req.body);
    }

    if (!result) {
      return sendError(res, 'Identifiants invalides.', 401);
    }

    res.cookie('safio_token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    return sendSuccess(res, {
      token: result.token,
      uid: result.user.uid,
      role: result.user.role,
      fullName: result.user.fullName,
      email: result.user.email,
      matricule: result.user.matricule || null,
      classCode: result.user.classCode || null
    }, 'Connexion réussie.');
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

function logout(req, res) {
  res.clearCookie('safio_token', { path: '/' });
  return sendSuccess(res, {}, 'Déconnexion réussie.');
}

async function me(req, res) {
  try {
    const user = await getUserByUid(req.user.uid);
    if (!user) {
      return sendError(res, 'Profil introuvable.', 404);
    }

    return sendSuccess(res, {
      uid: user.uid,
      role: user.role,
      profile: {
        fullName: user.fullName,
        email: user.email,
        matricule: user.matricule || null,
        classCode: user.classCode || null,
        birthDate: user.birthDate || null,
        phone: user.phone || null
      }
    });
  } catch (error) {
    return sendError(res, error.message || 'Erreur serveur', error.statusCode || 500);
  }
}

module.exports = {
  register,
  registerStudentAction,
  registerParentAction,
  login,
  logout,
  me
};
