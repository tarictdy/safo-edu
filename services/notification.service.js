const crypto = require('crypto');
const { readStore, updateStore } = require('../utils/data-store');
const { isStudyBlock, getSlotDurationHours, LIMITES } = require('../utils/planning-engine');
const { jours, sessionDateFromWeekKey } = require('../utils/week.utils');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isoNow() {
  return new Date().toISOString();
}

function getReminderLeadMinutes(student) {
  const configured = Number(student?.notificationSettings?.reminderLeadMinutes || 10);
  if (!Number.isFinite(configured)) return 10;
  return Math.max(5, Math.min(60, configured));
}

function normalizeSessionLabel(label = '') {
  return String(label)
    .replace(/^Revision\s+/i, '')
    .replace(/^Compo\s+/i, '')
    .replace(/^Cours\s+/i, '')
    .replace(/\s*\(.*\)\s*$/i, '')
    .trim();
}

function getDayLimitHours(day, maxSessionsPerDay) {
  const base = Number(maxSessionsPerDay || 3);
  if (day === 'Samedi' || day === 'Dimanche') {
    return Math.min(base + LIMITES.bonusWeekendSessions, LIMITES.maxSessionsWeekend);
  }
  return base;
}

function recomputeScheduleStats(schedule) {
  const calendar = schedule.calendar || {};
  let totalStudyHours = 0;
  const hoursBySubject = {};
  const warnings = [];
  let balancedDays = 0;

  jours.forEach((day) => {
    const dayMap = calendar[day] || {};
    let dayHours = 0;

    Object.entries(dayMap).forEach(([hour, value]) => {
      if (!isStudyBlock(value)) return;
      const duration = getSlotDurationHours(hour);
      dayHours += duration;
      totalStudyHours += duration;

      const subject = String(value)
        .replace(/^Revision\s+/, '')
        .replace(/^Compo\s+/, '')
        .replace(/\s*\(.*\)\s*$/, '');
      hoursBySubject[subject] = Number(((hoursBySubject[subject] || 0) + duration).toFixed(2));
    });

    dayHours = Number(dayHours.toFixed(2));
    const dayLimit = getDayLimitHours(day, schedule.maxSessionsPerDay);
    if (dayHours <= dayLimit) balancedDays += 1;
    if (dayHours > dayLimit) warnings.push(`${day}: ${dayHours}h (max ${dayLimit}h)`);
  });

  totalStudyHours = Number(totalStudyHours.toFixed(2));
  if (totalStudyHours > Number(schedule.maxHoursPerWeek || 18)) {
    warnings.unshift(`Surcharge hebdomadaire: ${totalStudyHours}h > ${schedule.maxHoursPerWeek}h`);
  }

  const topSubjects = [...(schedule.scores || [])]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 4)
    .map((subject) => ({
      matiere: subject.matiere,
      score: Number(Number(subject.score || 0).toFixed(2)),
      coefficient: subject.coef,
      difficulty: subject.diff,
      isCore: subject.isCore,
      isOptional: subject.isOptional
    }));

  return {
    totalStudyHours,
    hoursBySubject,
    overloadWarnings: warnings,
    balancedDays,
    topSubjects
  };
}

function listScheduleStudySessions(schedule) {
  const sessions = [];
  const calendar = schedule.calendar || {};

  jours.forEach((day) => {
    const dayMap = calendar[day] || {};
    Object.entries(dayMap).forEach(([hour, value]) => {
      if (!isStudyBlock(value)) return;
      sessions.push({
        day,
        hour,
        rawLabel: String(value),
        subjectName: normalizeSessionLabel(value),
        durationHours: getSlotDurationHours(hour)
      });
    });
  });

  return sessions.sort((a, b) => {
    const dayDiff = jours.indexOf(a.day) - jours.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return String(a.hour).localeCompare(String(b.hour));
  });
}

function ensureStudentCollections(student) {
  if (!Array.isArray(student.notificationTimeline)) student.notificationTimeline = [];
  if (!Array.isArray(student.missedSessions)) student.missedSessions = [];
  if (!Array.isArray(student.sessionTracking)) student.sessionTracking = [];
}

function pushStudentEvent(student, event) {
  student.sessionTracking.push(event);
  if (student.sessionTracking.length > 400) {
    student.sessionTracking = student.sessionTracking.slice(-400);
  }
}

