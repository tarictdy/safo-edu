import { getJSON, postJSON, putJSON } from './utils/api.js';
import { clearToken } from './utils/session.js';
import { setupPageTransition } from './utils/page-transition.js';

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function buildSlots() {
  const values = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    values.push(`${String(hour).padStart(2, '0')}:00`);
  }
  values.push('23:30');
  return values;
}

const horaires = buildSlots();
const personalBlocks = ['Repos', 'Activite personnelle', 'Indisponible', 'Pause', 'Sommeil'];
const optionalSubjects = ['EPS', 'EDHC', 'Art plastique', 'Arts plastiques', 'Musique', 'Espagnol', 'Allemand', 'Informatique'];

const state = {
  profile: null,
  classes: [],
  program: null,
  schoolCalendar: null,
  generatedSchedule: null,
  generatedEditableCalendar: null,
  isEditingGenerated: false,
  streak: 0,
  xp: 0,
  assignments: [],
  notificationsInbox: null,
  missedSessions: [],
  parentRequests: [],
  pollTimer: null
};

const classSelect = document.getElementById('classCode');
const difficultyContainer = document.getElementById('difficultyContainer');
const schoolTableWrap = document.getElementById('schoolTableWrap');
const generatedTableWrap = document.getElementById('generatedTableWrap');

const bulkDays = document.getElementById('bulkDays');
const bulkStartHour = document.getElementById('bulkStartHour');
const bulkEndHour = document.getElementById('bulkEndHour');
const bulkSubject = document.getElementById('bulkSubject');
const bulkApplyBtn = document.getElementById('bulkApplyBtn');
const bulkClearBtn = document.getElementById('bulkClearBtn');

const studentPhone = document.getElementById('studentPhone');
const telegramChatId = document.getElementById('telegramChatId');
const smsEnabled = document.getElementById('smsEnabled');
const reminderLeadMinutes = document.getElementById('reminderLeadMinutes');
const saveContactBtn = document.getElementById('saveContactBtn');

const assignmentSubject = document.getElementById('assignmentSubject');
const assignmentDate = document.getElementById('assignmentDate');
const assignmentLevel = document.getElementById('assignmentLevel');
const addAssignmentBtn = document.getElementById('addAssignmentBtn');
const generateEvolvingBtn = document.getElementById('generateEvolvingBtn');
const assignmentList = document.getElementById('assignmentList');

