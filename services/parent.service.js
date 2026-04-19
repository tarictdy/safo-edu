const { readStore, updateStore } = require('../utils/data-store');
const { normalizeMatricule } = require('../utils/matricule.utils');
const { getNotificationInbox, respondToNotification, getMissedSessions } = require('./notification.service');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStudentMatricules(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,\n;]+/);
  return [...new Set(source.map((item) => normalizeMatricule(item)).filter(Boolean))];
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

function slugifyPair(left, right) {
  return `${left}-${right}`.replace(/_/g, '-');
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

function assertParentProfile(store, uid) {
  const parent = store.parents[uid];
  if (!parent) throw createError('Profil parent introuvable.', 404);
  return parent;
}

function assertActiveParentLink(store, parentUid, studentUid) {
  const linkEntry = Object.entries(store.parentStudentLinks || {}).find(([, link]) => (
    link.parentUid === parentUid && link.studentUid === studentUid && link.status === 'active'
  ));
  if (!linkEntry) {
    throw createError('Acces parent non autorise pour cet eleve.', 403);
  }
  return { linkId: linkEntry[0], link: linkEntry[1] };
}

async function getParentProfile(uid) {
  const store = readStore();
  const parent = assertParentProfile(store, uid);
  const links = Object.entries(store.parentStudentLinks || {})
    .filter(([, link]) => link.parentUid === uid)
    .map(([linkId, link]) => ({
      linkId,
      ...link
    }));

  return {
    ...parent,
    links,
    counts: {
      active: links.filter((link) => link.status === 'active').length,
      pending: links.filter((link) => link.status === 'pending_student_confirmation').length,
      rejected: links.filter((link) => link.status === 'rejected').length
    }
  };
}

async function updateParentContactSettings(uid, payload) {
  let updatedContact = null;

  updateStore((draft) => {
    const parent = draft.parents[uid];
    if (!parent) throw createError('Profil parent introuvable.', 404);

    const telegramChatId = normalizeTelegramChatId(
      payload.telegramChatId ?? parent.notificationSettings?.telegramChatId ?? ''
    );

    parent.phone = normalizePhone(payload.phone ?? parent.phone);
    parent.notificationSettings = {
      ...(parent.notificationSettings || {}),
      telegramChatId,
      telegramEnabled: Boolean(telegramChatId)
    };
    parent.updatedAt = new Date().toISOString();

    updatedContact = {
      phone: parent.phone,
      notificationSettings: parent.notificationSettings
    };
    return draft;
  });

  return updatedContact;
}

async function linkStudent(uid, payload) {
  const store = readStore();
  const parent = assertParentProfile(store, uid);
  const studentMatricules = normalizeStudentMatricules(payload.studentMatricules || payload.studentMatricule);

  if (studentMatricules.length === 0) {
    throw createError('Ajoute au moins un matricule eleve.', 400);
  }

  const students = studentMatricules.map((matricule) => {
    const student = Object.values(store.students).find((entry) => entry.matricule === matricule);
    if (!student) throw createError(`Aucun eleve correspondant au matricule ${matricule}.`, 404);
    return student;
  });

  const createdLinks = [];
  updateStore((draft) => {
    students.forEach((student) => {
      const linkId = slugifyPair(uid, student.uid);
      const existing = draft.parentStudentLinks[linkId];
      if (existing && ['active', 'pending_student_confirmation'].includes(existing.status)) {
        throw createError(`Une demande existe deja pour ${student.fullName}.`, 409);
      }

      draft.parentStudentLinks[linkId] = {
        parentUid: uid,
        studentUid: student.uid,
        studentMatricule: student.matricule,
        studentName: student.fullName,
        parentName: parent.fullName,
        relationType: payload.relationType || 'parent',
        requestedAt: new Date().toISOString(),
        linkedAt: null,
        confirmedAt: null,
        rejectedAt: null,
        status: 'pending_student_confirmation'
      };

      createdLinks.push({
        linkId,
        studentUid: student.uid,
        studentMatricule: student.matricule,
        studentName: student.fullName,
        status: 'pending_student_confirmation'
      });
    });

    recomputeParentStatus(draft, uid);
    return draft;
  });

  return {
    parentUid: uid,
    relationType: payload.relationType || 'parent',
    createdLinks
  };
}

async function getMyStudents(uid) {
  const store = readStore();
  assertParentProfile(store, uid);

  return Object.values(store.parentStudentLinks || {})
    .filter((link) => link.parentUid === uid && link.status === 'active')
    .map((link) => {
      const student = store.students[link.studentUid];
      if (!student) return null;
      return {
        uid: student.uid,
        fullName: student.fullName,
        matricule: student.matricule,
        classCode: student.classCode,
        difficulties: student.difficulties || {},
        assignments: student.assignments || []
      };
    })
    .filter(Boolean);
}

async function getStudentOverview(uid, studentUid) {
  const store = readStore();
  assertParentProfile(store, uid);
  assertActiveParentLink(store, uid, studentUid);

  const student = store.students[studentUid];
  if (!student) throw createError('Eleve introuvable.', 404);

  const activeSchedule = student.activeScheduleId ? store.schedules[student.activeScheduleId] || null : null;
  const notifications = await getNotificationInbox(studentUid);
  const missedSessions = await getMissedSessions(studentUid);

  return {
    student: {
      uid: student.uid,
      fullName: student.fullName,
      matricule: student.matricule,
      classCode: student.classCode,
      schoolName: student.schoolName,
      difficulties: student.difficulties || {},
      assignments: student.assignments || [],
      preferences: student.preferences || {},
      notificationSettings: student.notificationSettings || {}
    },
    schedule: activeSchedule,
    notifications,
    missedSessions
  };
}

async function respondToStudentNotificationAsParent(uid, studentUid, notificationId, response) {
  const store = readStore();
  assertParentProfile(store, uid);
  assertActiveParentLink(store, uid, studentUid);
  return respondToNotification(studentUid, notificationId, response);
}

module.exports = {
  getParentProfile,
  updateParentContactSettings,
  linkStudent,
  getMyStudents,
  getStudentOverview,
  respondToStudentNotificationAsParent
};
