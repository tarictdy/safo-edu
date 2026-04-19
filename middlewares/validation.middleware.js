const { normalizeDateInput } = require('../utils/date.utils');
const { normalizeMatricule } = require('../utils/matricule.utils');
const { sendError } = require('../utils/response.utils');
const { ACADEMIC_PROGRAMS, mergeAcademicPrograms } = require('../utils/academic-data');
const { readStore, refreshAcademicProgramsFromFirebase } = require('../utils/data-store');

function calculateAge(dateString) {
  const birthDate = new Date(dateString);
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = today.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

async function validateRegisterPayload(req, res, next) {
  const { nom, prenom, fullName, email, dateNaissance, birthDate, matricule, classe, classCode } = req.body;
  const resolvedFullName = fullName || `${prenom || ''} ${nom || ''}`.trim();
  const resolvedBirthDate = birthDate || dateNaissance;
  const resolvedClassCode = classCode || classe;

  if (!resolvedFullName || !email || !resolvedBirthDate || !matricule || !resolvedClassCode) {
    return sendError(res, 'Tous les champs sont obligatoires.', 400);
  }

  const emailNormalized = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNormalized)) {
    return sendError(res, 'Email invalide.', 400);
  }

  const normalizedDate = normalizeDateInput(resolvedBirthDate);
  if (!normalizedDate) {
    return sendError(res, 'Date de naissance invalide.', 400);
  }

  if (calculateAge(normalizedDate) < 8) {
    return sendError(res, 'L eleve doit avoir au moins 8 ans.', 400);
  }

  const normalizedMatricule = normalizeMatricule(matricule);
  if (!normalizedMatricule) {
    return sendError(res, 'Matricule invalide.', 400);
  }

  const normalizedClassCode = String(resolvedClassCode).trim();
  await refreshAcademicProgramsFromFirebase().catch(() => null);
  const programs = mergeAcademicPrograms(ACADEMIC_PROGRAMS, readStore().academic_programs || {});
  if (!programs[normalizedClassCode]) {
    return sendError(res, 'Classe invalide. Selectionne une classe de la 6e a la Terminale.', 400);
  }

  req.body = {
    ...req.body,
    fullName: String(resolvedFullName).trim(),
    email: emailNormalized,
    birthDate: normalizedDate,
    matricule: normalizedMatricule,
    classCode: normalizedClassCode,
    nom: nom ? String(nom).trim() : undefined,
    prenom: prenom ? String(prenom).trim() : undefined,
    phone: String(req.body.phone || '').trim(),
    telegramChatId: String(req.body.telegramChatId || '').trim()
  };

  return next();
}

function validateRegisterParentPayload(req, res, next) {
  const { fullName, email, password, studentMatricule, studentMatricules } = req.body;
  if (!fullName || !email || !password) {
    return sendError(res, 'Tous les champs parent sont obligatoires.', 400);
  }

  const emailNormalized = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNormalized)) {
    return sendError(res, 'Email invalide.', 400);
  }

  const rawMatricules = Array.isArray(studentMatricules)
    ? studentMatricules
    : String(studentMatricules || studentMatricule || '').split(/[,\n;]+/);
  const normalizedMatricules = [...new Set(rawMatricules.map((item) => normalizeMatricule(item)).filter(Boolean))];

  req.body = {
    ...req.body,
    fullName: String(fullName).trim(),
    email: emailNormalized,
    studentMatricule: normalizedMatricules[0] || '',
    studentMatricules: normalizedMatricules,
    phone: String(req.body.phone || '').trim(),
    telegramChatId: String(req.body.telegramChatId || '').trim()
  };

  return next();
}

function validateLoginPayload(req, res, next) {
  const { matricule, dateNaissance, email, password } = req.body;
  if (email || password) {
    if (!email || !password) {
      return sendError(res, 'Email et mot de passe sont obligatoires.', 400);
    }

    req.body = {
      email: String(email).trim().toLowerCase(),
      password: String(password)
    };
    return next();
  }

  if (!matricule || !dateNaissance) {
    return sendError(res, 'Matricule et date de naissance sont obligatoires.', 400);
  }

  const normalizedDate = normalizeDateInput(dateNaissance);
  if (!normalizedDate) {
    return sendError(res, 'Date de naissance invalide.', 400);
  }

  req.body = {
    matricule: normalizeMatricule(matricule),
    dateNaissance: normalizedDate
  };

  return next();
}

module.exports = {
  validateRegisterPayload,
  validateRegisterParentPayload,
  validateLoginPayload
};