const generateBtn = document.getElementById('generateBtn');
const loadCurrentBtn = document.getElementById('loadCurrentBtn');
const editGeneratedBtn = document.getElementById('editGeneratedBtn');
const analyzeProposalBtn = document.getElementById('analyzeProposalBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const generatedCard = document.getElementById('generatedCard');

const statusBox = document.getElementById('statusBox');
const badgesWrap = document.getElementById('badgesWrap');
const revisionLegend = document.getElementById('revisionLegend');
const progressList = document.getElementById('progressList');
const noticeList = document.getElementById('noticeList');
const streakBox = document.getElementById('streakBox');
const analysisBox = document.getElementById('analysisBox');
const parentRequestList = document.getElementById('parentRequestList');

const kpiWeeklyHours = document.getElementById('kpiWeeklyHours');
const kpiStreak = document.getElementById('kpiStreak');
const kpiLevel = document.getElementById('kpiLevel');
const kpiNotices = document.getElementById('kpiNotices');

function generateLocalId(prefix) {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function setStatus(message, type = 'info') {
  statusBox.style.display = 'block';
  statusBox.className = `status-box status-${type}`;
  statusBox.textContent = message;
}

function normalizeSubjectKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSubjectFamily(value) {
  const normalized = normalizeSubjectKey(value);
  if (['math', 'maths', 'mathematique', 'mathematiques'].includes(normalized)) return 'math';
  if (['francais'].includes(normalized)) return 'francais';
  if (['anglais'].includes(normalized)) return 'anglais';
  if (['svt'].includes(normalized)) return 'svt';
  if (['physique', 'physique chimie', 'pc'].includes(normalized)) return 'physique';
  if (['histoire', 'geo', 'geographie', 'hg', 'histoire geo', 'histoire geographie'].includes(normalized)) return 'hg';
  if (['philosophie', 'philo'].includes(normalized)) return 'philo';
  if (['eps', 'education physique et sportive'].includes(normalized)) return 'eps';
  if (['edhc', 'education droits homme citoyennete', 'education aux droits de l homme et a la citoyennete'].includes(normalized)) return 'edhc';
  if (['art plastique', 'arts plastiques'].includes(normalized)) return 'art';
  if (['musique', 'education musicale'].includes(normalized)) return 'musique';
  if (['espagnol'].includes(normalized)) return 'espagnol';
  if (['allemand'].includes(normalized)) return 'allemand';
  if (['informatique', 'tice'].includes(normalized)) return 'info';
  return 'other';
}

function getSubjectColor(subjectName, schedule = state.generatedSchedule) {
  if (schedule?.subjectThemes?.[subjectName]?.color) {
    return schedule.subjectThemes[subjectName].color;
  }

  const family = getSubjectFamily(subjectName);
  const colors = {
    math: '#2b8cff',
    francais: '#ff4563',
    anglais: '#4ecdc4',
    svt: '#70c36b',
    physique: '#ff9f43',
    hg: '#8a63ff',
    philo: '#b78cff',
    eps: '#22c55e',
    edhc: '#38bdf8',
    art: '#f472b6',
    musique: '#f59e0b',
    espagnol: '#ef4444',
    allemand: '#6366f1',
    info: '#14b8a6',
    other: '#8fa7c7'
  };
  return colors[family] || colors.other;
}

function cleanScheduleLabel(value) {
  return String(value || '')
    .replace(/^Cours\s+/i, '')
    .replace(/^Revision\s+/i, '')
    .replace(/^Compo\s+/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

function getCourseRevisionMeta(schedule, day, hour) {
  return (schedule?.microRevisionPlan || []).find((entry) => entry.day === day && entry.startHour === hour) || null;
}

function getRevisionPillColor(minutes, schedule) {
  const legend = schedule?.revisionLegend || {};
  return legend[String(minutes)] || legend[minutes] || '#6cb6ff';
}

function getCellAccent(value, schedule) {
  const subjectName = cleanScheduleLabel(value);
  return getSubjectColor(subjectName, schedule);
}

function buildCellPills(value, schedule, day, hour) {
  const pills = [];
  const revisionMeta = getCourseRevisionMeta(schedule, day, hour);
  if (revisionMeta && String(value || '').startsWith('Cours ')) {
    pills.push(`
      <span class="cell-pill before-course" style="background:${getRevisionPillColor(revisionMeta.beforeStartMinutes, schedule)};">
        <span class="mini-icon before"></span>${revisionMeta.beforeStartMinutes}m
      </span>
    `);
    pills.push(`
      <span class="cell-pill study-plan">
        <span class="mini-icon study"></span>${revisionMeta.duringCourseMinutes}m en cours
      </span>
    `);
  }

  if (String(value || '').startsWith('Revision ') || String(value || '').startsWith('Compo ')) {
    pills.push(`
      <span class="cell-pill study-plan">
        <span class="mini-icon study"></span>${String(value).includes('heure creuse') ? 'Heure creuse' : 'Etude'}
      </span>
    `);
  }

  return pills.join('');
}

function buildReadOnlyCell(value, schedule, day, hour) {
  const safeValue = value || 'Repos';
  const accent = getCellAccent(safeValue, schedule);
  const mainLabel = cleanScheduleLabel(safeValue) || safeValue;
  const subtitle = String(safeValue).startsWith('Cours ')
    ? 'Cours'
    : (String(safeValue).startsWith('Compo ')
      ? 'Evaluation'
      : (String(safeValue).startsWith('Revision ')
        ? 'Revision'
        : 'Bloc'));

  return `
    <div class="cell-inner">
      <div class="cell-main">${mainLabel}</div>
      <div class="cell-sub">${subtitle}</div>
      <div class="cell-pills">${buildCellPills(safeValue, schedule, day, hour)}</div>
    </div>
  `;
}

function redirectToLogin(message = 'Session invalide. Redirection vers connexion...') {
  clearToken();
  setStatus(message, 'error');
  setTimeout(() => {
    window.location.href = '/pages/login.html';
  }, 700);
}

function handleApiError(error, fallbackMessage) {
  if (error?.status === 401 || error?.status === 403) {
    redirectToLogin();
    return;
  }
  setStatus(error?.message || fallbackMessage, 'error');
}

function buildEmptyCalendar() {
  return Object.fromEntries(
    jours.map((day) => [
      day,
      Object.fromEntries(horaires.map((hour) => [hour, 'Libre']))
    ])
  );
}

function normalizeHourLabel(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (horaires.includes(raw)) return raw;

  const h30 = raw.match(/^(\d{1,2})h30$/i);
  if (h30) {
    const label = `${String(Number(h30[1])).padStart(2, '0')}:30`;
    return horaires.includes(label) ? label : null;
  }

  const h = raw.match(/^(\d{1,2})h$/i);
  if (h) {
    const label = `${String(Number(h[1])).padStart(2, '0')}:00`;
    return horaires.includes(label) ? label : null;
  }

  const iso = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (iso) {
    const label = `${String(Number(iso[1])).padStart(2, '0')}:${String(Number(iso[2])).padStart(2, '0')}`;
    if (horaires.includes(label)) return label;

    if (label.endsWith(':30') && !label.startsWith('23:')) {
      const collapsed = `${label.slice(0, 2)}:00`;
      return horaires.includes(collapsed) ? collapsed : null;
    }
  }

  return null;
}

function mapFixedCoursesToCalendar(fixedCourses = []) {
  const calendar = buildEmptyCalendar();

  fixedCourses.forEach((course) => {
    const day = course.day || course.jour;
    const hour = normalizeHourLabel(course.startHour || course.hour || course.heure);
    if (!jours.includes(day) || !hour) return;

    if (course.type === 'blocked') {
      calendar[day][hour] = course.label || 'Indisponible';
      return;
    }

    calendar[day][hour] = course.subjectName || course.label || course.matiere || 'Libre';
  });

  return calendar;
}

function calendarToFixedCourses(calendar) {
  const fixedCourses = [];

  jours.forEach((day) => {
    horaires.forEach((hour) => {
      const value = calendar[day][hour];
      if (!value || value === 'Libre') return;

      if (personalBlocks.includes(value)) {
        fixedCourses.push({
          day,
          startHour: hour,
          label: value,
          type: 'blocked',
          isSchoolCourse: false
        });
        return;
      }

      fixedCourses.push({
        day,
        startHour: hour,
        label: value,
        subjectName: value,
        type: 'school-course',
        isSchoolCourse: true
      });
    });
  });

  return fixedCourses;
}

function getProgramSubjectNames(program) {
  const subjects = (program?.subjects || [])
    .map((subject) => subject.name)
    .filter(Boolean);

  if (subjects.length > 0) return [...new Set(subjects)];

  const fallback = program?.subjectOptions?.length ? program.subjectOptions : optionalSubjects;
  return [...new Set(fallback.filter(Boolean))];
}

function buildSchoolOptions(program) {
  const unique = getProgramSubjectNames(program);
  return ['Libre', ...unique, ...personalBlocks];
}

function buildDifficultyRows(program, existing = {}) {
  const rows = (program?.subjects || []).map((subject) => {
    const saved = Number(existing[subject.name] || existing[subject.subjectCode] || 3);

    return `
      <div>
        <label class="smart-label" for="diff_${subject.subjectCode}">${subject.name} (coef ${subject.coefficient}${subject.isCore ? ', base' : ''})</label>
        <select class="smart-select" id="diff_${subject.subjectCode}" data-subject-name="${subject.name}">
          <option value="1" ${saved === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${saved === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${saved === 3 ? 'selected' : ''}>3</option>
          <option value="4" ${saved === 4 ? 'selected' : ''}>4</option>
          <option value="5" ${saved === 5 ? 'selected' : ''}>5</option>
        </select>
      </div>
    `;
  }).join('');

  difficultyContainer.innerHTML = `
    <h3 class="card-title" style="margin-top:12px;">Difficultes par matiere</h3>
    <div class="smart-form-grid" style="margin-top:10px;">${rows || '<div class="card-sub">Aucune matiere disponible.</div>'}</div>
  `;
}

function renderEditableGrid(container, calendar, options, gridName) {
  let html = '<table class="smart-table"><tr><th>Heure</th>';
  jours.forEach((day) => {
    html += `<th>${day}</th>`;
  });
  html += '</tr>';

  horaires.forEach((hour) => {
    html += `<tr><td class="hour-cell">${hour}</td>`;

    jours.forEach((day) => {
      const current = calendar[day]?.[hour] || 'Libre';
      const optionsHtml = options
        .map((value) => `<option value="${value}" ${value === current ? 'selected' : ''}>${value}</option>`)
        .join('');

      html += `
        <td>
          <select class="smart-select" data-grid="${gridName}" data-day="${day}" data-hour="${hour}">
            ${optionsHtml}
          </select>
        </td>
      `;
    });

    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

function classifyValue(value) {
  if (!value) return 'cell-blocked';
  if (value.startsWith('Cours ')) return 'cell-course';
  if (value.startsWith('Revision ') || value.startsWith('Compo ')) return 'cell-revision';
  if (['Repos', 'Pause', 'Sommeil', 'Activite personnelle', 'Indisponible'].includes(value)) return 'cell-blocked';
  return 'cell-study';
}

function renderReadOnlyGrid(container, calendar, schedule = null) {
  let html = '<table class="smart-table"><tr><th>Heure</th>';
  jours.forEach((day) => {
    html += `<th>${day}</th>`;
  });
  html += '</tr>';

  let delay = 0;
  horaires.forEach((hour) => {
    html += `<tr><td class="hour-cell">${hour}</td>`;

    jours.forEach((day) => {
      const value = calendar[day]?.[hour] || 'Repos';
      const css = classifyValue(value);
      const accent = getCellAccent(value, schedule);
      html += `
        <td class="schedule-cell ${css} ${css !== 'cell-blocked' ? 'subject-cell' : ''}" style="animation-delay:${delay}ms;--cell-accent:${accent};">
          ${buildReadOnlyCell(value, schedule, day, hour)}
        </td>
      `;
      delay += 3;
    });

    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}

function normalizeGeneratedValue(value) {
  if (!value) return 'Libre';
  if (value.startsWith('Cours ')) {
    return value.replace(/^Cours\s+/i, '').replace(/\s*\(rev.*\)$/i, '').trim();
  }
  if (value.startsWith('Revision ')) return value.replace(/^Revision\s+/i, '').trim();
  if (value.startsWith('Compo ')) return value.replace(/^Compo\s+/i, '').trim();
  return value;
}

function scheduleToEditable(calendar, options) {
  const optionSet = new Set(options);
  const mapped = buildEmptyCalendar();

  jours.forEach((day) => {
    horaires.forEach((hour) => {
      const normalized = normalizeGeneratedValue(calendar?.[day]?.[hour] || 'Libre');
      mapped[day][hour] = optionSet.has(normalized) ? normalized : 'Libre';
    });
  });

  return mapped;
}

function collectDifficulties() {
  const difficulties = {};
  document.querySelectorAll('[id^="diff_"]').forEach((select) => {
    const subjectName = select.dataset.subjectName;
    if (!subjectName) return;
    difficulties[subjectName] = Number(select.value || 3);
  });
  return difficulties;
}

function collectPreferences() {
  const values = [document.getElementById('pref1').value, document.getElementById('pref2').value].filter(Boolean);
  return [...new Set(values)].slice(0, 2);
}

function collectPayload(extra = {}) {
  return {
    classCode: classSelect.value,
    preferredStudyMoments: collectPreferences(),
    maxSessionsPerDay: Number(document.getElementById('maxSessionsPerDay').value || 3),
    maxHoursPerWeek: Number(document.getElementById('maxHoursPerWeek').value || 18),
    examMode: document.getElementById('examMode').value === 'true',
    difficultyLevels: collectDifficulties(),
    fixedCourses: calendarToFixedCourses(state.schoolCalendar),
    assignments: state.assignments,
    ...extra
  };
}

function renderBadges(schedule) {
  const warningCount = schedule.stats?.overloadWarnings?.length || 0;
  const parts = [
    `Badge ${schedule.badge || '-'}`,
    `Surcharge ${schedule.overload ? 'Oui' : 'Non'}`,
    `Revision ${schedule.stats?.totalStudyHours ?? 0}h`,
    `Ajustements ${schedule.manualAdjustmentsApplied ?? 0}`,
    `Alertes ${warningCount}`
  ];

  badgesWrap.innerHTML = parts.map((part) => `<span class="badge-chip">${part}</span>`).join('');
}

function renderRevisionLegend(schedule) {
  const legend = schedule?.revisionLegend || { 10: '#6cb6ff', 15: '#ff8a65', 20: '#ff4563' };
  revisionLegend.innerHTML = `
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[10] || legend['10'] || '#6cb6ff'}"></span>Revision avant cours 10 min</span>
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[15] || legend['15'] || '#ff8a65'}"></span>Revision avant cours 15 min</span>
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[20] || legend['20'] || '#ff4563'}"></span>Revision avant cours 20 min</span>
    <span class="legend-chip"><span class="mini-icon study"></span>Seance d etude programmee</span>
  `;
}

function renderProgress(schedule) {
  const stats = schedule?.stats || {};
  const weekGoal = Number(document.getElementById('maxHoursPerWeek').value || 18);
  const rows = [];

  rows.push(`
    <div class="progress-row">
      <div class="progress-head"><span>Objectif hebdo</span><strong>${stats.totalStudyHours || 0}/${weekGoal}h</strong></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, Math.round(((stats.totalStudyHours || 0) / weekGoal) * 100))}%"></div></div>
    </div>
  `);

  const entries = Object.entries(stats.hoursBySubject || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  entries.forEach(([subject, hours]) => {
    const percent = Math.min(100, Math.round((Number(hours) / Math.max(weekGoal / 3, 1)) * 100));
    rows.push(`
      <div class="progress-row">
        <div class="progress-head"><span>${subject}</span><strong>${hours}h</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      </div>
    `);
  });

  progressList.innerHTML = rows.join('') || '<div class="progress-row">Aucune progression a afficher.</div>';
}

function renderAssignments() {
  if (!state.assignments.length) {
    assignmentList.innerHTML = '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucun devoir configure.</div><div class="notice-time">Info</div></div>';
    return;
  }

  assignmentList.innerHTML = state.assignments.map((assignment) => `
    <div class="notice-item with-actions">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${assignment.subjectName} - ${assignment.dueDate} (priorite ${assignment.level})</div>
      <div class="notice-time">${assignment.title || 'Devoir'}</div>
      <button class="notice-mini-btn red" data-remove-assignment="${assignment.assignmentId}">Suppr.</button>
    </div>
  `).join('');
}

function renderParentRequests() {
  if (!state.parentRequests.length) {
    parentRequestList.innerHTML = '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucune demande parent en attente.</div><div class="notice-time">Compte</div></div>';
    return;
  }

  parentRequestList.innerHTML = state.parentRequests.map((request) => `
    <div class="notice-item with-actions">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${request.parent?.fullName || request.parentName || 'Parent'} demande l acces au suivi de ton compte (${request.studentMatricule || state.profile?.matricule || ''}).</div>
      <button class="notice-mini-btn" data-parent-link="${request.linkId}" data-parent-decision="approve">Confirmer</button>
      <button class="notice-mini-btn red" data-parent-link="${request.linkId}" data-parent-decision="reject">Refuser</button>
    </div>
  `).join('');
}

function renderNotifications(schedule) {
  const inbox = state.notificationsInbox;
  const blocks = [];

  if (inbox?.pendingAction?.length) {
    inbox.pendingAction.forEach((notification) => {
      blocks.push(`
        <div class="notice-item with-actions">
          <span class="notice-dot dot-red"></span>
          <div class="notice-text">${notification.day} ${notification.hour} - ${notification.subjectName}: tu es dispo ?</div>
          <button class="notice-mini-btn" data-noti-id="${notification.notificationId}" data-noti-response="dispo">Dispo</button>
          <button class="notice-mini-btn red" data-noti-id="${notification.notificationId}" data-noti-response="pas_dispo">Pas dispo</button>
        </div>
      `);
    });
  }

  if (inbox?.upcoming?.length) {
    inbox.upcoming.slice(0, 5).forEach((notification) => {
      blocks.push(`
        <div class="notice-item">
          <span class="notice-dot dot-blue"></span>
          <div class="notice-text">Rappel programme: ${notification.day} ${notification.hour} - ${notification.subjectName}</div>
          <div class="notice-time">A venir</div>
        </div>
      `);
    });
  }

  if (inbox?.recent?.length) {
    inbox.recent.slice(0, 4).forEach((notification) => {
      const statusLabel = notification.status === 'missed'
        ? 'Manquee'
        : (notification.status === 'rescheduled'
          ? 'Replanifiee'
          : (notification.status === 'auto_completed_unconfirmed'
            ? 'Effectuee sans confirmation'
            : 'Confirmee'));

      blocks.push(`
        <div class=\"notice-item\">
          <span class=\"notice-dot dot-ok\"></span>
          <div class=\"notice-text\">${notification.day} ${notification.hour} - ${notification.subjectName}</div>
          <div class=\"notice-time\">${statusLabel}</div>
        </div>
      `);
    });
  }

  if (!blocks.length && schedule?.stats?.overloadWarnings?.length) {
    schedule.stats.overloadWarnings.forEach((warning) => {
      blocks.push(`
        <div class="notice-item">
          <span class="notice-dot dot-red"></span>
          <div class="notice-text">${warning}</div>
          <div class="notice-time">Alerte</div>
        </div>
      `);
    });
  }

  if (!blocks.length) {
    blocks.push('<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucun rappel en attente.</div><div class="notice-time">Systeme</div></div>');
  }

  noticeList.innerHTML = blocks.join('');

  const pendingCount = inbox?.totals?.pending || 0;
  const upcomingCount = inbox?.totals?.upcoming || 0;
  kpiNotices.textContent = String(pendingCount + upcomingCount);
}

function renderGamification(schedule) {
  const balancedDays = schedule?.stats?.balancedDays || 0;
  const totalHours = schedule?.stats?.totalStudyHours || 0;
  const xp = Math.round(totalHours * 14 + balancedDays * 18 + (schedule?.overload ? 0 : 35));
  const streak = Math.max(1, balancedDays + (schedule?.overload ? 0 : 2));
  const level = Math.max(1, Math.floor(xp / 120) + 1);

  state.xp = xp;
  state.streak = streak;

  kpiWeeklyHours.textContent = `${totalHours} h`;
  kpiStreak.textContent = `${streak} jours`;
  kpiLevel.textContent = `Niveau ${level}`;

  streakBox.innerHTML = `
    <div class="kpi-label">Serie active</div>
    <div class="streak-value">${streak}</div>
    <div class="card-sub" style="margin-top:6px;">${xp} XP accumules - continue pour debloquer de nouveaux badges.</div>
    <div class="badges-wrap" style="margin-top:8px;">
      <span class="badge-chip">${schedule?.badge || 'Debutant'}</span>
      <span class="badge-chip">${schedule?.overload ? 'Mode Equilibre' : 'Flow Expert'}</span>
      <span class="badge-chip">${totalHours >= 14 ? 'Marathon Study' : 'Focus Builder'}</span>
    </div>
  `;
}

function renderAnalysis(schedule) {
  const analysis = schedule?.proposalAnalysis;
  const missedCount = state.missedSessions.length;
  if (!analysis) {
    analysisBox.innerHTML = `
      <div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucune contre-proposition analysee pour le moment.</div><div class="notice-time">Info</div></div>
      <div class="notice-item"><span class="notice-dot dot-red"></span><div class="notice-text">Seances manqueees enregistrees: ${missedCount}</div><div class="notice-time">Suivi</div></div>
    `;
    return;
  }

  const suggestions = (analysis.suggestions || []).map((suggestion) => `
    <div class="notice-item">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${suggestion}</div>
      <div class="notice-time">Conseil IA</div>
    </div>
  `).join('');

  analysisBox.innerHTML = `
    <div class="notice-item">
      <span class="notice-dot dot-red"></span>
      <div class="notice-text">Couverture matieres de base: ${analysis.coverageCoreSubjects || 0}%</div>
      <div class="notice-time">Analyse</div>
    </div>
    <div class="notice-item">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">Heures optionnelles: ${analysis.optionalHours || 0}h | Ecart: ${analysis.divergenceHours || 0}h</div>
      <div class="notice-time">Analyse</div>
    </div>
    <div class="notice-item">
      <span class="notice-dot dot-red"></span>
      <div class="notice-text">Seances manqueees enregistrees: ${missedCount}</div>
      <div class="notice-time">Suivi</div>
    </div>
    ${suggestions || ''}
  `;
}

function renderGeneratedSchedule(schedule) {
  state.generatedSchedule = schedule;
  state.isEditingGenerated = false;
  analyzeProposalBtn.style.display = 'none';
  editGeneratedBtn.textContent = 'Modifier le planning genere';

  generatedCard.style.display = 'block';
  renderBadges(schedule);
  renderRevisionLegend(schedule);
  renderReadOnlyGrid(generatedTableWrap, schedule.calendar || buildEmptyCalendar(), schedule);
  renderProgress(schedule);
  renderGamification(schedule);
  renderAnalysis(schedule);
  renderNotifications(schedule);
}

function renderGeneratedEditable() {
  if (!state.generatedSchedule) return;

  const options = buildSchoolOptions(state.program);
  state.generatedEditableCalendar = scheduleToEditable(state.generatedSchedule.calendar || {}, options);

  state.isEditingGenerated = true;
  editGeneratedBtn.textContent = 'Annuler modifications';
  analyzeProposalBtn.style.display = 'inline-block';

  renderEditableGrid(generatedTableWrap, state.generatedEditableCalendar, options, 'generated-grid');
}

function exportSchedulePdf() {
  if (!state.generatedSchedule) {
    setStatus('Genere d abord un planning avant d exporter en PDF.', 'error');
    return;
  }

  const exportWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!exportWindow) {
    setStatus('Le navigateur a bloque l ouverture de la fenetre PDF.', 'error');
    return;
  }

  const tableMarkup = generatedTableWrap.innerHTML;
  const legendMarkup = revisionLegend.innerHTML;
  exportWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Planning SAFIO PDF</title>
      <link rel="stylesheet" href="/css/smart-platform.css" />
    </head>
    <body class="smart-platform">
      <main class="smart-shell">
        <section class="smart-card">
          <h1 class="card-title">Planning SAFIO - ${state.profile?.fullName || 'Eleve'}</h1>
          <p class="card-sub">${state.profile?.classCode || ''} - export PDF du planning genere.</p>
          <div class="badges-wrap" style="margin-top:10px;">${badgesWrap.innerHTML}</div>
          <div class="revision-legend" style="margin-top:10px;">${legendMarkup}</div>
          <div class="table-shell" style="margin-top:12px;">${tableMarkup}</div>
        </section>
      </main>
    </body>
    </html>
  `);
  exportWindow.document.close();
  exportWindow.focus();
  setTimeout(() => {
    exportWindow.print();
  }, 350);
}

function renderClassOptions(classes, selectedClassCode) {
  classSelect.innerHTML = classes
    .map((item) => `<option value="${item.classCode}" ${item.classCode === selectedClassCode ? 'selected' : ''}>${item.label}</option>`)
    .join('');
}

function renderAssignmentSubjectOptions() {
  const options = getProgramSubjectNames(state.program);
  assignmentSubject.innerHTML = options.map((subject) => `<option value="${subject}">${subject}</option>`).join('');
}

function applyProfileDefaults(profile) {
  const prefs = profile.preferences || {};
  const contact = profile.notificationSettings || {};

  document.getElementById('maxSessionsPerDay').value = Number(prefs.maxSessionsPerDay || 3);
  document.getElementById('maxHoursPerWeek').value = Number(prefs.maxHoursPerWeek || 18);
  document.getElementById('examMode').value = prefs.examMode ? 'true' : 'false';

  const preferred = Array.isArray(prefs.preferredStudyMoments) ? prefs.preferredStudyMoments.slice(0, 2) : [];
  document.getElementById('pref1').value = preferred[0] || '';
  document.getElementById('pref2').value = preferred[1] || '';

  studentPhone.value = profile.phone || '';
  telegramChatId.value = contact.telegramChatId || '';
  smsEnabled.value = contact.smsEnabled ? 'true' : 'false';
  reminderLeadMinutes.value = String(contact.reminderLeadMinutes || 10);
}

function setupBulkSelectors() {
  bulkDays.innerHTML = jours.map((day) => `
    <label class="day-pill">
      <input type="checkbox" value="${day}" checked />
      <span>${day.slice(0, 3)}</span>
    </label>
  `).join('');

  const hourOptions = horaires.map((hour) => `<option value="${hour}">${hour}</option>`).join('');
  bulkStartHour.innerHTML = hourOptions;
  bulkEndHour.innerHTML = hourOptions;

  bulkStartHour.value = '07:00';
  bulkEndHour.value = '09:00';
}

function refreshBulkSubjectOptions() {
  const options = buildSchoolOptions(state.program);
  bulkSubject.innerHTML = options.map((value) => `<option value="${value}">${value}</option>`).join('');
  bulkSubject.value = 'Libre';
}

function applyRangeValue(value) {
  const checkedDays = Array.from(bulkDays.querySelectorAll('input:checked')).map((input) => input.value);
  if (checkedDays.length === 0) {
    setStatus('Selectionne au moins un jour pour appliquer la plage.', 'error');
    return;
  }

  const startIndex = horaires.indexOf(bulkStartHour.value);
  const endIndex = horaires.indexOf(bulkEndHour.value);
  if (startIndex === -1 || endIndex === -1) return;

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  checkedDays.forEach((day) => {
    for (let index = from; index <= to; index += 1) {
      state.schoolCalendar[day][horaires[index]] = value;
    }
  });

  renderEditableGrid(schoolTableWrap, state.schoolCalendar, buildSchoolOptions(state.program), 'school-grid');
  setStatus(`Plage appliquee: ${checkedDays.join(', ')} de ${horaires[from]} a ${horaires[to]} -> ${value}.`, 'success');
}

async function saveContactSettings() {
  try {
    const payload = {
      phone: studentPhone.value,
      telegramChatId: telegramChatId.value,
      smsEnabled: smsEnabled.value === 'true',
      reminderLeadMinutes: Number(reminderLeadMinutes.value || 10)
    };

    await putJSON('/api/students/me/contact', payload);
    state.profile = {
      ...state.profile,
      phone: payload.phone,
      notificationSettings: {
        ...(state.profile?.notificationSettings || {}),
        smsEnabled: payload.smsEnabled,
        reminderLeadMinutes: payload.reminderLeadMinutes,
        telegramChatId: payload.telegramChatId,
        telegramEnabled: Boolean(String(payload.telegramChatId || '').trim())
      }
    };

    setStatus('SMS et Telegram enregistres pour les notifications.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible d\'enregistrer les canaux de notification.');
  }
}

function addAssignmentLocally() {
  const subjectName = assignmentSubject.value;
  const dueDate = assignmentDate.value;
  const level = Number(assignmentLevel.value || 3);

  if (!subjectName || !dueDate) {
    setStatus('Selectionne une matiere et une date de devoir.', 'error');
    return;
  }

  state.assignments.push({
    assignmentId: generateLocalId('asg'),
    subjectName,
    dueDate,
    level,
    title: `Devoir ${subjectName}`,
    revisionHour: '20:00'
  });

  state.assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  renderAssignments();
  setStatus(`Devoir ajoute: ${subjectName} (${dueDate}).`, 'success');

  saveAssignments().catch(() => {
    setStatus('Le devoir est ajoute localement mais la sauvegarde serveur a echoue.', 'error');
  });
}

function removeAssignment(assignmentId) {
  state.assignments = state.assignments.filter((assignment) => assignment.assignmentId !== assignmentId);
  renderAssignments();

  saveAssignments().catch(() => {
    setStatus('Suppression locale effectuee mais sauvegarde serveur echouee.', 'error');
  });
}

async function saveAssignments() {
  await putJSON('/api/students/me/assignments', { assignments: state.assignments });
}

async function refreshParentRequests(silent = true) {
  try {
    const { data } = await getJSON('/api/students/me/parent-requests');
    state.parentRequests = Array.isArray(data) ? data : [];
    renderParentRequests();
  } catch (error) {
    if (!silent) handleApiError(error, 'Impossible de charger les demandes parent.');
  }
}

async function respondToParentRequest(linkId, decision) {
  try {
    await postJSON(`/api/students/me/parent-requests/${encodeURIComponent(linkId)}/respond`, { decision });
    await refreshParentRequests(false);
    setStatus(decision === 'approve' ? 'Parent confirme avec succes.' : 'Demande parent refusee.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible de traiter la demande parent.');
  }
}

async function persistStudentState(payload) {
  await Promise.all([
    putJSON('/api/students/me/preferences', {
      preferredStudyMoments: payload.preferredStudyMoments,
      maxSessionsPerDay: payload.maxSessionsPerDay,
      maxHoursPerWeek: payload.maxHoursPerWeek,
      examMode: payload.examMode
    }),
    putJSON('/api/students/me/difficulties', { difficulties: payload.difficultyLevels }),
    postJSON('/api/students/me/fixed-courses', { fixedCourses: payload.fixedCourses }),
    saveAssignments()
  ]);
}

async function refreshNotificationInbox(silent = true) {
  try {
    const [{ data: inbox }, { data: missed }] = await Promise.all([
      getJSON('/api/notifications/inbox'),
      getJSON('/api/notifications/missed')
    ]);

    state.notificationsInbox = inbox;
    state.missedSessions = Array.isArray(missed) ? missed : [];
    renderNotifications(state.generatedSchedule);
  } catch (error) {
    if (!silent) handleApiError(error, 'Impossible de charger les notifications.');
  }
}

async function respondToNotification(notificationId, response) {
  try {
    const { data } = await postJSON(`/api/notifications/${encodeURIComponent(notificationId)}/respond`, { response });
    if (data?.schedule) {
      state.generatedSchedule = data.schedule;
      renderGeneratedSchedule(data.schedule);
    }

    await refreshNotificationInbox(false);
    setStatus(response === 'dispo' ? 'Session confirmee.' : 'Session replanifiee ou marquee manquee.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible de traiter la reponse notification.');
  }
}

async function generateSchedule() {
  try {
    const payload = collectPayload();
    setStatus('Generation en cours... sauvegarde, planification et notifications.', 'info');

    await persistStudentState(payload);
    const { data } = await postJSON('/api/schedules/generate', payload);

    renderGeneratedSchedule(data);
    await refreshNotificationInbox();
    setStatus('Planning genere et notifications creees.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible de generer le planning.');
  }
}

async function analyzeProposalAndRegenerate() {
  try {
    if (!state.isEditingGenerated) return;

    const payload = collectPayload({ proposedCalendar: state.generatedEditableCalendar || {} });
    setStatus('Analyse de ta proposition et generation d\'une contre-proposition...', 'info');

    await persistStudentState(payload);
    const { data } = await postJSON('/api/schedules/regenerate', payload);

    renderGeneratedSchedule(data);
    await refreshNotificationInbox();
    setStatus('Contre-proposition prete et enregistree.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible d\'analyser ta proposition.');
  }
}

async function generateEvolvingSchedules() {
  try {
    if (!state.assignments.length) {
      setStatus('Ajoute au moins un devoir avant de generer le planning evolutif.', 'error');
      return;
    }

    const payload = collectPayload({
      weeksCount: 4,
      assignments: state.assignments
    });

    setStatus('Generation evolutive sur 4 semaines en cours...', 'info');
    await persistStudentState(payload);

    const { data } = await postJSON('/api/schedules/evolving/generate', payload);
    const activeSchedule = (data.schedules || [])[0] || null;

    if (activeSchedule) {
      renderGeneratedSchedule(activeSchedule);
    }

    await refreshNotificationInbox();
    setStatus('Planning evolutif genere avec succes.', 'success');
  } catch (error) {
    handleApiError(error, 'Impossible de generer le planning evolutif.');
  }
}

async function loadCurrentSchedule() {
  try {
    const { data } = await getJSON('/api/schedules/current');
    renderGeneratedSchedule(data);
    setStatus('Planning actif recharge depuis la base.', 'success');
  } catch (error) {
    if (error?.status === 404) {
      setStatus('Aucun planning actif. Lance une generation.', 'info');
      return;
    }
    handleApiError(error, 'Impossible de charger le planning actif.');
  }
}

async function loadProgram(classCode) {
  const { data } = await getJSON(`/api/academics/classes/${encodeURIComponent(classCode)}/program`);
  state.program = data;
  buildDifficultyRows(data, state.profile?.difficulties || {});

  if (!state.schoolCalendar) {
    state.schoolCalendar = mapFixedCoursesToCalendar(state.profile?.fixedCourses || []);
  }

  renderEditableGrid(schoolTableWrap, state.schoolCalendar, buildSchoolOptions(state.program), 'school-grid');
  refreshBulkSubjectOptions();
  renderAssignmentSubjectOptions();
}

async function loadInitialData() {
  try {
    setupPageTransition();
    setupBulkSelectors();

    const [{ data: profile }, { data: classes }] = await Promise.all([
      getJSON('/api/students/me'),
      getJSON('/api/academics/classes')
    ]);

    state.profile = profile;
    state.classes = classes;
    state.assignments = Array.isArray(profile.assignments)
      ? profile.assignments.map((assignment) => ({
        ...assignment,
        assignmentId: assignment.assignmentId || generateLocalId('asg')
      }))
      : [];

    const selectedClass = profile.classCode || classes[0]?.classCode;
    renderClassOptions(classes, selectedClass);
    applyProfileDefaults(profile);

    state.schoolCalendar = mapFixedCoursesToCalendar(profile.fixedCourses || []);
    await loadProgram(selectedClass);
    renderAssignments();

    setStatus('Interface prete. Utilise la saisie rapide et le planning evolutif pour optimiser ton suivi.', 'success');

    await loadCurrentSchedule().catch(() => {});
    await refreshNotificationInbox();
    await refreshParentRequests();

    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      refreshNotificationInbox(true);
      refreshParentRequests(true);
    }, 30000);
  } catch (error) {
    if (error?.status === 403 || error?.status === 401) {
      try {
        const { data } = await getJSON('/api/auth/me');
        if (data?.role === 'parent') {
          window.location.href = '/pages/dashboard.html';
          return;
        }
      } catch (_authError) {
        // fall through to default handler
      }
    }
    handleApiError(error, 'Impossible de charger la page emploi du temps.');
  }
}

schoolTableWrap.addEventListener('change', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'SELECT') return;
  if (target.dataset.grid !== 'school-grid') return;

  const day = target.dataset.day;
  const hour = target.dataset.hour;
  if (!day || !hour) return;

  state.schoolCalendar[day][hour] = target.value;
});

generatedTableWrap.addEventListener('change', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'SELECT') return;
  if (target.dataset.grid !== 'generated-grid') return;

  const day = target.dataset.day;
  const hour = target.dataset.hour;
  if (!day || !hour || !state.generatedEditableCalendar) return;

  state.generatedEditableCalendar[day][hour] = target.value;
});

noticeList.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'BUTTON') return;

  const notificationId = target.dataset.notiId;
  const response = target.dataset.notiResponse;
  if (!notificationId || !response) return;

  respondToNotification(notificationId, response);
});

assignmentList.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'BUTTON') return;
  const assignmentId = target.dataset.removeAssignment;
  if (!assignmentId) return;

  removeAssignment(assignmentId);
});

parentRequestList.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'BUTTON') return;

  const linkId = target.dataset.parentLink;
  const decision = target.dataset.parentDecision;
  if (!linkId || !decision) return;

  respondToParentRequest(linkId, decision);
});

classSelect.addEventListener('change', async () => {
  try {
    await loadProgram(classSelect.value);
    setStatus('Programme recharge pour la classe selectionnee.', 'info');
  } catch (error) {
    handleApiError(error, 'Impossible de charger le programme de cette classe.');
  }
});

saveContactBtn.addEventListener('click', saveContactSettings);
bulkApplyBtn.addEventListener('click', () => applyRangeValue(bulkSubject.value || 'Libre'));
bulkClearBtn.addEventListener('click', () => applyRangeValue('Libre'));
addAssignmentBtn.addEventListener('click', addAssignmentLocally);
generateEvolvingBtn.addEventListener('click', generateEvolvingSchedules);
generateBtn.addEventListener('click', generateSchedule);
loadCurrentBtn.addEventListener('click', loadCurrentSchedule);
downloadPdfBtn.addEventListener('click', exportSchedulePdf);

editGeneratedBtn.addEventListener('click', () => {
  if (!state.generatedSchedule) return;

  if (!state.isEditingGenerated) {
    renderGeneratedEditable();
    setStatus('Mode edition active. Modifie les cases puis clique sur analyser.', 'info');
    return;
  }

  state.isEditingGenerated = false;
  analyzeProposalBtn.style.display = 'none';
  editGeneratedBtn.textContent = 'Modifier le planning genere';
  renderReadOnlyGrid(generatedTableWrap, state.generatedSchedule.calendar || buildEmptyCalendar(), state.generatedSchedule);
  setStatus('Edition annulee, retour a la version generee.', 'info');
});

analyzeProposalBtn.addEventListener('click', analyzeProposalAndRegenerate);

loadInitialData();
