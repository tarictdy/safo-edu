const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/firebase-client');
const { getAdminDb } = require('../config/firebase-admin');
const { collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore/lite');
const { ACADEMIC_PROGRAMS, mergeAcademicPrograms } = require('./academic-data');

const DATA_PATH = path.join(__dirname, '..', 'data', 'app-data.json');
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const VALID_SLOTS = (() => {
  const slots = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
  }
  slots.push('23:30');
  return slots;
})();

const DEFAULT_DATA = {
  users_public: {},
  auth_meta: {},
  students: {},
  parents: {},
  parentStudentLinks: {},
  academic_programs: {},
  schedules: {},
  noti: {},
  missed_sessions: {},
  sms_dispatches: {},
  telegram_dispatches: {}
};
const SYNCED_COLLECTIONS = ['users_public', 'auth_meta', 'students', 'parents', 'parentStudentLinks', 'schedules', 'academic_programs', 'noti', 'missed_sessions', 'sms_dispatches', 'telegram_dispatches'];

let firebaseSyncInFlight = null;
let warnedAboutFirebase = false;
let warnedAboutAcademicProgramsRead = false;
let academicProgramsLastRefreshAt = 0;
let academicProgramsRefreshInFlight = null;

const ACADEMIC_PROGRAMS_REFRESH_TTL_MS = Number(process.env.ACADEMIC_PROGRAMS_REFRESH_TTL_MS || 60 * 1000);

function normalizeHourSlotKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (VALID_SLOTS.includes(raw)) return raw;

  const isoMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!isoMatch) return null;

  const hour = String(Number(isoMatch[1])).padStart(2, '0');
  const minute = String(Number(isoMatch[2])).padStart(2, '0');
  const exact = `${hour}:${minute}`;
  if (VALID_SLOTS.includes(exact)) return exact;

  if (minute === '30' && hour !== '23') {
    const collapsed = `${hour}:00`;
    return VALID_SLOTS.includes(collapsed) ? collapsed : null;
  }

  return null;
}

function slotValuePriority(value) {
  const label = String(value || '').trim();
  if (!label) return 0;
  if (label.startsWith('Cours ')) return 6;
  if (label.startsWith('Compo ')) return 5;
  if (label.startsWith('Revision ')) return 4;
  if (['Indisponible', 'Activite personnelle', 'Sommeil', 'Pause'].includes(label)) return 3;
  if (label === 'Repos' || label === 'Libre') return 1;
  return 2;
}

function migrateCalendarToHourSlots(calendar) {
  if (!calendar || typeof calendar !== 'object') return calendar;

  const migrated = {};

  JOURS.forEach((day) => {
    const sourceDay = calendar[day] && typeof calendar[day] === 'object' ? calendar[day] : {};
    const nextDay = Object.fromEntries(VALID_SLOTS.map((slot) => [slot, 'Repos']));

    Object.entries(sourceDay).forEach(([hour, value]) => {
      const normalizedHour = normalizeHourSlotKey(hour);
      if (!normalizedHour) return;

      const current = nextDay[normalizedHour];
      if (slotValuePriority(value) >= slotValuePriority(current)) {
        nextDay[normalizedHour] = value || 'Repos';
      }
    });

    migrated[day] = nextDay;
  });

  return migrated;
}

function migrateFixedCourses(courses) {
  if (!Array.isArray(courses)) return [];

  return courses
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const normalizedHour = normalizeHourSlotKey(entry.startHour || entry.hour || entry.heure);
      if (!normalizedHour) return null;

      return {
        ...entry,
        day: entry.day || entry.jour,
        startHour: normalizedHour
      };
    })
    .filter(Boolean);
}

function applyLegacyTimeMigration(state) {
  if (!state || typeof state !== 'object') return state;

  Object.values(state.schedules || {}).forEach((schedule) => {
    if (!schedule || typeof schedule !== 'object') return;
    schedule.calendar = migrateCalendarToHourSlots(schedule.calendar);

    if (schedule.counterProposal && typeof schedule.counterProposal === 'object') {
      schedule.counterProposal = migrateCalendarToHourSlots(schedule.counterProposal);
    }
  });

  Object.values(state.students || {}).forEach((student) => {
    if (!student || typeof student !== 'object') return;

    student.fixedCourses = migrateFixedCourses(student.fixedCourses);

    if (student.schoolTimetable && typeof student.schoolTimetable === 'object') {
      student.schoolTimetable.slots = migrateFixedCourses(student.schoolTimetable.slots);
    }

    if (Array.isArray(student.scheduleAdjustments)) {
      student.scheduleAdjustments = student.scheduleAdjustments.map((adjustment) => {
        if (!adjustment || typeof adjustment !== 'object') return adjustment;
        if (!adjustment.proposedCalendar) return adjustment;

        return {
          ...adjustment,
          proposedCalendar: migrateCalendarToHourSlots(adjustment.proposedCalendar)
        };
      });
    }
  });

  return state;
}

function ensureStore() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyProgramDefaults(state) {
  const next = state || {};
  next.academic_programs = mergeAcademicPrograms(ACADEMIC_PROGRAMS, next.academic_programs || {});
  return next;
}

function readLocalStore() {
  ensureStore();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const parsed = raw ? JSON.parse(raw) : {};
  return applyLegacyTimeMigration(applyProgramDefaults({
    ...clone(DEFAULT_DATA),
    ...parsed
  }));
}

function writeLocalStore(nextState) {
  ensureStore();
  fs.writeFileSync(DATA_PATH, JSON.stringify(nextState, null, 2));
  return nextState;
}

