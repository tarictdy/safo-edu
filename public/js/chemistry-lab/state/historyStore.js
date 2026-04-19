import { uid } from '../data/localDefaults.js';
import { updateState } from './labStore.js';

export function addJournalEntry(message, kind = 'info') {
  updateState((draft) => {
    draft.history.unshift({
      id: uid('journal'),
      kind,
      message,
      time: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    });
    draft.history = draft.history.slice(0, 50);
    return draft;
  });
}
