import { getJSON, postJSON, putJSON } from './utils/api.js';
import { clearToken } from './utils/session.js';
import { setupPageTransition } from './utils/page-transition.js';

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const horaires = Array.from({ length: 17 }, (_, index) => `${String(index + 7).padStart(2, '0')}:00`).concat('23:30');

const state = {
  role: 'student',
  authUser: null,
  studentProfile: null,
  parentProfile: null,
  linkedStudents: [],
  activeStudentUid: '',
  activeStudent: null,
  currentProgram: null,
  currentSchedule: null,
  currentInbox: null,
  currentMissedSessions: [],
  parentRequests: []
};

const viewerCard = document.getElementById('viewerCard');
const studentSelector = document.getElementById('studentSelector');
const profileCard = document.getElementById('profileCard');
const accountCard = document.getElementById('accountCard');
const programCard = document.getElementById('programCard');
const weeklyTableWrap = document.getElementById('weeklyTableWrap');
const progressPanel = document.getElementById('progressPanel');
const noticePanel = document.getElementById('noticePanel');
const detailsPanel = document.getElementById('detailsPanel');
const gamePanel = document.getElementById('gamePanel');
const revisionLegend = document.getElementById('revisionLegend');
const messageBox = document.getElementById('messageBox');
const dashboardTitle = document.getElementById('dashboardTitle');
const dashboardSubtitle = document.getElementById('dashboardSubtitle');
const generateBtn = document.getElementById('generateBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const logoutBtn = document.getElementById('logoutBtn');
const editLink = document.getElementById('editLink');
const emploiLink = document.getElementById('emploiLink');

const kpiHours = document.getElementById('kpiHours');
const kpiBalanced = document.getElementById('kpiBalanced');
const kpiStreak = document.getElementById('kpiStreak');
const kpiBadge = document.getElementById('kpiBadge');

function setMessage(message, type = 'info') {
  messageBox.style.display = 'block';
  messageBox.className = `status-box status-${type}`;
  messageBox.textContent = message;
}

function redirectToLogin(message = 'Session invalide. Redirection vers connexion...') {
  clearToken();
  setMessage(message, 'error');
  setTimeout(() => {
    window.location.href = '/pages/login.html';
  }, 700);
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

function getSubjectColor(subjectName, schedule = state.currentSchedule) {
  if (schedule?.subjectThemes?.[subjectName]?.color) return schedule.subjectThemes[subjectName].color;
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
  return colors[getSubjectFamily(subjectName)] || colors.other;
}

function cleanScheduleLabel(value) {
  return String(value || '')
    .replace(/^Cours\s+/i, '')
    .replace(/^Revision\s+/i, '')
    .replace(/^Compo\s+/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

function classifyValue(value) {
  if (!value) return 'cell-blocked';
  if (value.startsWith('Cours ')) return 'cell-course';
  if (value.startsWith('Revision ') || value.startsWith('Compo ')) return 'cell-revision';
  if (['Repos', 'Pause', 'Sommeil', 'Activite personnelle', 'Indisponible'].includes(value)) return 'cell-blocked';
  return 'cell-study';
}

function getCourseRevisionMeta(schedule, day, hour) {
  return (schedule?.microRevisionPlan || []).find((entry) => entry.day === day && entry.startHour === hour) || null;
}

function getRevisionPillColor(minutes, schedule) {
  const legend = schedule?.revisionLegend || {};
  return legend[String(minutes)] || legend[minutes] || '#6cb6ff';
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

function renderRevisionLegend(schedule) {
  const legend = schedule?.revisionLegend || { 10: '#6cb6ff', 15: '#ff8a65', 20: '#ff4563' };
  revisionLegend.innerHTML = `
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[10] || legend['10'] || '#6cb6ff'}"></span>Avant cours 10 min</span>
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[15] || legend['15'] || '#ff8a65'}"></span>Avant cours 15 min</span>
    <span class="legend-chip"><span class="legend-swatch" style="--legend-color:${legend[20] || legend['20'] || '#ff4563'}"></span>Avant cours 20 min</span>
    <span class="legend-chip"><span class="mini-icon study"></span>Revision programmee</span>
  `;
}

function row(label, value) {
  return `
    <div class="progress-row">
      <div class="progress-head"><span>${label}</span><strong>${value ?? '-'}</strong></div>
    </div>
  `;
}

function renderProfile() {
  const student = state.activeStudent;
  if (state.role === 'parent') {
    profileCard.innerHTML = `
      <h2 class="card-title">Compte parent</h2>
      <p class="card-sub">Vue parent avec l enfant actuellement selectionne.</p>
      <div class="progress-list" style="margin-top:10px;">
        ${row('Parent', state.parentProfile?.fullName)}
        ${row('Email', state.parentProfile?.email)}
        ${row('Telephone', state.parentProfile?.phone || 'Non renseigne')}
        ${row('Eleve', student?.fullName || 'Aucun enfant actif')}
        ${row('Matricule', student?.matricule || '-')}
        ${row('Classe', student?.classCode || '-')}
      </div>
    `;
    return;
  }

  if (!student) {
    profileCard.innerHTML = `
      <h2 class="card-title">Profil</h2>
      <p class="card-sub">Aucune donnee disponible.</p>
    `;
    return;
  }

  profileCard.innerHTML = `
    <h2 class="card-title">Profil eleve</h2>
    <p class="card-sub">Vue generale du compte et de tes preferences de planning.</p>
    <div class="progress-list" style="margin-top:10px;">
      ${row('Nom complet', student.fullName)}
      ${row('Matricule', student.matricule)}
      ${row('Classe', student.classCode)}
      ${row('Date de naissance', student.birthDate)}
      ${row('Telephone', student.phone || 'Non renseigne')}
    </div>
  `;
}

function renderAccountCard() {
  if (state.role === 'parent') {
    const telegramChatId = state.parentProfile?.notificationSettings?.telegramChatId || '';
    const phone = state.parentProfile?.phone || '';
    const pendingLinks = (state.parentProfile?.links || [])
      .filter((link) => link.status === 'pending_student_confirmation')
      .map((link) => `
        <div class="notice-item">
          <span class="notice-dot dot-blue"></span>
          <div class="notice-text">Demande en attente pour ${link.studentName || link.studentMatricule}</div>
          <div class="notice-time">En attente eleve</div>
        </div>
      `)
      .join('');

    accountCard.innerHTML = `
      <h2 class="card-title">Liaisons et Telegram</h2>
      <p class="card-sub">Ajoute un matricule eleve apres inscription et modifie aussi ton ID Telegram a tout moment.</p>
      <form id="parentLinkForm" class="smart-form-grid" style="margin-top:10px;">
        <div>
          <label class="smart-label" for="parentStudentMatricules">Matricule(s) eleve</label>
          <textarea class="smart-input" id="parentStudentMatricules" rows="3" placeholder="MAT2026001&#10;MAT2026002"></textarea>
        </div>
        <div style="align-self:end;">
          <button class="smart-btn" type="submit">Envoyer la demande de liaison</button>
        </div>
      </form>
      <form id="parentContactForm" class="smart-form-grid" style="margin-top:10px;">
        <div>
          <label class="smart-label" for="parentPhone">Telephone parent</label>
          <input class="smart-input" id="parentPhone" type="tel" value="${phone}" placeholder="+2250700000000" />
        </div>
        <div>
          <label class="smart-label" for="parentTelegramChatId">ID chat Telegram SAFIO Bot</label>
          <input class="smart-input" id="parentTelegramChatId" type="text" value="${telegramChatId}" placeholder="123456789" />
        </div>
        <div style="align-self:end;">
          <button class="smart-btn ghost" type="submit">Mettre a jour Telegram</button>
        </div>
      </form>
      <div class="notice-list" style="margin-top:10px;">
        ${pendingLinks || '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucune demande en attente.</div><div class="notice-time">Liaison</div></div>'}
      </div>
    `;
    return;
  }

  const telegramChatId = state.studentProfile?.notificationSettings?.telegramChatId || '';
  const phone = state.studentProfile?.phone || '';
  const requests = (state.parentRequests || []).map((request) => `
    <div class="notice-item with-actions">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${request.parent?.fullName || request.parentName || 'Parent'} demande l acces a ton suivi.</div>
      <button class="notice-mini-btn" data-parent-link="${request.linkId}" data-parent-decision="approve">Confirmer</button>
      <button class="notice-mini-btn red" data-parent-link="${request.linkId}" data-parent-decision="reject">Refuser</button>
    </div>
  `).join('');

  accountCard.innerHTML = `
    <h2 class="card-title">Demandes parent et Telegram</h2>
    <p class="card-sub">Valide les demandes de liaison parent ici et ajoute ton ID Telegram si tu ne l as pas fait a l inscription.</p>
    <form id="studentContactForm" class="smart-form-grid" style="margin-top:10px;">
      <div>
        <label class="smart-label" for="studentPhoneDash">Telephone</label>
        <input class="smart-input" id="studentPhoneDash" type="tel" value="${phone}" placeholder="+2250700000000" />
      </div>
      <div>
        <label class="smart-label" for="studentTelegramChatIdDash">ID chat Telegram SAFIO Bot</label>
        <input class="smart-input" id="studentTelegramChatIdDash" type="text" value="${telegramChatId}" placeholder="123456789" />
      </div>
      <div style="align-self:end;">
        <button class="smart-btn ghost" type="submit">Mettre a jour Telegram</button>
      </div>
    </form>
    <div class="notice-list" style="margin-top:10px;">
      ${requests || '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucune demande parent en attente.</div><div class="notice-time">Compte</div></div>'}
    </div>
  `;
}

function renderProgram(program) {
  if (!program) {
    programCard.innerHTML = `
      <h2 class="card-title">Programme academique</h2>
      <p class="card-sub">Programme indisponible.</p>
    `;
    return;
  }

  const subjects = (program.subjects || [])
    .map((subject) => `<span class="badge-chip" style="border-color:${subject.color};">${subject.canonicalName || subject.name}</span>`)
    .join('');

  programCard.innerHTML = `
    <h2 class="card-title">Programme academique</h2>
    <p class="card-sub">Priorisation des matieres de base et couleurs de lecture du planning.</p>
    <div class="progress-list" style="margin-top:10px;">
      ${row('Classe', program.label)}
      ${row('Cycle', program.cycle)}
      ${row('Matieres prioritaires', (program.importantSubjects || []).join(', ') || 'Aucune')}
    </div>
    <div class="badges-wrap" style="margin-top:10px;">${subjects}</div>
  `;
}

function renderWeeklyTable(schedule) {
  if (!schedule?.calendar) {
    weeklyTableWrap.innerHTML = '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucun planning actif pour le moment.</div><div class="notice-time">Info</div></div>';
    revisionLegend.innerHTML = '';
    return;
  }

  renderRevisionLegend(schedule);
  let html = '<table class="smart-table"><tr><th>Heure</th>';
  jours.forEach((day) => {
    html += `<th>${day}</th>`;
  });
  html += '</tr>';

  let delay = 0;
  horaires.forEach((hour) => {
    html += `<tr><td class="hour-cell">${hour}</td>`;
    jours.forEach((day) => {
      const value = schedule.calendar?.[day]?.[hour] || 'Repos';
      const css = classifyValue(value);
      const accent = getSubjectColor(cleanScheduleLabel(value), schedule);
      html += `
        <td class="schedule-cell ${css} ${css !== 'cell-blocked' ? 'subject-cell' : ''}" style="animation-delay:${delay}ms;--cell-accent:${accent};">
          ${buildReadOnlyCell(value, schedule, day, hour)}
        </td>
      `;
      delay += 4;
    });
    html += '</tr>';
  });

  html += '</table>';
  weeklyTableWrap.innerHTML = html;
}

function renderProgress(schedule) {
  if (!schedule?.stats) {
    progressPanel.innerHTML = '<div class="progress-row">Aucune donnee de progression.</div>';
    return;
  }

  const goal = Number(state.activeStudent?.preferences?.maxHoursPerWeek || 18);
  const stats = schedule.stats;
  const entries = Object.entries(stats.hoursBySubject || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const rows = [
    `
      <div class="progress-row">
        <div class="progress-head"><span>Objectif hebdo</span><strong>${stats.totalStudyHours || 0}/${goal}h</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, Math.round(((stats.totalStudyHours || 0) / goal) * 100))}%"></div></div>
      </div>
    `,
    `
      <div class="progress-row">
        <div class="progress-head"><span>Jours equilibres</span><strong>${stats.balancedDays || 0}/7</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, Math.round(((stats.balancedDays || 0) / 7) * 100))}%"></div></div>
      </div>
    `
  ];

  entries.forEach(([subject, hours]) => {
    const width = Math.min(100, Math.round((Number(hours) / Math.max(goal / 3, 1)) * 100));
    rows.push(`
      <div class="progress-row">
        <div class="progress-head"><span>${subject}</span><strong>${hours}h</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${width}%"></div></div>
      </div>
    `);
  });

  progressPanel.innerHTML = rows.join('');
}

function renderDetails() {
  const student = state.activeStudent;
  if (!student) {
    detailsPanel.innerHTML = '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucune information complementaire.</div><div class="notice-time">Info</div></div>';
    return;
  }

  const assignments = (student.assignments || []).slice(0, 6).map((assignment) => `
    <div class="notice-item">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${assignment.subjectName} - ${assignment.dueDate}</div>
      <div class="notice-time">Priorite ${assignment.level || 3}</div>
    </div>
  `);

  const difficulties = Object.entries(student.difficulties || {}).slice(0, 6).map(([subject, level]) => `
    <div class="notice-item">
      <span class="notice-dot dot-red"></span>
      <div class="notice-text">${subject}</div>
      <div class="notice-time">Difficulte ${level}/5</div>
    </div>
  `);

  detailsPanel.innerHTML = [...assignments, ...difficulties].join('') || '<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucun devoir ou difficulte renseigne.</div><div class="notice-time">Suivi</div></div>';
}

function renderNotices(schedule, inbox) {
  const blocks = [];

  if (inbox?.pendingAction?.length) {
    inbox.pendingAction.forEach((notification) => {
      blocks.push(`
        <div class="notice-item with-actions">
          <span class="notice-dot dot-red"></span>
          <div class="notice-text">${notification.day} ${notification.hour} - ${notification.subjectName}: disponible ?</div>
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
          <div class="notice-text">${notification.day} ${notification.hour} - ${notification.subjectName}</div>
          <div class="notice-time">A venir</div>
        </div>
      `);
    });
  }

  if (state.currentMissedSessions.length) {
    blocks.push(`
      <div class="notice-item">
        <span class="notice-dot dot-red"></span>
        <div class="notice-text">Seances manquees enregistrees: ${state.currentMissedSessions.length}</div>
        <div class="notice-time">Suivi</div>
      </div>
    `);
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
    blocks.push('<div class="notice-item"><span class="notice-dot dot-ok"></span><div class="notice-text">Aucun rappel actif.</div><div class="notice-time">Systeme</div></div>');
  }

  noticePanel.innerHTML = blocks.join('');
}

function renderGame(schedule) {
  const totalHours = schedule?.stats?.totalStudyHours || 0;
  const balancedDays = schedule?.stats?.balancedDays || 0;
  const xp = Math.round(totalHours * 13 + balancedDays * 22 + (schedule?.overload ? 0 : 30));
  const streak = Math.max(1, balancedDays + (schedule?.overload ? 0 : 2));
  const level = Math.max(1, Math.floor(xp / 120) + 1);

  gamePanel.innerHTML = `
    <div class="kpi-label">XP total</div>
    <div class="streak-value">${xp}</div>
    <div class="card-sub" style="margin-top:6px;">Niveau ${level} · Streak ${streak} jours</div>
    <div class="badges-wrap" style="margin-top:8px;">
      <span class="badge-chip">${schedule?.badge || 'Starter'}</span>
      <span class="badge-chip">${schedule?.overload ? 'Ajustement' : 'Regularite'}</span>
      <span class="badge-chip">${totalHours >= 14 ? 'Focus Elite' : 'Focus Actif'}</span>
    </div>
  `;

  kpiHours.textContent = `${totalHours} h`;
  kpiBalanced.textContent = String(balancedDays || 0);
  kpiStreak.textContent = `${streak} jours`;
  kpiBadge.textContent = schedule?.badge || '-';
}

function renderViewerSelector() {
  if (state.role !== 'parent') {
    viewerCard.style.display = 'none';
    return;
  }

  viewerCard.style.display = 'block';
  if (!state.linkedStudents.length) {
    studentSelector.innerHTML = '<option value="">Aucun eleve actif pour le moment</option>';
    return;
  }

  studentSelector.innerHTML = state.linkedStudents.map((student) => (
    `<option value="${student.uid}" ${student.uid === state.activeStudentUid ? 'selected' : ''}>${student.fullName} - ${student.classCode}</option>`
  )).join('');
}

function renderModeUi() {
  const parentMode = state.role === 'parent';
  dashboardTitle.textContent = parentMode ? 'Dashboard parent - SAFIO EDU' : 'Dashboard eleve - SAFIO EDU';
  dashboardSubtitle.textContent = parentMode
    ? 'Suivi du planning, des devoirs, des difficultes et confirmation des seances de l enfant.'
    : 'Planning hebdo, revisions, notifications et progression personnelle.';
  generateBtn.style.display = parentMode ? 'none' : 'inline-block';
  editLink.style.display = parentMode ? 'none' : 'inline-flex';
  emploiLink.style.display = parentMode ? 'none' : 'inline-flex';
}

async function loadStudentParentRequests() {
  const { data } = await getJSON('/api/students/me/parent-requests');
  state.parentRequests = Array.isArray(data) ? data : [];
}

async function saveStudentContactFromDashboard() {
  const phone = document.getElementById('studentPhoneDash')?.value || state.studentProfile?.phone || '';
  const telegramChatId = document.getElementById('studentTelegramChatIdDash')?.value || '';

  await putJSON('/api/students/me/contact', {
    phone,
    telegramChatId,
    smsEnabled: Boolean(state.studentProfile?.notificationSettings?.smsEnabled),
    reminderLeadMinutes: Number(state.studentProfile?.notificationSettings?.reminderLeadMinutes || 10)
  });
  await loadStudentMode(true);
}

async function saveParentContactFromDashboard() {
  const phone = document.getElementById('parentPhone')?.value || state.parentProfile?.phone || '';
  const telegramChatId = document.getElementById('parentTelegramChatId')?.value || '';

  await putJSON('/api/parents/me/contact', {
    phone,
    telegramChatId
  });
  state.parentProfile = (await getJSON('/api/parents/me')).data;
  applyRenderedData();
}

async function sendParentLinkRequestFromDashboard() {
  const studentMatricules = document.getElementById('parentStudentMatricules')?.value || '';
  await postJSON('/api/parents/link-student', { studentMatricules });
  state.parentProfile = (await getJSON('/api/parents/me')).data;
  await loadParentMode();
}

async function respondToParentRequest(linkId, decision) {
  await postJSON(`/api/students/me/parent-requests/${encodeURIComponent(linkId)}/respond`, { decision });
  await loadStudentMode(true);
}

async function respondToNotification(notificationId, response) {
  try {
    if (state.role === 'parent') {
      await postJSON(`/api/parents/students/${encodeURIComponent(state.activeStudentUid)}/notifications/${encodeURIComponent(notificationId)}/respond`, { response });
      await loadParentStudent(state.activeStudentUid, true);
    } else {
      await postJSON(`/api/notifications/${encodeURIComponent(notificationId)}/respond`, { response });
      await loadStudentMode(true);
    }
    setMessage(response === 'dispo' ? 'Seance confirmee.' : 'Seance replanifiee ou marquee manquee.', 'success');
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      redirectToLogin();
      return;
    }
    setMessage(error?.message || 'Impossible de traiter la notification.', 'error');
  }
}

function exportSchedulePdf() {
  if (!state.currentSchedule) {
    setMessage('Aucun planning a exporter.', 'error');
    return;
  }

  const exportWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!exportWindow) {
    setMessage('Le navigateur a bloque l ouverture du PDF.', 'error');
    return;
  }

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
          <h1 class="card-title">Planning SAFIO - ${state.activeStudent?.fullName || ''}</h1>
          <p class="card-sub">${state.activeStudent?.classCode || ''} - export PDF.</p>
          <div class="revision-legend" style="margin-top:10px;">${revisionLegend.innerHTML}</div>
          <div class="table-shell" style="margin-top:12px;">${weeklyTableWrap.innerHTML}</div>
        </section>
      </main>
    </body>
    </html>
  `);
  exportWindow.document.close();
  exportWindow.focus();
  setTimeout(() => exportWindow.print(), 350);
}

function applyRenderedData() {
  renderModeUi();
  renderViewerSelector();
  renderProfile();
  renderAccountCard();
  renderProgram(state.currentProgram);
  renderWeeklyTable(state.currentSchedule);
  renderProgress(state.currentSchedule);
  renderNotices(state.currentSchedule, state.currentInbox);
  renderDetails();
  renderGame(state.currentSchedule);
}

async function loadStudentMode(silent = false) {
  const [{ data: profile }, currentScheduleResponse, inboxResponse, missedResponse] = await Promise.all([
    getJSON('/api/students/me'),
    getJSON('/api/schedules/current').catch((error) => (error?.status === 404 ? { data: null } : Promise.reject(error))),
    getJSON('/api/notifications/inbox'),
    getJSON('/api/notifications/missed')
  ]);

  state.studentProfile = profile;
  state.activeStudent = profile;
  state.activeStudentUid = profile.uid;
  state.currentSchedule = currentScheduleResponse.data || null;
  state.currentInbox = inboxResponse.data || null;
  state.currentMissedSessions = missedResponse.data || [];
  await loadStudentParentRequests();
  const { data: program } = await getJSON(`/api/academics/classes/${encodeURIComponent(profile.classCode)}/program`);
  state.currentProgram = program;

  applyRenderedData();
  if (!silent) {
    setMessage(state.currentSchedule ? 'Dashboard eleve charge.' : 'Aucun planning actif pour le moment.', state.currentSchedule ? 'success' : 'info');
  }
}

async function loadParentStudent(studentUid, silent = false) {
  const { data } = await getJSON(`/api/parents/students/${encodeURIComponent(studentUid)}/overview`);
  state.activeStudentUid = studentUid;
  state.activeStudent = data.student;
  state.currentSchedule = data.schedule || null;
  state.currentInbox = data.notifications || null;
  state.currentMissedSessions = data.missedSessions || [];
  const { data: program } = await getJSON(`/api/academics/classes/${encodeURIComponent(data.student.classCode)}/program`);
  state.currentProgram = program;
  applyRenderedData();
  if (!silent) {
    setMessage(`Suivi parent charge pour ${data.student.fullName}.`, 'success');
  }
}

async function loadParentMode() {
  const [{ data: parent }, { data: students }] = await Promise.all([
    getJSON('/api/parents/me'),
    getJSON('/api/parents/my-students')
  ]);

  state.parentProfile = parent;
  state.linkedStudents = Array.isArray(students) ? students : [];
  if (!state.linkedStudents.length) {
    state.activeStudent = null;
    state.currentProgram = null;
    state.currentSchedule = null;
    state.currentInbox = null;
    state.currentMissedSessions = [];
    state.parentRequests = [];
    renderModeUi();
    renderViewerSelector();
    renderProfile();
    renderAccountCard();
    renderProgram(null);
    renderWeeklyTable(null);
    renderProgress(null);
    renderNotices(null, null);
    renderDetails();
    renderGame(null);
    setMessage('Aucun eleve actif n est encore relie a ce compte parent.', 'info');
    return;
  }

  const defaultStudent = state.linkedStudents[0];
  await loadParentStudent(defaultStudent.uid);
}

async function loadDashboardData() {
  try {
    setupPageTransition();
    const { data } = await getJSON('/api/auth/me');
    state.authUser = data;
    state.role = data.role;

    if (state.role === 'parent') {
      await loadParentMode();
    } else {
      await loadStudentMode();
    }
  } catch (_error) {
    redirectToLogin();
  }
}

generateBtn.addEventListener('click', async () => {
  if (state.role !== 'student' || !state.studentProfile) return;

  try {
    setMessage('Generation du planning en cours...', 'info');
    const payload = {
      classCode: state.studentProfile.classCode,
      preferredStudyMoments: state.studentProfile.preferences?.preferredStudyMoments?.length
        ? state.studentProfile.preferences.preferredStudyMoments
        : ['soir'],
      maxSessionsPerDay: state.studentProfile.preferences?.maxSessionsPerDay || 3,
      maxHoursPerWeek: state.studentProfile.preferences?.maxHoursPerWeek || 18,
      examMode: state.studentProfile.preferences?.examMode || false
    };

    await postJSON('/api/schedules/generate', payload);
    await loadStudentMode(true);
    setMessage('Planning regenere avec succes.', 'success');
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      redirectToLogin();
      return;
    }
    setMessage(error?.message || 'Impossible de generer le planning.', 'error');
  }
});

downloadPdfBtn.addEventListener('click', exportSchedulePdf);

studentSelector.addEventListener('change', async () => {
  if (!studentSelector.value) return;
  try {
    await loadParentStudent(studentSelector.value);
  } catch (error) {
    setMessage(error?.message || 'Impossible de charger cet eleve.', 'error');
  }
});

accountCard.addEventListener('submit', async (event) => {
  event.preventDefault();
  const target = event.target;

  try {
    if (target.id === 'parentLinkForm') {
      await sendParentLinkRequestFromDashboard();
      setMessage('Demande de liaison envoyee a l eleve.', 'success');
      return;
    }

    if (target.id === 'parentContactForm') {
      await saveParentContactFromDashboard();
      setMessage('Telegram parent mis a jour.', 'success');
      return;
    }

    if (target.id === 'studentContactForm') {
      await saveStudentContactFromDashboard();
      setMessage('Telegram eleve mis a jour.', 'success');
    }
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      redirectToLogin();
      return;
    }
    setMessage(error?.message || 'Impossible d enregistrer cette liaison.', 'error');
  }
});

accountCard.addEventListener('click', async (event) => {
  const button = event.target?.closest('button');
  if (!button) return;

  const linkId = button?.dataset.parentLink;
  const decision = button?.dataset.parentDecision;
  if (!linkId || !decision) return;

  try {
    await respondToParentRequest(linkId, decision);
    setMessage(decision === 'approve' ? 'Liaison parent confirmee.' : 'Demande parent refusee.', 'success');
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      redirectToLogin();
      return;
    }
    setMessage(error?.message || 'Impossible de traiter la demande parent.', 'error');
  }
});

noticePanel.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || target.tagName !== 'BUTTON') return;
  const notificationId = target.dataset.notiId;
  const response = target.dataset.notiResponse;
  if (!notificationId || !response) return;
  respondToNotification(notificationId, response);
});

logoutBtn.addEventListener('click', async () => {
  try {
    await postJSON('/api/auth/logout', {});
  } finally {
    clearToken();
    window.location.href = '/pages/login.html';
  }
});

loadDashboardData();
