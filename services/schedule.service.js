const crypto = require('crypto');
const { readStore, refreshAcademicProgramsFromFirebase, updateStore } = require('../utils/data-store');
const { ACADEMIC_PROGRAMS, mergeAcademicPrograms } = require('../utils/academic-data');
const { normalizeDateInput } = require('../utils/date.utils');
const {
  generateSchedule,
  isStudyBlock,
  isOptionalSubjectName,
  getSlotDurationHours
} = require('../utils/planning-engine');
const {
  getCanonicalSubjectLabel,
  areSubjectsEquivalent,
  getProgramSubjectsByFamily
} = require('../utils/subject.utils');
const {
  startOfWeekUTC,
  addDaysUTC,
  weekKeyFromDate,
  weekKeyToStartDateUTC,
  dayIndexToName,
  jours
} = require('../utils/week.utils');
const { syncNotificationsForSchedule } = require('./notification.service');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function currentWeekKey() {
  return weekKeyFromDate(new Date());
}

function getProgramsFromStore(store) {
  return mergeAcademicPrograms(ACADEMIC_PROGRAMS, store.academic_programs || {});
}

function getProgramForClass(classCode, programs) {
  return programs[classCode] || null;
}

function hasObjectValues(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function sanitizePreferredMoments(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 2);
}

