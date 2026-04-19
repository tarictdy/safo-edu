const { readStore, updateStore } = require('../utils/data-store');
const { normalizeDateInput } = require('../utils/date.utils');
const { getCanonicalSubjectLabel } = require('../utils/subject.utils');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getStudentOrThrow(uid) {
  const store = readStore();
  const student = store.students[uid];
  if (!student) throw createError('Profil introuvable.', 404);
  return student;
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

function normalizeReminderLeadMinutes(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(5, Math.min(60, parsed));
}

function normalizeAssignments(assignments = []) {
  if (!Array.isArray(assignments)) return [];

  return assignments
    .map((entry) => {
      const dueDate = normalizeDateInput(entry.dueDate || entry.date || entry.deadline);
      const rawSubjectName = String(entry.subjectName || entry.matiere || '').trim();
      if (!dueDate || !rawSubjectName) return null;

      const subjectName = getCanonicalSubjectLabel(rawSubjectName);
      return {
        assignmentId: entry.assignmentId || null,
        subjectName,
        dueDate,
        level: Number(entry.level || entry.importance || 3),
        title: String(entry.title || entry.label || `Devoir ${subjectName}`).trim(),
        revisionHour: entry.revisionHour || '20:00',
        notes: String(entry.notes || '').trim()
      };
    })
    .filter(Boolean);
}

function recomputeParentStatus(draft, parentUid) {
  const parent = draft.parents[parentUid];
  if (!parent) return;

  const links = Object.values(draft.parentStudentLinks || {}).filter((entry) => entry.parentUid === parentUid);
  if (links.some((entry) => entry.status === 'active')) {
    parent.status = 'active';
  } else if (links.some((entry) => entry.status === 'pending_student_confirmation')) {
    parent.status = 'pending_student_confirmation';
  } else {
    parent.status = 'waiting_child_link';
  }
  parent.updatedAt = new Date().toISOString();
}

async function getProfile(uid) {
  return getStudentOrThrow(uid);
}

async function updateProfile(uid, payload) {
  let updatedStudent;
  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);
    student.fullName = payload.fullName || student.fullName;
    student.classCode = payload.classCode || student.classCode;
    student.schoolName = payload.schoolName || student.schoolName;
    student.phone = normalizePhone(payload.phone || student.phone);
    student.updatedAt = new Date().toISOString();

    draft.users_public[uid] = {
      ...(draft.users_public[uid] || {}),
      fullName: student.fullName,
      email: student.email,
      role: 'student',
      uid
    };

    updatedStudent = student;
    return draft;
  });
  return updatedStudent;
}

async function updateContactSettings(uid, payload) {
  let updatedContact;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    const telegramChatId = normalizeTelegramChatId(
      payload.telegramChatId ?? student.notificationSettings?.telegramChatId ?? ''
    );

    student.phone = normalizePhone(payload.phone || student.phone);
    student.notificationSettings = {
      ...(student.notificationSettings || {}),
      smsEnabled: typeof payload.smsEnabled === 'boolean'
        ? payload.smsEnabled
        : Boolean(student.notificationSettings?.smsEnabled),
      reminderLeadMinutes: normalizeReminderLeadMinutes(
        payload.reminderLeadMinutes,
        normalizeReminderLeadMinutes(student.notificationSettings?.reminderLeadMinutes, 10)
      ),
      telegramChatId,
      telegramEnabled: Boolean(telegramChatId)
    };

    student.updatedAt = new Date().toISOString();
    updatedContact = {
      phone: student.phone,
      notificationSettings: student.notificationSettings
    };

    return draft;
  });

  return updatedContact;
}

async function updatePreferences(uid, payload) {
  let updatedPreferences;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.preferences = {
      ...student.preferences,
      ...payload,
      preferredStudyMoments: Array.isArray(payload.preferredStudyMoments)
        ? payload.preferredStudyMoments.slice(0, 2)
        : student.preferences.preferredStudyMoments
    };

    student.updatedAt = new Date().toISOString();
    updatedPreferences = student.preferences;
    return draft;
  });

  return updatedPreferences;
}

async function updateDifficulties(uid, difficulties) {
  let updatedDifficulties;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.difficulties = { ...student.difficulties, ...difficulties };
    student.updatedAt = new Date().toISOString();
    updatedDifficulties = student.difficulties;
    return draft;
  });

  return updatedDifficulties;
}

async function saveFixedCourses(uid, fixedCourses) {
  let updatedCourses;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.fixedCourses = Array.isArray(fixedCourses) ? fixedCourses : student.fixedCourses;
    student.schoolTimetable = {
      slots: student.fixedCourses,
      updatedAt: new Date().toISOString()
    };

    student.updatedAt = new Date().toISOString();
    updatedCourses = student.fixedCourses;
    return draft;
  });

  return updatedCourses;
}

async function saveExams(uid, exams) {
  let updatedExams;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.exams = Array.isArray(exams) ? exams : student.exams;
    student.updatedAt = new Date().toISOString();
    updatedExams = student.exams;
    return draft;
  });

  return updatedExams;
}

async function saveAssignments(uid, assignments) {
  let updatedAssignments;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.assignments = normalizeAssignments(assignments);
    student.updatedAt = new Date().toISOString();
    updatedAssignments = student.assignments;
    return draft;
  });

  return updatedAssignments;
}

async function saveImportantDays(uid, importantDays) {
  let updatedImportantDays;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    student.importantDays = importantDays || {};
    student.updatedAt = new Date().toISOString();
    updatedImportantDays = student.importantDays;
    return draft;
  });

  return updatedImportantDays;
}

async function getParentLinkRequests(uid) {
  const store = readStore();
  const student = store.students[uid];
  if (!student) throw createError('Profil introuvable.', 404);

  return Object.entries(store.parentStudentLinks || {})
    .filter(([, link]) => link.studentUid === uid && link.status === 'pending_student_confirmation')
    .map(([linkId, link]) => ({
      linkId,
      ...link,
      parent: store.parents[link.parentUid]
        ? {
          uid: link.parentUid,
          fullName: store.parents[link.parentUid].fullName,
          email: store.parents[link.parentUid].email,
          phone: store.parents[link.parentUid].phone || ''
        }
        : null
    }))
    .sort((left, right) => new Date(right.requestedAt || 0) - new Date(left.requestedAt || 0));
}

async function respondToParentLinkRequest(uid, linkId, decision) {
  let updatedLink = null;

  updateStore((draft) => {
    const student = draft.students[uid];
    if (!student) throw createError('Profil introuvable.', 404);

    const link = draft.parentStudentLinks[linkId];
    if (!link || link.studentUid !== uid) {
      throw createError('Demande parent introuvable.', 404);
    }
    if (link.status !== 'pending_student_confirmation') {
      throw createError('Cette demande a deja ete traitee.', 409);
    }

    const normalizedDecision = String(decision || '').toLowerCase();
    if (!['approve', 'approved', 'confirm', 'confirmer', 'reject', 'rejected', 'refuse'].includes(normalizedDecision)) {
      throw createError('Decision invalide.', 400);
    }

    const now = new Date().toISOString();
    if (['approve', 'approved', 'confirm', 'confirmer'].includes(normalizedDecision)) {
      link.status = 'active';
      link.linkedAt = now;
      link.confirmedAt = now;
    } else {
      link.status = 'rejected';
      link.rejectedAt = now;
    }

    recomputeParentStatus(draft, link.parentUid);
    student.updatedAt = now;
    updatedLink = { linkId, ...link };
    return draft;
  });

  return updatedLink;
}

module.exports = {
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
};
