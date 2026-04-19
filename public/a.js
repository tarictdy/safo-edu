/* ============================= */
/* ===== CONSTANTES GLOBALES === */
/* ============================= */

const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const horaires = [
  "07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "18h", "19h", "20h", "21h", "22h", "23h"
];

const coeffs = {
  "6e": { "Français": 3, "Math": 3, "Histoire": 2, "Geo": 2, "Anglais": 2, "SVT": 2 },
  "5e": { "Français": 3, "Math": 3, "Histoire": 2, "Geo": 2, "Anglais": 2, "SVT": 2 },
  "4e": { "Français": 3, "Math": 4, "Histoire": 2, "Geo": 2, "Anglais": 2, "SVT": 2 },
  "3e": { "Français": 4, "Math": 4, "Histoire": 2, "Geo": 2, "Anglais": 2, "SVT": 2 },
  "Seconde": { "Français": 3, "Math": 4, "Physique": 3, "SVT": 3, "HG": 2, "Anglais": 2 },
  "Première A": { "Français": 5, "Anglais": 4, "Histoire": 4, "Geo": 3, "Math": 2, "Philosophie": 3 },
  "Première D": { "Math": 5, "Physique": 5, "SVT": 5, "Français": 2, "Anglais": 2, "Philosophie": 2 },
  "Première C": { "Math": 6, "Physique": 6, "SVT": 4, "Français": 2, "Anglais": 2, "Philosophie": 2 },
  "Terminale A": { "Français": 5, "Philosophie": 5, "Histoire": 4, "Geo": 3, "Anglais": 3, "Math": 2 },
  "Terminale D": { "SVT": 6, "Math": 6, "Physique": 6, "Français": 2, "Anglais": 2, "Philosophie": 2 },
  "Terminale C": { "Math": 7, "Physique": 7, "SVT": 5, "Français": 2, "Anglais": 2, "Philosophie": 2 }
};

const LIMITES = {
  maxHeuresSemaineParDefaut: 18,
  maxSessionsJour: 4,
  bonusWeekendSessions: 2,
  maxSessionsWeekend: 6,
  creneauxSommeilProteges: ["23h"],
  creneauxRevisionVeille: ["20h", "21h", "22h"]
};

const BLOCS_NON_ETUDE = ["Cours", "Repos", "Pause", "Sommeil"];

let currentCalendar = {};
let currentScores = [];
let lastConfig = null;

/* ============================= */
/* ===== OUTILS =============== */
/* ============================= */

function cssClassFromName(name) {
  return "matiere-" + name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "");
}

function keyFromName(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "_");
}

function isWeekend(jour) {
  return jour === "Samedi" || jour === "Dimanche";
}

function previousDay(jour) {
  const index = jours.indexOf(jour);
  if (index === -1) return null;
  return jours[(index - 1 + jours.length) % jours.length];
}

function isSleepProtectedSlot(jour, heure) {
  return !isWeekend(jour) && LIMITES.creneauxSommeilProteges.includes(heure);
}

function getInputValue(id, fallback = "") {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function setContainerHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function isHardSubject(matiere, seuil = 4) {
  const record = currentScores.find((x) => x.matiere === matiere);
  return !!record && record.diff >= seuil;
}

function isStudyBlock(value) {
  return value && !BLOCS_NON_ETUDE.includes(value);
}

function saveState() {
  localStorage.setItem("puff_calendar", JSON.stringify(currentCalendar));
  localStorage.setItem("puff_last_config", JSON.stringify(lastConfig));
}

function restoreState() {
  try {
    const saved = localStorage.getItem("puff_calendar");
    if (saved) {
      const parsed = JSON.parse(saved);
      currentCalendar = parsed;
      afficherTable(parsed);
      afficherStats(parsed);
      detecterSurcharge(parsed, LIMITES.maxSessionsJour, LIMITES.maxHeuresSemaineParDefaut);
    }
  } catch (error) {
    console.warn("Impossible de restaurer le planning sauvegardé.", error);
  }
}

function getImportantSubjects(classe) {
  const entries = Object.entries(coeffs[classe] || {});
  const strict = entries.filter(([, coef]) => coef >= 4).map(([matiere]) => matiere);
  if (strict.length > 0) return strict;

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([matiere]) => matiere);
}

function getDayLimits(maxSessions) {
  const limits = {};
  jours.forEach((jour) => {
    if (isWeekend(jour)) {
      limits[jour] = Math.min(maxSessions + LIMITES.bonusWeekendSessions, LIMITES.maxSessionsWeekend);
      return;
    }
    limits[jour] = maxSessions;
  });
  return limits;
}

/* ============================= */
/* ===== ETAPE 1 ============== */
/* ============================= */

