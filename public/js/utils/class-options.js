export const CLASS_OPTIONS = [
  '6e',
  '5e',
  '4e',
  '3e',
  'Seconde A',
  'Seconde B',
  'Seconde C',
  'Seconde D',
  'Seconde E',
  'Première A',
  'Première A1',
  'Première A2',
  'Première B',
  'Première C',
  'Première D',
  'Première E',
  'Terminale A',
  'Terminale A1',
  'Terminale A2',
  'Terminale B',
  'Terminale C',
  'Terminale D',
  'Terminale E'
];

export function populateClassSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML += CLASS_OPTIONS.map((value) => `<option value="${value}">${value}</option>`).join('');
}
