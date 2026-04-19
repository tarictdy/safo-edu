function normalizeMatricule(matricule) {
  if (!matricule) return '';
  return String(matricule).trim().toUpperCase().replace(/\s+/g, '');
}

module.exports = { normalizeMatricule };
