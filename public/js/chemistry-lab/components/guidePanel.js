import { deactivateGuide } from '../engine/GuideEngine.js';

let rootElement = null;

function renderMaterials(title, entries = []) {
  if (!entries.length) return '';
  return `
    <div class="guide-material-group">
      <span class="guide-material-group__title">${title}</span>
      <div class="chip-list">
        ${entries.map((entry) => `<span class="catalog-card__tag">${entry}</span>`).join('')}
      </div>
    </div>
  `;
}

export function initGuidePanel(root) {
  rootElement = root;

  rootElement.addEventListener('click', (event) => {
    const stopButton = event.target.closest('[data-guide-stop]');
    if (!stopButton) return;
    deactivateGuide(true);
  });
}

export function renderGuidePanel(state) {
  if (!rootElement) return;

  const guide = state.guide;
  if (!guide?.enabled) {
    rootElement.innerHTML = `
      <div class="panel-card guide-card">
        <h3>Guide d experience</h3>
        <p class="panel-copy">Choisis une experience puis clique sur <strong>Appliquer le guide</strong> pour charger le montage et suivre les etapes pas a pas.</p>
      </div>
    `;
    return;
  }

  const currentStep = guide.steps.find((step) => step.status === 'active') || null;
  const progressPercent = guide.totalCount ? Math.round((guide.completedCount / guide.totalCount) * 100) : 0;

  rootElement.innerHTML = `
    <div class="panel-card guide-card">
      <div class="guide-card__head">
        <div>
          <h3>Guide actif</h3>
          <p class="guide-summary">${guide.title}</p>
        </div>
        <button type="button" class="lab-btn" data-guide-stop="true">Arreter</button>
      </div>
      <p class="panel-copy">${guide.objective || 'Experience guidee en cours.'}</p>
      <div class="guide-progress">
        <div class="guide-progress__meta">
          <span>${guide.completedCount}/${guide.totalCount} etapes</span>
          <span>${guide.isComplete ? 'Termine' : `${progressPercent}%`}</span>
        </div>
        <div class="guide-progress__bar">
          <span style="width:${progressPercent}%;"></span>
        </div>
      </div>
      <div class="guide-summary-grid">
        <div><strong>Securite</strong><span>${guide.safetyLevel || 'non renseigne'}</span></div>
        <div><strong>Etape en cours</strong><span>${currentStep?.title || 'Observation finale atteinte'}</span></div>
      </div>
      ${renderMaterials('Materiel', guide.materials?.objects || [])}
      ${renderMaterials('Produits', guide.materials?.chemicals || [])}
      ${guide.teacherNarration ? `<p class="guide-teacher-note">${guide.teacherNarration}</p>` : ''}
      <div class="guide-steps">
        ${guide.steps.map((step, index) => `
          <div class="guide-step ${step.status === 'active' ? 'is-active' : ''} ${step.status === 'completed' ? 'is-completed' : ''}">
            <span class="guide-step__badge">${index + 1}</span>
            <div class="guide-step__body">
              <div class="guide-step__head">
                <strong>${step.title}</strong>
                <span class="guide-step__status">${step.status === 'completed' ? 'fait' : step.status === 'active' ? 'en cours' : 'a venir'}</span>
              </div>
              <p>${step.description}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