function normalizeAssignments(assignments = []) {
  if (!Array.isArray(assignments)) return [];

  return assignments
    .map((entry) => {
      const dueDate = normalizeDateInput(entry.dueDate || entry.date || entry.deadline);
      const rawSubjectName = String(entry.subjectName || entry.matiere || '').trim();
      const subjectName = getCanonicalSubjectLabel(rawSubjectName);
      if (!dueDate || !subjectName) return null;

      return {
        assignmentId: entry.assignmentId || `asg_${crypto.randomUUID()}`,
        title: String(entry.title || entry.label || `Devoir ${subjectName}`).trim(),
        subjectName,
        dueDate,
        level: Number(entry.level || entry.importance || 3),
        revisionHour: entry.revisionHour || '20:00',
        notes: String(entry.notes || '').trim()
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

function deriveImportantDaysFromFixedCourses(fixedCourses = [], classCode, programs) {
  const program = getProgramForClass(classCode, programs);
  if (!program) return {};

  const map = {};
  fixedCourses.forEach((entry) => {
    const day = entry.day || entry.jour;
    const subject = entry.subjectName || entry.label || entry.matiere || '';
    if (!day || !subject) return;

    const normalizedSubject = getCanonicalSubjectLabel(subject.replace(/^cours\s+/i, ''));
    const matchedSubjects = getProgramSubjectsByFamily(
      program.subjects.filter((item) => Boolean(item.isCore) && !isOptionalSubjectName(item.name)),
      normalizedSubject
    );

    matchedSubjects.forEach((matched) => {
      const displayName = matched.name;
      if (!map[displayName]) map[displayName] = new Set();
      map[displayName].add(day);
    });
  });

  return Object.fromEntries(Object.entries(map).map(([subject, days]) => [subject, [...days]]));
}

function mergeImportantDays(...maps) {
  const merged = {};

  maps.forEach((source) => {
    if (!source || typeof source !== 'object') return;

    Object.entries(source).forEach(([subject, days]) => {
      if (!Array.isArray(days)) return;
      if (!merged[subject]) merged[subject] = new Set();
      days.forEach((day) => {
        if (jours.includes(day)) merged[subject].add(day);
      });
    });
  });

  return Object.fromEntries(Object.entries(merged).map(([subject, values]) => [subject, [...values]]));
}

function toDayNameFromIsoDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Lundi';
  const dayIndex = (date.getUTCDay() + 6) % 7;
  return dayIndexToName(dayIndex);
}

function deriveExamsFromAssignments(assignments, weekStartDate, horizonDays = 14) {
  const horizonEnd = addDaysUTC(weekStartDate, horizonDays);

  return assignments
    .filter((assignment) => {
      const due = new Date(`${assignment.dueDate}T00:00:00.000Z`);
      return due >= weekStartDate && due <= horizonEnd;
    })
    .map((assignment) => ({
      subjectCode: '',
      subjectName: getCanonicalSubjectLabel(assignment.subjectName),
      day: toDayNameFromIsoDate(`${assignment.dueDate}T00:00:00.000Z`),
      hour: assignment.revisionHour || '20:00',
      date: assignment.dueDate,
      source: 'assignment'
    }));
}

function deriveImportantDaysFromAssignments(assignments, weekStartDate, horizonDays = 14) {
  const horizonEnd = addDaysUTC(weekStartDate, horizonDays);
  const map = {};

  assignments.forEach((assignment) => {
    const due = new Date(`${assignment.dueDate}T00:00:00.000Z`);
    if (due < weekStartDate || due > horizonEnd) return;

    const day = toDayNameFromIsoDate(`${assignment.dueDate}T00:00:00.000Z`);
    const subjectName = getCanonicalSubjectLabel(assignment.subjectName);
    if (!map[subjectName]) map[subjectName] = new Set();
    map[subjectName].add(day);
  });

  return Object.fromEntries(Object.entries(map).map(([subject, days]) => [subject, [...days]]));
}

function countStudyHoursBySubject(calendar = {}) {
  const hoursBySubject = {};

  Object.values(calendar).forEach((dayMap) => {
    Object.entries(dayMap || {}).forEach(([hour, slot]) => {
      if (!isStudyBlock(slot)) return;
      const subject = String(slot)
        .replace(/^Revision\s+/, '')
        .replace(/^Compo\s+/, '')
        .replace(/\s*\(.*\)\s*$/, '');
      hoursBySubject[subject] = Number(((hoursBySubject[subject] || 0) + getSlotDurationHours(hour)).toFixed(2));
    });
  });

  return hoursBySubject;
}

function analyzeProposal(proposedCalendar, counterCalendar, classCode, programs) {
  const program = getProgramForClass(classCode, programs);
  const proposedHours = countStudyHoursBySubject(proposedCalendar);
  const counterHours = countStudyHoursBySubject(counterCalendar);

  const subjects = new Set([...Object.keys(proposedHours), ...Object.keys(counterHours)]);
  let divergence = 0;
  subjects.forEach((subject) => {
    divergence += Math.abs((proposedHours[subject] || 0) - (counterHours[subject] || 0));
  });

  const coreSubjects = (program?.subjects || [])
    .filter((subject) => Boolean(subject.isCore) && !isOptionalSubjectName(subject.name))
    .map((subject) => subject.name);

  const optionalSubjects = (program?.subjects || [])
    .filter((subject) => isOptionalSubjectName(subject.name))
    .map((subject) => subject.name);

  const missingCoreSubjects = coreSubjects.filter((subject) => (proposedHours[subject] || 0) < 0.5);
  const optionalHours = optionalSubjects.reduce((sum, subject) => sum + (proposedHours[subject] || 0), 0);

  const suggestions = [];
  if (missingCoreSubjects.length > 0) {
    suggestions.push(`Renforcer les matieres de base: ${missingCoreSubjects.join(', ')}`);
  }
  if (optionalHours > 2) {
    suggestions.push('Reduire un peu les matieres facultatives pour liberer du temps de revision principale.');
  }
  if (divergence > 4) {
    suggestions.push('La contre-proposition rapproche la charge des coefficients et des difficultes declarees.');
  }

  return {
    missingCoreSubjects,
    optionalHours: Number(optionalHours.toFixed(2)),
    divergenceHours: Number(divergence.toFixed(2)),
    coverageCoreSubjects: coreSubjects.length
      ? Number((((coreSubjects.length - missingCoreSubjects.length) / coreSubjects.length) * 100).toFixed(1))
      : 100,
    suggestions
  };
}

function buildScheduleRecord(studentUid, weekKey, source, result, proposalAnalysis = null, proposedCalendar = null, extraMetadata = {}) {
  const scheduleId = `${studentUid}-${crypto.randomUUID()}`;

  return {
    scheduleId,
    studentUid,
    source,
    weekKey,
    classCode: result.metadata.classCode,
    examMode: result.metadata.examMode,
    maxSessionsPerDay: result.metadata.maxSessionsPerDay,
    maxHoursPerWeek: result.metadata.maxHoursPerWeek,
    createdAt: result.metadata.generatedAt,
    updatedAt: result.metadata.generatedAt,
    overload: result.overload,
    badge: result.badge,
    calendar: result.calendar,
    counterProposal: proposedCalendar ? result.calendar : null,
    proposalAnalysis,
    microRevisionPlan: result.microRevisionPlan,
    subjectThemes: result.subjectThemes,
    revisionLegend: result.revisionLegend,
    manualAdjustmentsApplied: result.manualAdjustmentsApplied,
    stats: result.stats,
    scores: result.scores,
    metadata: {
      ...result.metadata,
      ...extraMetadata
    }
  };
}

async function generateCurrentSchedule(studentUid, overrides = {}) {
  await refreshAcademicProgramsFromFirebase();
  const store = readStore();
  const student = store.students[studentUid];
  if (!student) throw createError('Profil eleve introuvable.', 404);

  const programs = getProgramsFromStore(store);
  const classCode = overrides.classCode || student.classCode;
  const fixedCourses = Array.isArray(overrides.fixedCourses) ? overrides.fixedCourses : (student.fixedCourses || []);
  const assignments = normalizeAssignments(overrides.assignments || student.assignments || []);

  const requestedWeekKey = overrides.weekKey || currentWeekKey();
  const weekStartDate = weekKeyToStartDateUTC(requestedWeekKey);

  const manualExams = Array.isArray(overrides.exams) ? overrides.exams : (student.exams || []);
  const assignmentExams = deriveExamsFromAssignments(assignments, weekStartDate, 14);
  const exams = [...manualExams, ...assignmentExams];

  const fixedImportantDays = deriveImportantDaysFromFixedCourses(fixedCourses, classCode, programs);
  const assignmentImportantDays = deriveImportantDaysFromAssignments(assignments, weekStartDate, 14);
  const autoImportantDays = mergeImportantDays(fixedImportantDays, assignmentImportantDays);

  const importantDays = hasObjectValues(overrides.importantDays)
    ? overrides.importantDays
    : (hasObjectValues(student.importantDays)
      ? mergeImportantDays(student.importantDays, autoImportantDays)
      : autoImportantDays);

  const proposedCalendar = overrides.proposedCalendar || overrides.manualCalendar || null;

  const result = generateSchedule({
    classCode,
    preferredStudyMoments: sanitizePreferredMoments(overrides.preferredStudyMoments, student.preferences?.preferredStudyMoments || []),
    maxSessionsPerDay: Number(overrides.maxSessionsPerDay || student.preferences?.maxSessionsPerDay || 3),
    maxHoursPerWeek: Number(overrides.maxHoursPerWeek || student.preferences?.maxHoursPerWeek || 18),
    examMode: typeof overrides.examMode === 'boolean'
      ? overrides.examMode
      : Boolean(student.preferences?.examMode || assignmentExams.length > 0),
    difficultyLevels: overrides.difficultyLevels || student.difficulties || {},
    fixedCourses,
    exams,
    importantDays,
    proposedCalendar,
    programs
  });

  const proposalAnalysis = proposedCalendar
    ? analyzeProposal(proposedCalendar, result.calendar, classCode, programs)
    : null;

  const schedule = buildScheduleRecord(
    studentUid,
    requestedWeekKey,
    proposedCalendar ? 'counter-proposal' : 'auto-generation',
    result,
    proposalAnalysis,
    proposedCalendar,
    {
      assignmentsConsidered: assignments,
      evolvingMode: false
    }
  );

  updateStore((draft) => {
    const draftStudent = draft.students[studentUid];

    draft.schedules[schedule.scheduleId] = schedule;
    draftStudent.activeScheduleId = schedule.scheduleId;
    draftStudent.updatedAt = result.metadata.generatedAt;
    draftStudent.classCode = classCode;
    draftStudent.difficulties = overrides.difficultyLevels || draftStudent.difficulties || {};
    draftStudent.fixedCourses = fixedCourses;
    draftStudent.exams = manualExams;
    draftStudent.assignments = assignments;
    draftStudent.importantDays = importantDays;

    draftStudent.preferences = {
      ...draftStudent.preferences,
      preferredStudyMoments: sanitizePreferredMoments(overrides.preferredStudyMoments, draftStudent.preferences?.preferredStudyMoments || []),
      maxSessionsPerDay: Number(overrides.maxSessionsPerDay || draftStudent.preferences?.maxSessionsPerDay || 3),
      maxHoursPerWeek: Number(overrides.maxHoursPerWeek || draftStudent.preferences?.maxHoursPerWeek || 18),
      examMode: typeof overrides.examMode === 'boolean'
        ? overrides.examMode
        : Boolean(draftStudent.preferences?.examMode || assignmentExams.length > 0)
    };

    draftStudent.schoolTimetable = {
      slots: fixedCourses,
      updatedAt: result.metadata.generatedAt
    };

    if (!Array.isArray(draftStudent.scheduleAdjustments)) {
      draftStudent.scheduleAdjustments = [];
    }

    if (proposedCalendar) {
      draftStudent.scheduleAdjustments.push({
        adjustmentId: `${schedule.scheduleId}-adjustment`,
        scheduleId: schedule.scheduleId,
        createdAt: result.metadata.generatedAt,
        proposalAnalysis,
        proposedCalendar
      });

      if (draftStudent.scheduleAdjustments.length > 50) {
        draftStudent.scheduleAdjustments = draftStudent.scheduleAdjustments.slice(-50);
      }
    }

    return draft;
  });

  await syncNotificationsForSchedule(studentUid, schedule);
  return schedule;
}

async function generateEvolvingSchedules(studentUid, payload = {}) {
  await refreshAcademicProgramsFromFirebase();
  const store = readStore();
  const student = store.students[studentUid];
  if (!student) throw createError('Profil eleve introuvable.', 404);

  const programs = getProgramsFromStore(store);
  const classCode = payload.classCode || student.classCode;
  const fixedCourses = Array.isArray(payload.fixedCourses) ? payload.fixedCourses : (student.fixedCourses || []);
  const assignments = normalizeAssignments(payload.assignments || student.assignments || []);
  const weeksCount = Math.min(8, Math.max(1, Number(payload.weeksCount || 4)));

  const preferredStudyMoments = sanitizePreferredMoments(
    payload.preferredStudyMoments,
    student.preferences?.preferredStudyMoments || []
  );
  const maxSessionsPerDay = Number(payload.maxSessionsPerDay || student.preferences?.maxSessionsPerDay || 3);
  const maxHoursPerWeek = Number(payload.maxHoursPerWeek || student.preferences?.maxHoursPerWeek || 18);
  const examMode = typeof payload.examMode === 'boolean' ? payload.examMode : true;
  const difficulties = payload.difficultyLevels || student.difficulties || {};

  const manualExams = Array.isArray(payload.exams) ? payload.exams : (student.exams || []);
  const monday = startOfWeekUTC(new Date());
  const createdAt = new Date().toISOString();

  const generatedSchedules = [];

  for (let index = 0; index < weeksCount; index += 1) {
    const weekStartDate = addDaysUTC(monday, index * 7);
    const weekKey = weekKeyFromDate(weekStartDate);

    const assignmentExams = deriveExamsFromAssignments(assignments, weekStartDate, 14);
    const exams = [...manualExams, ...assignmentExams];

    const importantDays = mergeImportantDays(
      deriveImportantDaysFromFixedCourses(fixedCourses, classCode, programs),
      deriveImportantDaysFromAssignments(assignments, weekStartDate, 14)
    );

    const result = generateSchedule({
      classCode,
      preferredStudyMoments,
      maxSessionsPerDay,
      maxHoursPerWeek,
      examMode,
      difficultyLevels: difficulties,
      fixedCourses,
      exams,
      importantDays,
      programs
    });

    const schedule = buildScheduleRecord(
      studentUid,
      weekKey,
      'evolving-weekly-plan',
      result,
      null,
      null,
      {
        evolvingMode: true,
        weekOffset: index,
        assignmentsConsidered: assignments,
        generatedForWeekStart: weekStartDate.toISOString().slice(0, 10)
      }
    );

    generatedSchedules.push(schedule);
  }

  updateStore((draft) => {
    const draftStudent = draft.students[studentUid];

    generatedSchedules.forEach((schedule) => {
      draft.schedules[schedule.scheduleId] = schedule;
    });

    draftStudent.activeScheduleId = generatedSchedules[0].scheduleId;
    draftStudent.classCode = classCode;
    draftStudent.fixedCourses = fixedCourses;
    draftStudent.exams = manualExams;
    draftStudent.assignments = assignments;

    draftStudent.preferences = {
      ...draftStudent.preferences,
      preferredStudyMoments,
      maxSessionsPerDay,
      maxHoursPerWeek,
      examMode
    };

    draftStudent.evolvingSchedule = {
      enabled: true,
      weeksCount,
      generatedAt: createdAt,
      scheduleIds: generatedSchedules.map((schedule) => schedule.scheduleId),
      assignmentCount: assignments.length
    };

    draftStudent.updatedAt = createdAt;
    return draft;
  });

  for (const schedule of generatedSchedules) {
    // eslint-disable-next-line no-await-in-loop
    await syncNotificationsForSchedule(studentUid, schedule);
  }

  return {
    activeScheduleId: generatedSchedules[0].scheduleId,
    weeksCount,
    assignments,
    schedules: generatedSchedules
  };
}

async function getCurrentSchedule(studentUid) {
  const store = readStore();
  const student = store.students[studentUid];
  if (!student || !student.activeScheduleId) return null;
  return store.schedules[student.activeScheduleId] || null;
}

async function getCurrentScheduleStats(studentUid) {
  const schedule = await getCurrentSchedule(studentUid);
  return schedule ? schedule.stats : null;
}

async function getEvolvingSchedules(studentUid) {
  const store = readStore();
  const student = store.students[studentUid];
  if (!student) throw createError('Profil eleve introuvable.', 404);

  const scheduleIds = student.evolvingSchedule?.scheduleIds || [];
  const schedules = scheduleIds
    .map((id) => store.schedules[id])
    .filter(Boolean)
    .sort((a, b) => String(a.weekKey).localeCompare(String(b.weekKey)));

  return {
    evolving: student.evolvingSchedule || { enabled: false, weeksCount: 0, scheduleIds: [] },
    schedules,
    assignments: student.assignments || []
  };
}

module.exports = {
  generateCurrentSchedule,
  generateEvolvingSchedules,
  getCurrentSchedule,
  getCurrentScheduleStats,
  getEvolvingSchedules
};