function poserQuestions() {
  const classe = getInputValue("classe");
  if (!classe || !coeffs[classe]) return;

  const matieres = Object.keys(coeffs[classe]);
  const matieresImportantes = getImportantSubjects(classe);

  let html = "<h3>2️⃣ Difficultés (1 = facile → 5 = très difficile)</h3>";

  matieres.forEach((m) => {
    html += `
    <label>${m} (coef ${coeffs[classe][m]}) :</label>
    <select id="diff_${m}">
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3" selected>3</option>
      <option value="4">4</option>
      <option value="5">5</option>
    </select>`;
  });

  html += "<h4>🎯 Jour des matières importantes (pour révision la veille)</h4>";
  matieresImportantes.forEach((matiere) => {
    const fieldId = `jour_${keyFromName(matiere)}`;
    html += `<label>${matiere} :</label><select id="${fieldId}"><option value="">Non précisé</option>`;
    jours.forEach((j) => {
      html += `<option value="${j}">${j}</option>`;
    });
    html += "</select>";
  });

  html += `
  <h4>Préférences ciblées (max 2)</h4>
  <label><input type="checkbox" value="matin" class="pref"> Matin</label>
  <label><input type="checkbox" value="apresmidi" class="pref"> Après-midi</label>
  <label><input type="checkbox" value="soir" class="pref"> Soir</label>

  <label>Max sessions / jour (semaine) :</label>
  <select id="maxSessions">
    <option>2</option>
    <option selected>3</option>
    <option>4</option>
  </select>
  <small>Le week-end est automatiquement renforcé pour étudier plus.</small>

  <label>Limite heures / semaine :</label>
  <input id="maxHeuresSemaine" type="number" min="8" max="35" value="18">

  <label><input type="checkbox" id="examMode"> Mode examens proches</label>

  <button onclick="afficherEmploiScolaire()">3️⃣ Saisir emploi scolaire</button>
  `;

  setContainerHtml("questionsContainer", html);
}

/* ============================= */
/* ===== ETAPE 2 ============== */
/* ============================= */

function afficherEmploiScolaire() {
  let html = "<h3>3️⃣ Cours fixes</h3><table><tr><th>Heure/Jour</th>";
  jours.forEach((j) => (html += `<th>${j}</th>`));
  html += "</tr>";

  horaires.forEach((h) => {
    html += `<tr><td>${h}</td>`;
    jours.forEach((j) => {
      html += `<td><input type="checkbox" data-jour="${j}" data-heure="${h}"></td>`;
    });
    html += "</tr>";
  });

  html += "</table><button onclick='genererEmploiPersonnel()'>4️⃣ Générer emploi personnel</button>";
  setContainerHtml("edtScolaireContainer", html);
}

/* ============================= */
/* ===== GENERATION =========== */
/* ============================= */

function initializeCalendar() {
  const calendar = {};
  jours.forEach((j) => {
    calendar[j] = {};
    horaires.forEach((h) => {
      calendar[j][h] = isSleepProtectedSlot(j, h) ? "Sommeil" : null;
    });
  });
  return calendar;
}

function computeSubjectScores(classe, examMode) {
  const matieres = Object.keys(coeffs[classe]);
  return matieres.map((m) => {
    const diff = parseInt(getInputValue("diff_" + m, "3"), 10);
    const coef = coeffs[classe][m];
    const examBoost = examMode && coef >= 4 ? 1.25 : 1;
    return { matiere: m, score: diff * coef * examBoost, coef, diff };
  });
}

function readImportantSubjectsDays(classe) {
  const map = {};
  const matieresImportantes = getImportantSubjects(classe);
  matieresImportantes.forEach((matiere) => {
    const value = getInputValue(`jour_${keyFromName(matiere)}`);
    if (value && jours.includes(value)) {
      map[matiere] = value;
    }
  });
  return map;
}

function listFreeSlots(calendar, prefs) {
  const freeSlots = [];

  jours.forEach((j) => {
    horaires.forEach((h, i) => {
      if (calendar[j][h]) return;

      if (prefs.length === 0) {
        freeSlots.push({ jour: j, heure: h, index: i });
        return;
      }

      const isMorning = i <= 4;
      const isAfternoon = i >= 5 && i <= 9;
      const isEvening = i >= 10;
      if (
        (prefs.includes("matin") && isMorning) ||
        (prefs.includes("apresmidi") && isAfternoon) ||
        (prefs.includes("soir") && isEvening)
      ) {
        freeSlots.push({ jour: j, heure: h, index: i });
      }
    });
  });

  return freeSlots.sort((a, b) => {
    if (isWeekend(a.jour) && !isWeekend(b.jour)) return -1;
    if (!isWeekend(a.jour) && isWeekend(b.jour)) return 1;
    return horaires.indexOf(b.heure) - horaires.indexOf(a.heure);
  });
}

