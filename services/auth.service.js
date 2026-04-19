const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { readStore, updateStore } = require('../utils/data-store');
const { normalizeMatricule } = require('../utils/matricule.utils');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function makeUid(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizePhone(value) {
  if (!value) return '';
  return String(value).replace(/[^\d+]/g, '').slice(0, 20);
}

function normalizeTelegramChatId(value) {
  return String(value || '')
    .trim()
    .replace(/[^\d-]/g, '')
    .slice(0, 40);
}

function normalizeStudentMatricules(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,\n;]+/);
  return [...new Set(source.map((item) => normalizeMatricule(item)).filter(Boolean))];
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function signSession(user) {
  return jwt.sign(
    {
      uid: user.uid,
      role: user.role,
      matricule: user.matricule || null,
      email: user.email,
      fullName: user.fullName
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' }
  );
}

function buildPublicUser(user) {
  return {
    uid: user.uid,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    avatar: null
  };
}

async function registerStudent(payload) {
  const matricule = normalizeMatricule(payload.matricule);
  const email = String(payload.email).trim().toLowerCase();
  const fullName = payload.fullName || `${payload.prenom || ''} ${payload.nom || ''}`.trim();
  const uid = makeUid('stu');
  const now = new Date().toISOString();

  const store = readStore();
  const existsEmail = Object.values(store.auth_meta).find((entry) => entry.email === email);
  if (existsEmail) throw createError('Cet email est deja utilise.', 409);
  if (Object.values(store.students).find((student) => student.matricule === matricule)) {
    throw createError('Ce matricule existe deja.', 409);
  }

  const telegramChatId = normalizeTelegramChatId(payload.telegramChatId);

  const student = {
    uid,
    fullName,
    email,
    phone: normalizePhone(payload.phone),
    matricule,
    birthDate: payload.birthDate || payload.dateNaissance,
    classCode: payload.classCode || payload.classe,
    schoolName: payload.schoolName || 'SAFIO EDU',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    preferences: {
      preferredStudyMoments: [],
      maxSessionsPerDay: 3,
      maxHoursPerWeek: 18,
      examMode: false
    },
    difficulties: {},
    fixedCourses: [],
    exams: [],
    importantDays: {},
    schoolTimetable: {
      slots: [],
      updatedAt: null
    },
    scheduleAdjustments: [],
    notificationSettings: {
      smsEnabled: false,
      reminderLeadMinutes: 10,
      telegramChatId,
      telegramEnabled: Boolean(telegramChatId)
    },
    assignments: [],
    missedSessions: [],
    notificationTimeline: [],
    sessionTracking: []
  };

  updateStore((draft) => {
    draft.students[uid] = student;
    draft.users_public[uid] = buildPublicUser({ ...student, role: 'student' });
    draft.auth_meta[uid] = {
      uid,
      role: 'student',
      email,
      passwordHash: hashPassword(payload.password || payload.birthDate || payload.dateNaissance),
      status: 'active',
      createdAt: now,
      lastLoginAt: null
    };
    return draft;
  });

  return {
    uid,
    role: 'student',
    fullName,
    email,
    matricule,
    classCode: student.classCode
  };
}

async function registerParent(payload) {
  const email = String(payload.email).trim().toLowerCase();
  const fullName = String(payload.fullName).trim();
  const uid = makeUid('par');
  const now = new Date().toISOString();
  const studentMatricules = normalizeStudentMatricules(payload.studentMatricules || payload.studentMatricule);

  const store = readStore();
  if (Object.values(store.auth_meta).find((entry) => entry.email === email)) {
    throw createError('Cet email est deja utilise.', 409);
  }
  const requestedStudents = studentMatricules.map((matricule) => {
    const student = Object.values(store.students).find((entry) => entry.matricule === matricule);
    if (!student) {
      throw createError(`Aucun eleve trouve pour le matricule ${matricule}.`, 404);
    }
    return student;
  });

  const telegramChatId = normalizeTelegramChatId(payload.telegramChatId);
  const parent = {
    uid,
    fullName,
    email,
    phone: normalizePhone(payload.phone),
    notificationSettings: {
      telegramChatId,
      telegramEnabled: Boolean(telegramChatId)
    },
    childMatricules: studentMatricules,
    status: requestedStudents.length > 0 ? 'pending_student_confirmation' : 'waiting_child_link',
    createdAt: now,
    updatedAt: now
  };

  updateStore((draft) => {
    draft.parents[uid] = parent;
    draft.users_public[uid] = buildPublicUser({ ...parent, role: 'parent' });
    draft.auth_meta[uid] = {
      uid,
      role: 'parent',
      email,
      passwordHash: hashPassword(payload.password),
      status: 'active',
      createdAt: now,
      lastLoginAt: null
    };

    requestedStudents.forEach((student) => {
      const linkId = slugify(`${uid}-${student.uid}`);
      draft.parentStudentLinks[linkId] = {
        parentUid: uid,
        studentUid: student.uid,
        studentMatricule: student.matricule,
        studentName: student.fullName,
        parentName: fullName,
        relationType: payload.relationType || 'parent',
        requestedAt: now,
        linkedAt: null,
        confirmedAt: null,
        rejectedAt: null,
        status: 'pending_student_confirmation'
      };
    });

    return draft;
  });

  return {
    uid,
    role: 'parent',
    fullName,
    email,
    phone: parent.phone,
    requestedStudentUids: requestedStudents.map((student) => student.uid),
    requestedStudentMatricules: studentMatricules,
    linkStatus: requestedStudents.length > 0 ? 'pending_student_confirmation' : 'waiting_child_link'
  };
}

async function loginStudent({ matricule, dateNaissance }) {
  const store = readStore();
  const student = Object.values(store.students).find((entry) => entry.matricule === matricule);
  if (!student || student.birthDate !== dateNaissance) return null;

  updateStore((draft) => {
    if (draft.auth_meta[student.uid]) {
      draft.auth_meta[student.uid].lastLoginAt = new Date().toISOString();
    }
    return draft;
  });

  return {
    token: signSession({ ...student, role: 'student' }),
    user: { ...student, role: 'student' }
  };
}

async function loginWithEmail({ email, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const store = readStore();
  const authEntry = Object.values(store.auth_meta).find((entry) => entry.email === normalizedEmail);
  if (!authEntry || authEntry.passwordHash !== hashPassword(password)) return null;

  const profile = authEntry.role === 'student' ? store.students[authEntry.uid] : store.parents[authEntry.uid];
  if (!profile) return null;

  updateStore((draft) => {
    draft.auth_meta[authEntry.uid].lastLoginAt = new Date().toISOString();
    return draft;
  });

  return {
    token: signSession({ ...profile, role: authEntry.role }),
    user: { ...profile, role: authEntry.role }
  };
}

async function getUserByUid(uid) {
  const store = readStore();
  const authEntry = store.auth_meta[uid];
  if (!authEntry) return null;
  const profile = authEntry.role === 'student' ? store.students[uid] : store.parents[uid];
  if (!profile) return null;
  return { ...profile, role: authEntry.role };
}

async function getStudentByMatricule(matricule) {
  const store = readStore();
  return Object.values(store.students).find((entry) => entry.matricule === matricule) || null;
}

module.exports = {
  registerStudent,
  registerParent,
  loginStudent,
  loginWithEmail,
  getUserByUid,
  getStudentByMatricule
};