function buildNotification(schedule, student, session) {
  const sessionDate = sessionDateFromWeekKey(schedule.weekKey, session.day, session.hour);
  const reminderLeadMinutes = getReminderLeadMinutes(student);
  const reminderAt = new Date(sessionDate.getTime() - reminderLeadMinutes * 60 * 1000);
  const now = new Date();

  const smsEnabled = Boolean(student.notificationSettings?.smsEnabled && student.phone);
  const telegramEnabled = Boolean(
    student.notificationSettings?.telegramEnabled && student.notificationSettings?.telegramChatId
  );
  let status = 'scheduled';
  if (sessionDate <= now) {
    status = 'auto_completed_unconfirmed';
  } else if (reminderAt <= now && sessionDate > now) {
    status = 'pending_response';
  }

  return {
    notificationId: `noti_${crypto.randomUUID()}`,
    studentUid: student.uid,
    scheduleId: schedule.scheduleId,
    weekKey: schedule.weekKey,
    classCode: schedule.classCode,
    day: session.day,
    hour: session.hour,
    subjectName: session.subjectName,
    sessionLabel: session.rawLabel,
    durationHours: session.durationHours,
    sessionStartAt: sessionDate.toISOString(),
    reminderAt: reminderAt.toISOString(),
    reminderLeadMinutes,
    status,
    response: null,
    sentAt: status === 'pending_response' ? isoNow() : null,
    respondedAt: null,
    rescheduledTo: null,
    autoCompletedAt: status === 'auto_completed_unconfirmed' ? isoNow() : null,
    sms: {
      enabled: smsEnabled,
      phone: student.phone || '',
      status: smsEnabled && status === 'pending_response' ? 'queued' : (smsEnabled ? 'scheduled' : 'disabled')
    },
    telegram: {
      enabled: telegramEnabled,
      chatId: student.notificationSettings?.telegramChatId || '',
      status: telegramEnabled && status === 'pending_response' ? 'queued' : (telegramEnabled ? 'scheduled' : 'disabled')
    },
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
}

function archiveWeekNotifications(draft, studentUid, weekKey) {
  Object.values(draft.noti || {}).forEach((notification) => {
    if (notification.studentUid !== studentUid) return;
    if (notification.weekKey !== weekKey) return;
    if (!['scheduled', 'pending_response'].includes(notification.status)) return;

    notification.status = 'cancelled_regenerated';
    notification.updatedAt = isoNow();
  });
}

function queueSmsDispatch(draft, notification) {
  if (!notification.sms?.enabled) return;

  const dispatchId = `sms_${crypto.randomUUID()}`;
  draft.sms_dispatches[dispatchId] = {
    dispatchId,
    notificationId: notification.notificationId,
    studentUid: notification.studentUid,
    phone: notification.sms.phone,
    message: `Rappel SAFIO: ${notification.subjectName} commence a ${notification.hour}. Dispo / pas dispo ?`,
    provider: process.env.SMS_PROVIDER || 'mock',
    status: 'queued',
    createdAt: isoNow()
  };

  notification.sms.status = 'queued';
}

function queueTelegramDispatch(draft, notification) {
  if (!notification.telegram?.enabled) return;

  const dispatchId = `tg_${crypto.randomUUID()}`;
  draft.telegram_dispatches[dispatchId] = {
    dispatchId,
    notificationId: notification.notificationId,
    studentUid: notification.studentUid,
    chatId: notification.telegram.chatId,
    message: `Rappel SAFIO: ${notification.subjectName} commence a ${notification.hour}. Reponds dispo ou pas dispo.`,
    provider: process.env.TELEGRAM_PROVIDER || 'mock',
    status: 'queued',
    createdAt: isoNow()
  };

  notification.telegram.status = 'queued';
}

function createMissedSessionRecord(draft, student, notification, reason) {
  const missedId = `missed_${crypto.randomUUID()}`;
  const record = {
    missedId,
    studentUid: student.uid,
    notificationId: notification.notificationId,
    scheduleId: notification.scheduleId,
    weekKey: notification.weekKey,
    day: notification.day,
    hour: notification.hour,
    subjectName: notification.subjectName,
    reason,
    createdAt: isoNow()
  };

  draft.missed_sessions[missedId] = record;
  student.missedSessions.push(record);
  if (student.missedSessions.length > 300) {
    student.missedSessions = student.missedSessions.slice(-300);
  }
}

function findRescheduleSlot(schedule, fromDay, fromHour) {
  const calendar = schedule.calendar || {};
  const dayStartIndex = Math.max(0, jours.indexOf(fromDay));

  const sortedHours = Object.keys((calendar[jours[0]] || {})).sort();
  const fromHourIndex = Math.max(0, sortedHours.indexOf(fromHour));

  for (let dayIndex = dayStartIndex; dayIndex < jours.length; dayIndex += 1) {
    const day = jours[dayIndex];
    const dayHours = sortedHours;
    const startHourIndex = dayIndex === dayStartIndex ? fromHourIndex + 1 : 0;

    for (let index = startHourIndex; index < dayHours.length; index += 1) {
      const hour = dayHours[index];
      const value = calendar[day]?.[hour];
      if (value !== 'Repos') continue;
      return { day, hour };
    }
  }

  return null;
}

async function syncNotificationsForSchedule(studentUid, schedule) {
  updateStore((draft) => {
    const student = draft.students[studentUid];
    if (!student) throw createError('Profil eleve introuvable.', 404);

    ensureStudentCollections(student);
    archiveWeekNotifications(draft, studentUid, schedule.weekKey);

    const sessions = listScheduleStudySessions(schedule);
    const createdIds = [];

    sessions.forEach((session) => {
      const notification = buildNotification(schedule, student, session);
      draft.noti[notification.notificationId] = notification;
      createdIds.push(notification.notificationId);

      if (notification.status === 'pending_response') {
        queueSmsDispatch(draft, notification);
        queueTelegramDispatch(draft, notification);
      }

      student.notificationTimeline.push(notification.notificationId);

      if (notification.status === 'auto_completed_unconfirmed') {
        pushStudentEvent(student, {
          eventId: `evt_${crypto.randomUUID()}`,
          notificationId: notification.notificationId,
          scheduleId: schedule.scheduleId,
          type: 'auto_completed_unconfirmed',
          createdAt: isoNow(),
          subjectName: notification.subjectName,
          day: notification.day,
          hour: notification.hour
        });
      }
    });

    if (student.notificationTimeline.length > 800) {
      student.notificationTimeline = student.notificationTimeline.slice(-800);
    }

    draft.schedules[schedule.scheduleId].notificationIds = createdIds;
    draft.schedules[schedule.scheduleId].updatedAt = isoNow();

    return draft;
  });
}

function processNotificationTransitionsForStudent(draft, studentUid, now = new Date()) {
  const student = draft.students[studentUid];
  if (!student) throw createError('Profil eleve introuvable.', 404);
  ensureStudentCollections(student);

  let changed = false;

  Object.values(draft.noti || {}).forEach((notification) => {
    if (notification.studentUid !== studentUid) return;

    const reminderAt = new Date(notification.reminderAt);
    const sessionStartAt = new Date(notification.sessionStartAt);

    if (notification.status === 'scheduled' && reminderAt <= now) {
      notification.status = 'pending_response';
      notification.sentAt = isoNow();
      notification.updatedAt = isoNow();
      queueSmsDispatch(draft, notification);
      queueTelegramDispatch(draft, notification);
      changed = true;
    }

    if (notification.status === 'pending_response' && now >= new Date(sessionStartAt.getTime() + 5 * 60 * 1000)) {
      notification.status = 'auto_completed_unconfirmed';
      notification.autoCompletedAt = isoNow();
      notification.updatedAt = isoNow();
      changed = true;

      pushStudentEvent(student, {
        eventId: `evt_${crypto.randomUUID()}`,
        notificationId: notification.notificationId,
        scheduleId: notification.scheduleId,
        type: 'auto_completed_unconfirmed',
        createdAt: isoNow(),
        subjectName: notification.subjectName,
        day: notification.day,
        hour: notification.hour
      });
    }
  });

  if (changed) {
    student.updatedAt = isoNow();
  }

  return changed;
}

async function processNotificationQueue(studentUid) {
  updateStore((draft) => {
    processNotificationTransitionsForStudent(draft, studentUid);
    return draft;
  });
}

async function processAllNotificationQueues() {
  updateStore((draft) => {
    const now = new Date();
    Object.keys(draft.students || {}).forEach((studentUid) => {
      try {
        processNotificationTransitionsForStudent(draft, studentUid, now);
      } catch (_error) {
        // ignore orphan student entries to keep queue processing resilient
      }
    });
    return draft;
  });
}

function buildInboxPayload(studentUid, store) {
  const notifications = Object.values(store.noti || {})
    .filter((entry) => entry.studentUid === studentUid)
    .sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));

  const pendingAction = notifications.filter((entry) => entry.status === 'pending_response');
  const upcoming = notifications.filter((entry) => entry.status === 'scheduled').slice(0, 40);
  const recent = notifications
    .filter((entry) => ['confirmed_available', 'rescheduled', 'missed', 'auto_completed_unconfirmed'].includes(entry.status))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 50);

  return {
    pendingAction,
    upcoming,
    recent,
    totals: {
      pending: pendingAction.length,
      upcoming: upcoming.length,
      recent: recent.length,
      missed: notifications.filter((entry) => entry.status === 'missed').length
    }
  };
}

