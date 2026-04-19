import { getCatalogItem } from '../engine/ruleEngine.js';
import { mountSvgAsset } from './assetRenderer.js';
import { renderEffects } from './effectRenderer.js';
import { renderLiquid } from './liquidRenderer.js';

let boardRoot = null;

export function initSandboxRenderer(root) {
  boardRoot = root;
}

async function hydrateItemAsset(host, item, catalogItem, activeEffects = []) {
  if (!catalogItem || !host) return;
  try {
    const svgElement = await mountSvgAsset(host, catalogItem.asset);
    renderLiquid(svgElement, item, catalogItem);
    const itemEffects = activeEffects.filter((effect) => effect.targetInstanceId === item.instanceId || effect.itemId === item.instanceId);
    renderEffects(svgElement, item, itemEffects);
  } catch (_error) {
    host.innerHTML = '<div class="status-banner is-error">Asset indisponible.</div>';
  }
}

export function renderSandbox(state) {
  if (!boardRoot) return;

  boardRoot.replaceChildren();

  if (!state.items.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'sandbox-empty';
    emptyState.innerHTML = '<div><strong>Sandbox vide</strong><br/>Glisse un recipient, un instrument ou charge un preset.</div>';
    boardRoot.appendChild(emptyState);
    return;
  }

  state.items.forEach((item) => {
    const catalogItem = getCatalogItem(item.catalogId, state);
    const shell = document.createElement('article');
    shell.className = [
      'sandbox-item',
      state.selectedItemId === item.instanceId ? 'is-selected' : '',
      item.state.isHeated ? 'is-heated' : '',
      item.ui.animation ? `anim-${item.ui.animation}` : ''
    ].filter(Boolean).join(' ');

    shell.dataset.instanceId = item.instanceId;
    shell.style.left = `${item.x}px`;
    shell.style.top = `${item.y}px`;
    shell.style.width = `${item.width}px`;
    shell.style.height = `${item.height}px`;
    shell.style.zIndex = String(item.zIndex || 1);
    shell.style.transform = `rotate(${item.rotation || 0}deg)`;

    const assetHost = document.createElement('div');
    assetHost.className = 'sandbox-item__asset';
    shell.appendChild(assetHost);

    const label = document.createElement('div');
    label.className = 'sandbox-item__label';
    label.textContent = catalogItem?.name || item.catalogId;
    shell.appendChild(label);

    boardRoot.appendChild(shell);
    hydrateItemAsset(assetHost, item, catalogItem, state.activeEffects || []);
  });
}