function buildWeightedPool(scores, maxSlotsByWeekLimit) {
  const totalScore = scores.reduce((a, b) => a + b.score, 0);
  const pool = [];

  scores.forEach((s) => {
    const count = Math.max(1, Math.round((s.score / totalScore) * maxSlotsByWeekLimit));
    for (let i = 0; i < count; i++) pool.push(s.matiere);
  });

  return pool;
}

function applySpacedRevisionPlan(pool, scores) {
  const topSubjects = [...scores].sort((a, b) => b.score - a.score).slice(0, 2).map((s) => s.matiere);
  topSubjects.forEach((matiere) => {
    pool.push(matiere, matiere, matiere);
  });
}

function applyFixedCourses(calendar) {
  document.querySelectorAll("input[data-jour]").forEach((chk) => {
    if (chk.checked && !isSleepProtectedSlot(chk.dataset.jour, chk.dataset.heure)) {
      calendar[chk.dataset.jour][chk.dataset.heure] = "Cours";
    }
  });
}

function applyDayBeforeRevisions(calendar, importantDays, sessionsDay, dayLimits, maxSlotsByWeekLimit) {
  let placed = 0;

  Object.entries(importantDays).forEach(([matiere, jourCours]) => {
    if (placed >= maxSlotsByWeekLimit) return;

    const jourVeille = previousDay(jourCours);
    if (!jourVeille) return;

    LIMITES.creneauxRevisionVeille.forEach((heure) => {
      if (placed >= maxSlotsByWeekLimit) return;
      if (calendar[jourVeille][heure]) return;
      if ((sessionsDay[jourVeille] || 0) >= dayLimits[jourVeille]) return;

      calendar[jourVeille][heure] = `Révision ${matiere}`;
      sessionsDay[jourVeille] = (sessionsDay[jourVeille] || 0) + 1;
      placed += 1;
    });
  });

  return placed;
}

function pickNextSubject(pool, prevSubject) {
  let chosenIndex = pool.findIndex((m) => !(isHardSubject(m) && isHardSubject(prevSubject)));
  if (chosenIndex === -1) chosenIndex = 0;
  return pool.splice(chosenIndex, 1)[0];
}

function shouldForceBreak(prevSubject, prevPrevSubject) {
  return isStudyBlock(prevSubject) && isStudyBlock(prevPrevSubject);
}

function genererEmploiPersonnel() {
  const classe = getInputValue("classe");
  if (!classe || !coeffs[classe]) return;

  const maxSessions = Math.min(parseInt(getInputValue("maxSessions", "3"), 10), LIMITES.maxSessionsJour);
  const maxHeuresSemaine = parseInt(getInputValue("maxHeuresSemaine", String(LIMITES.maxHeuresSemaineParDefaut)), 10) || LIMITES.maxHeuresSemaineParDefaut;
  const examMode = !!document.getElementById("examMode")?.checked;

  let prefs = Array.from(document.querySelectorAll(".pref:checked")).map((e) => e.value);
  if (prefs.length > 2) prefs = prefs.slice(0, 2);

  const dayLimits = getDayLimits(maxSessions);
  const calendar = initializeCalendar();
  applyFixedCourses(calendar);

  const scores = computeSubjectScores(classe, examMode);
  const importantDays = readImportantSubjectsDays(classe);
  currentScores = scores;

  const freeSlots = listFreeSlots(calendar, prefs);
  const maxSlotsByWeekLimit = Math.min(maxHeuresSemaine, freeSlots.length);

  let pool = buildWeightedPool(scores, maxSlotsByWeekLimit);
  applySpacedRevisionPlan(pool, scores);
  pool = pool.sort(() => Math.random() - 0.5);

  const sessionsDay = {};
  jours.forEach((j) => (sessionsDay[j] = 0));

  let totalPlaced = applyDayBeforeRevisions(calendar, importantDays, sessionsDay, dayLimits, maxSlotsByWeekLimit);

  freeSlots.forEach((slot) => {
    if (pool.length === 0 || totalPlaced >= maxSlotsByWeekLimit) return;
    if (calendar[slot.jour][slot.heure]) return;

    if (sessionsDay[slot.jour] >= dayLimits[slot.jour]) {
      calendar[slot.jour][slot.heure] = "Repos";
      return;
    }

    const previousHour = horaires[Math.max(0, slot.index - 1)];
    const prevPrevHour = horaires[Math.max(0, slot.index - 2)];
    const prevSubject = calendar[slot.jour][previousHour];
    const prevPrevSubject = calendar[slot.jour][prevPrevHour];

    if (shouldForceBreak(prevSubject, prevPrevSubject)) {
      calendar[slot.jour][slot.heure] = "Pause";
      return;
    }

    const matiere = pickNextSubject(pool, prevSubject);
    calendar[slot.jour][slot.heure] = matiere;
    sessionsDay[slot.jour] += 1;
    totalPlaced += 1;
  });

  jours.forEach((j) => {
    horaires.forEach((h) => {
      if (!calendar[j][h]) calendar[j][h] = "Repos";
    });
  });

  currentCalendar = calendar;
  lastConfig = { classe, maxSessions, maxHeuresSemaine, examMode, prefs, importantDays };
  saveState();

  afficherTable(calendar);
  afficherStats(calendar);
  detecterSurcharge(calendar, maxSessions, maxHeuresSemaine, dayLimits);
  afficherBadgeMotivation(calendar, maxSessions, maxHeuresSemaine);
}