async function fetchRemoteStore(baseState = DEFAULT_DATA) {
  const db = getDb();
  const remote = clone(baseState || DEFAULT_DATA);
  let loadedAnyCollection = false;

  for (const name of SYNCED_COLLECTIONS) {
    try {
      if (name === 'academic_programs') {
        remote[name] = await fetchRemoteAcademicPrograms();
        loadedAnyCollection = true;
        warnedAboutAcademicProgramsRead = false;
        continue;
      }

      const snapshot = await getDocs(collection(db, name));
      remote[name] = {};
      snapshot.forEach((entry) => {
        remote[name][entry.id] = entry.data();
      });
      loadedAnyCollection = true;
      if (name === 'academic_programs') warnedAboutAcademicProgramsRead = false;
    } catch (error) {
      if (name === 'academic_programs' && !warnedAboutAcademicProgramsRead) {
        console.warn('[SAFIO] Lecture Firebase academic_programs impossible, cache local conserve.', error.message || error);
        warnedAboutAcademicProgramsRead = true;
      }
    }
  }

  if (!loadedAnyCollection) {
    throw new Error('Aucune collection Firebase chargee.');
  }

  return remote;
}

async function fetchRemoteCollection(collectionName) {
  const db = getDb();
  const snapshot = await getDocs(collection(db, collectionName));
  const result = {};
  snapshot.forEach((entry) => {
    result[entry.id] = entry.data();
  });
  return result;
}

async function fetchRemoteAcademicPrograms() {
  const snapshot = await getAdminDb().collection('academic_programs').get();
  const result = {};
  snapshot.forEach((entry) => {
    result[entry.id] = entry.data();
  });
  return result;
}

async function refreshAcademicProgramsFromFirebase(options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (!force && academicProgramsRefreshInFlight) {
    return academicProgramsRefreshInFlight;
  }

  if (!force && academicProgramsLastRefreshAt && now - academicProgramsLastRefreshAt < ACADEMIC_PROGRAMS_REFRESH_TTL_MS) {
    return readLocalStore();
  }

  academicProgramsRefreshInFlight = (async () => {
    const local = readLocalStore();
    let academicPrograms = local.academic_programs || {};

    try {
      academicPrograms = await fetchRemoteAcademicPrograms();
      academicProgramsLastRefreshAt = Date.now();
      warnedAboutAcademicProgramsRead = false;
      warnedAboutFirebase = false;
    } catch (error) {
      if (!warnedAboutAcademicProgramsRead) {
        console.warn('[SAFIO] Lecture Firebase academic_programs impossible, cache local conserve.', error.message || error);
        warnedAboutAcademicProgramsRead = true;
      }
    }

    const next = applyLegacyTimeMigration(applyProgramDefaults({
      ...local,
      academic_programs: mergeAcademicPrograms(ACADEMIC_PROGRAMS, academicPrograms)
    }));
    writeLocalStore(next);
    return next;
  })();

  try {
    return await academicProgramsRefreshInFlight;
  } finally {
    academicProgramsRefreshInFlight = null;
  }
}

async function refreshLocalCacheFromFirebase() {
  return refreshAcademicProgramsFromFirebase({ force: true });
}

async function syncStateToFirebase(state) {
  const remote = await fetchRemoteStore().catch(() => clone(DEFAULT_DATA));
  const db = getDb();

  for (const name of SYNCED_COLLECTIONS) {
    if (name === 'academic_programs') {
      continue;
    }

    const nextCollection = state[name] || {};
    const previousCollection = remote[name] || {};

    for (const [id, value] of Object.entries(nextCollection)) {
      await setDoc(doc(db, name, id), value);
    }

    for (const id of Object.keys(previousCollection)) {
      if (!nextCollection[id]) {
        await deleteDoc(doc(db, name, id));
      }
    }
  }
}

async function writeAcademicProgramRecord(classCode, program) {
  await getAdminDb().collection('academic_programs').doc(classCode).set(program);

  const state = readLocalStore();
  state.academic_programs[classCode] = program;
  writeLocalStore(applyProgramDefaults(state));
  academicProgramsLastRefreshAt = Date.now();

  return program;
}

async function writeAcademicProgramRecords(programsByClassCode = {}) {
  const entries = Object.entries(programsByClassCode);
  const batch = getAdminDb().batch();

  for (const [classCode, program] of entries) {
    batch.set(getAdminDb().collection('academic_programs').doc(classCode), program);
  }

  await batch.commit();

  const state = readLocalStore();
  entries.forEach(([classCode, program]) => {
    state.academic_programs[classCode] = program;
  });
  writeLocalStore(applyProgramDefaults(state));
  academicProgramsLastRefreshAt = Date.now();

  return programsByClassCode;
}

function queueFirebaseSync(state) {
  firebaseSyncInFlight = Promise.resolve(firebaseSyncInFlight)
    .catch(() => {})
    .then(() => syncStateToFirebase(state))
    .then(() => {
      warnedAboutFirebase = false;
    })
    .catch((error) => {
      if (!warnedAboutFirebase) {
        console.warn('[SAFIO] Synchronisation Firebase impossible, données gardées en cache local.', error.message || error);
        warnedAboutFirebase = true;
      }
    });

  return firebaseSyncInFlight;
}

function readStore() {
  return readLocalStore();
}

function writeStore(nextState) {
  const written = writeLocalStore(nextState);
  queueFirebaseSync(written);
  return written;
}

function updateStore(mutator) {
  const current = readLocalStore();
  const draft = clone(current);
  const updated = mutator(draft) || draft;
  return writeStore(updated);
}

module.exports = {
  readStore,
  refreshAcademicProgramsFromFirebase,
  writeStore,
  updateStore,
  refreshLocalCacheFromFirebase,
  writeAcademicProgramRecord,
  writeAcademicProgramRecords
};
