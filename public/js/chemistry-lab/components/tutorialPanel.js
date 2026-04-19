let rootElement = null;

export function initTutorialPanel(root) {
  rootElement = root;
}

export function renderTutorialPanel() {
  if (!rootElement) return;

  rootElement.innerHTML = `
    <div class="panel-card tutorial-card">
      <h3>Mode d emploi</h3>
      <div class="tutorial-steps">
        <div class="tutorial-step"><span>1</span><p>Choisis une experience jouable et clique sur <strong>Appliquer le guide</strong>, ou cherche un appareil si tu veux travailler en mode libre.</p></div>
        <div class="tutorial-step"><span>2</span><p>Clique sur <strong>Ajouter</strong> pour poser un appareil directement dans le bac, ou glisse-le si tu preferes.</p></div>
        <div class="tutorial-step"><span>3</span><p>Selectionne le recipient, puis ajoute les produits depuis le panneau d actions a droite.</p></div>
        <div class="tutorial-step"><span>4</span><p>Suis les etapes du guide a droite, ou utilise <strong>Remuer</strong>, <strong>Chauffer</strong> et <strong>Verser</strong> en mode libre.</p></div>
      </div>
      <p class="tutorial-tip">Astuce: tape <em>phmetre</em>, <em>voltm</em>, <em>electrode</em> ou <em>entonnoir</em> pour faire apparaitre les appareils caches. Le guide charge le montage mais te laisse faire les manipulations toi-meme.</p>
    </div>
  `;
}
