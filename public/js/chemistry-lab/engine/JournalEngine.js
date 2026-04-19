import { addJournalEntry } from '../state/historyStore.js';
import { getChemical, getObjectLabel, normalizeActionId } from './CatalogManager.js';

function buildActionMessage(command, validation, transformationResult, nextState) {
  const actionId = normalizeActionId(command.canonicalActionId || command.rawActionId);
  const effectiveTarget = validation.resolvedTargetItem || command.targetItem;
  const effectiveSource = validation.resolvedSourceItem || command.sourceItem || command.targetItem;
  const targetLabel = effectiveTarget ? getObjectLabel(effectiveTarget.catalogId, nextState) : '';
  const sourceLabel = effectiveSource ? getObjectLabel(effectiveSource.catalogId, nextState) : '';

  switch (actionId) {
    case 'add_chemical': {
      const chemical = command.chemical || getChemical(command.chemicalId, nextState);
      const volumeMl = Math.round(transformationResult.summary?.volumeMl || chemical?.defaultVolumeMl || 0);
      return chemical ? `${chemical.formula} ajoute dans ${targetLabel} (${volumeMl} mL).` : `Produit ajoute dans ${targetLabel}.`;
    }
    case 'stir':
      return `${targetLabel} remue.`;
    case 'tilt':
      return `${targetLabel} incline.`;
    case 'heat':
      return transformationResult.summary?.heaterToggled
        ? `Bruleur ${transformationResult.summary.flame ? 'allume' : 'eteint'}.`
        : `${targetLabel} ${transformationResult.summary?.heated ? 'chauffe' : 'revient a temperature ambiante'}.`;
    case 'pour':
      return `${sourceLabel || targetLabel} verse dans ${targetLabel || sourceLabel}.`;
    case 'empty':
      return `${targetLabel} vide.`;
    case 'rotate':
      return `${targetLabel} pivote.`;
    case 'inspect':
      return `${targetLabel} inspecte.`;
    default:
      return '';
  }
}

export function buildJournalEntries(command, validation, transformationResult, reactionOutput, nextState) {
  const entries = [];

  validation.warnings.forEach((warning) => {
    entries.push({ message: warning, kind: 'warning' });
  });

  const actionMessage = buildActionMessage(command, validation, transformationResult, nextState);
  if (actionMessage) {
    entries.push({ message: actionMessage, kind: 'info' });
  }

  (reactionOutput.results || []).forEach((result) => {
    if (result.matched) {
      (result.journalMessages || []).forEach((message) => {
        entries.push({ message, kind: 'success' });
      });
      if (result.message) {
        entries.push({ message: result.message, kind: 'success' });
      }
      return;
    }

    (result.journalMessages || []).forEach((message) => {
      entries.push({ message, kind: 'info' });
    });
  });

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function commitJournalEntries(entries = []) {
  entries.forEach((entry) => {
    if (!entry?.message) return;
    addJournalEntry(entry.message, entry.kind || 'info');
  });
}