function detecterSurcharge(calendar, maxSessions, maxHeuresSemaine, dayLimits = null) {
  let totalStudy = 0;
  const details = [];

  jours.forEach((j) => {
    let count = 0;
    horaires.forEach((h) => {
      const v = calendar[j][h];
      if (isStudyBlock(v)) {
        count += 1;
        totalStudy += 1;
      }
    });

    const maxJour = dayLimits ? dayLimits[j] : maxSessions;
    if (count > maxJour) {
      details.push(`${j}: ${count} sessions`);
    }
  });

  const warnings = [];
  if (totalStudy > maxHeuresSemaine) {
    warnings.push(`⚠️ Surcharge hebdomadaire (${totalStudy}h > ${maxHeuresSemaine}h).`);
  }
  if (details.length > 0) {
    warnings.push(`⚠️ Journée(s) au-dessus du max quotidien (${details.join(", ")}).`);
  }

  setContainerHtml("alertContainer", warnings.length ? warnings.join("<br>") : "✅ Charge de travail équilibrée.");
}

/* ============================= */
/* ===== AFFICHAGE ============ */
/* ============================= */

function afficherTable(calendar) {
  let html = "<h3>📅 Emploi du temps personnel</h3>";
  html += "<table><tr><th>Heure/Jour</th>";
  jours.forEach((j) => (html += `<th>${j}</th>`));
  html += "</tr>";

  horaires.forEach((h) => {
    html += `<tr><td>${h}</td>`;
    jours.forEach((j) => {
      const val = calendar[j][h];
      if (val === "Cours") {
        html += "<td class='coursFixe'>Cours</td>";
      } else if (["Repos", "Pause", "Sommeil"].includes(val)) {
        html += `<td class='reposFixe'>${val}</td>`;
      } else {
        html += `<td class="${cssClassFromName(val)}">${val}</td>`;
      }
    });
    html += "</tr>";
  });

  html += "</table>";
  html += "<button onclick='optimiserEncore()'>🔁 Optimiser encore</button>";
  setContainerHtml("edtPersonnelContainer", html);
}

function afficherStats(calendar) {
  const stats = {};

  jours.forEach((j) => {
    horaires.forEach((h) => {
      const v = calendar[j][h];
      if (isStudyBlock(v)) stats[v] = (stats[v] || 0) + 1;
    });
  });

  const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1;
  let html = "<h3>📈 Statistiques temps par matière</h3>";

  Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([matiere, n]) => {
    const pct = Math.round((n / total) * 100);
    html += `
      <div style="margin:6px 0;">
        <strong>${matiere}</strong> — ${n}h
        <div style="background:#eee;height:12px;border-radius:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#3b82f6;"></div>
        </div>
      </div>`;
  });

  setContainerHtml("statsContainer", html);
}

function afficherBadgeMotivation(calendar, maxSessions, maxHeuresSemaine) {
  let totalStudy = 0;
  let joursEquilibres = 0;

  jours.forEach((j) => {
    let count = 0;
    horaires.forEach((h) => {
      if (isStudyBlock(calendar[j][h])) {
        count += 1;
        totalStudy += 1;
      }
    });
    if (count > 0 && count <= (isWeekend(j) ? LIMITES.maxSessionsWeekend : maxSessions)) joursEquilibres += 1;
  });

  let badge = "🥉 Lancement";
  if (joursEquilibres >= 5 && totalStudy <= maxHeuresSemaine) badge = "🥈 Régularité";
  if (joursEquilibres >= 6 && totalStudy <= maxHeuresSemaine) badge = "🥇 Discipline";

  setContainerHtml("motivationContainer", `<h3>🏆 Motivation</h3><p>Badge obtenu : <strong>${badge}</strong></p>`);
}

function optimiserEncore() {
  genererEmploiPersonnel();
}

/* ============================= */
/* ===== PDF ================== */
/* ============================= */

function telechargerPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");
  const source = document.getElementById("edtPersonnelContainer");

  doc.html(source, {
    callback: function (pdfDoc) {
      pdfDoc.save("emploi_du_temps_puff.pdf");
    },
    x: 20,
    y: 20,
    width: 760
  });
}

restoreState();