async function getNotificationInbox(studentUid) {
  await processNotificationQueue(studentUid);
  const store = readStore();
  return buildInboxPayload(studentUid, store);
}

async function respondToNotification(studentUid, notificationId, response) {
  let payload = null;

  updateStore((draft) => {
    const student = draft.students[studentUid];
    if (!student) throw createError('Profil eleve introuvable.', 404);
    ensureStudentCollections(student);

    const notification = draft.noti[notificationId];
    if (!notification || notification.studentUid !== studentUid) {
      throw createError('Notification introuvable.', 404);
    }

    if (!['scheduled', 'pending_response'].includes(notification.status)) {
      throw createError('Cette notification ne peut plus recevoir de reponse.', 409);
    }

    const normalized = String(response || '').toLowerCase();
    const schedule = draft.schedules[notification.scheduleId];

    if (!schedule) {
      notification.status = 'missed';
      notification.response = normalized;
      notification.respondedAt = isoNow();
      notification.updatedAt = isoNow();
      createMissedSessionRecord(draft, student, notification, 'schedule_missing');

      payload = { notification, schedule: null };
      return draft;
    }

    if (normalized === 'dispo' || normalized === 'available' || normalized === 'yes') {
      notification.status = 'confirmed_available';
      notification.response = 'dispo';
      notification.respondedAt = isoNow();
      notification.updatedAt = isoNow();

      pushStudentEvent(student, {
        eventId: `evt_${crypto.randomUUID()}`,
        notificationId,
        scheduleId: schedule.scheduleId,
        type: 'confirmed_available',
        createdAt: isoNow(),
        subjectName: notification.subjectName,
        day: notification.day,
        hour: notification.hour
      });

      payload = { notification, schedule };
      return draft;
    }

    if (!['pas_dispo', 'not_available', 'no'].includes(normalized)) {
      throw createError('Reponse invalide. Utilise "dispo" ou "pas_dispo".', 400);
    }

    const rescheduleSlot = findRescheduleSlot(schedule, notification.day, notification.hour);

    if (schedule.calendar?.[notification.day]?.[notification.hour]) {
      schedule.calendar[notification.day][notification.hour] = 'Repos';
    }

    if (!rescheduleSlot) {
      notification.status = 'missed';
      notification.response = 'pas_dispo';
      notification.respondedAt = isoNow();
      notification.updatedAt = isoNow();

      createMissedSessionRecord(draft, student, notification, 'no_free_slot_for_reschedule');

      pushStudentEvent(student, {
        eventId: `evt_${crypto.randomUUID()}`,
        notificationId,
        scheduleId: schedule.scheduleId,
        type: 'missed',
        createdAt: isoNow(),
        subjectName: notification.subjectName,
        day: notification.day,
        hour: notification.hour
      });

      schedule.stats = recomputeScheduleStats(schedule);
      schedule.updatedAt = isoNow();
      payload = { notification, schedule };
      return draft;
    }

    schedule.calendar[rescheduleSlot.day][rescheduleSlot.hour] = `Revision ${notification.subjectName} (reportee)`;
    schedule.stats = recomputeScheduleStats(schedule);
    schedule.updatedAt = isoNow();

    notification.status = 'rescheduled';
    notification.response = 'pas_dispo';
    notification.respondedAt = isoNow();
    notification.updatedAt = isoNow();
    notification.rescheduledTo = {
      day: rescheduleSlot.day,
      hour: rescheduleSlot.hour,
      sessionStartAt: sessionDateFromWeekKey(schedule.weekKey, rescheduleSlot.day, rescheduleSlot.hour).toISOString()
    };

    const followUp = buildNotification(schedule, student, {
      day: rescheduleSlot.day,
      hour: rescheduleSlot.hour,
      rawLabel: `Revision ${notification.subjectName} (reportee)`,
      subjectName: notification.subjectName,
      durationHours: getSlotDurationHours(rescheduleSlot.hour)
    });

    draft.noti[followUp.notificationId] = followUp;
    student.notificationTimeline.push(followUp.notificationId);

    if (followUp.status === 'pending_response') {
      queueSmsDispatch(draft, followUp);
      queueTelegramDispatch(draft, followUp);
    }

    pushStudentEvent(student, {
      eventId: `evt_${crypto.randomUUID()}`,
      notificationId,
      scheduleId: schedule.scheduleId,
      type: 'rescheduled',
      createdAt: isoNow(),
      subjectName: notification.subjectName,
      from: { day: notification.day, hour: notification.hour },
      to: { day: rescheduleSlot.day, hour: rescheduleSlot.hour }
    });

    payload = { notification, schedule, followUpNotification: followUp };
    return draft;
  });

  return payload;
}

async function getMissedSessions(studentUid) {
  const store = readStore();
  const sessions = Object.values(store.missed_sessions || {})
    .filter((entry) => entry.studentUid === studentUid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return sessions;
}

module.exports = {
  syncNotificationsForSchedule,
  processNotificationQueue,
  processAllNotificationQueues,
  getNotificationInbox,
  respondToNotification,
  getMissedSessions
};
