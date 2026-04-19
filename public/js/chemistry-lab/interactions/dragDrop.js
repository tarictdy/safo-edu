import { clamp } from '../data/localDefaults.js';
import { addItemFromCatalog, bringItemToFront, moveItem } from '../engine/sandboxEngine.js';
import { getState } from '../state/labStore.js';
import { selectItem } from '../state/selectionStore.js';

let activeDrag = null;

function getBoardPoint(event, boardRoot, itemDimensions = { width: 0, height: 0 }) {
  const boardRect = boardRoot.getBoundingClientRect();
  const x = clamp(event.clientX - boardRect.left - itemDimensions.width / 2, 0, boardRect.width - itemDimensions.width);
  const y = clamp(event.clientY - boardRect.top - itemDimensions.height / 2, 0, boardRect.height - itemDimensions.height);
  return { x, y };
}

function getDragOffsetPoint(event, boardRoot, dragState) {
  const boardRect = boardRoot.getBoundingClientRect();
  const x = clamp(event.clientX - boardRect.left - dragState.offsetX, 0, boardRect.width - dragState.width);
  const y = clamp(event.clientY - boardRect.top - dragState.offsetY, 0, boardRect.height - dragState.height);
  return { x, y };
}

export function initDragDrop({ catalogRoot, boardRoot }) {
  catalogRoot.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-catalog-id]');
    if (!card) return;

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', card.dataset.catalogId);
  });

  boardRoot.addEventListener('dragover', (event) => {
    event.preventDefault();
    boardRoot.classList.add('is-dropping');
  });

  boardRoot.addEventListener('dragleave', () => {
    boardRoot.classList.remove('is-dropping');
  });

  boardRoot.addEventListener('drop', (event) => {
    event.preventDefault();
    boardRoot.classList.remove('is-dropping');
    const catalogId = event.dataTransfer.getData('text/plain');
    if (!catalogId) return;
    addItemFromCatalog(catalogId, getBoardPoint(event, boardRoot));
  });

  boardRoot.addEventListener('pointerdown', (event) => {
    const itemElement = event.target.closest('.sandbox-item');
    if (!itemElement) return;
    event.preventDefault();

    const instanceId = itemElement.dataset.instanceId;
    const state = getState();
    const item = state.items.find((entry) => entry.instanceId === instanceId);
    if (!item) return;

    selectItem(instanceId);
    bringItemToFront(instanceId);

    const boardRect = boardRoot.getBoundingClientRect();
    activeDrag = {
      instanceId,
      width: item.width,
      height: item.height,
      offsetX: event.clientX - boardRect.left - item.x,
      offsetY: event.clientY - boardRect.top - item.y
    };
  });

  window.addEventListener('pointermove', (event) => {
    if (!activeDrag) return;

    const { x, y } = getDragOffsetPoint(event, boardRoot, activeDrag);
    const itemElement = boardRoot.querySelector(`[data-instance-id="${activeDrag.instanceId}"]`);
    if (itemElement) {
      itemElement.style.left = `${x}px`;
      itemElement.style.top = `${y}px`;
    }
  });

  window.addEventListener('pointerup', (event) => {
    if (!activeDrag) return;
    moveItem(activeDrag.instanceId, getDragOffsetPoint(event, boardRoot, activeDrag));
    activeDrag = null;
  });
}
