function renderSectionTitle(title) {
  return `<div class="journal-section-title">${title}</div>`;
}

export function renderJournal(root, historyEntries = [], diagnosticEntries = []) {
  if (!root) return;

  if (!historyEntries.length && !diagnosticEntries.length) {
    root.innerHTML = `
      <div class="panel-card">
        <h3>Journal d experience</h3>
        <p class="panel-copy">Les evenements du sandbox apparaissent ici.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="panel-card">
      <h3>Journal d experience</h3>
      <div class="journal-list">
        ${diagnosticEntries.length ? renderSectionTitle('Diagnostic moteur') : ''}
        ${diagnosticEntries.map((entry) => `
          <article class="journal-entry journal-entry--diagnostic journal-entry--${entry.level || 'error'}">
            <span class="journal-entry__time">${entry.time}</span>
            <p class="journal-entry__body"><strong>[${entry.context || 'runtime'}]</strong> ${entry.message}</p>
            ${entry.details ? `<pre class="journal-entry__details">${entry.details}</pre>` : ''}
          </article>
        `).join('')}
        ${historyEntries.length ? renderSectionTitle('Trace du labo') : ''}
        ${historyEntries.map((entry) => `
          <article class="journal-entry journal-entry--${entry.kind}">
            <span class="journal-entry__time">${entry.time}</span>
            <p class="journal-entry__body">${entry.message}</p>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}
