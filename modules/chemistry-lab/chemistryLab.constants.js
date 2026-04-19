const path = require('path');

const CHEMISTRY_LAB_ROOT = path.join(__dirname, '..', '..', 'storage', 'chemistry-lab');
const MANIFESTS_ROOT = path.join(CHEMISTRY_LAB_ROOT, 'manifests');
const SVG_ROOT = path.join(CHEMISTRY_LAB_ROOT, 'svg');
const STATIC_SVG_PREFIX = '/storage/chemistry-lab/svg';

const ITEM_TYPES = ['glassware', 'instrument', 'equipment'];
const CONTAINER_SUB_TYPES = ['container'];
const REACTION_CONDITIONS = ['mixed', 'heated', 'stirred', 'poured', 'rest', 'current_applied', 'circuit_closed', 'air_contact'];
const ACTION_IDS = ['add-chemical', 'add_chemical', 'stir', 'tilt', 'pour', 'heat', 'empty', 'rotate', 'inspect', 'attach_to_support'];

function createError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

module.exports = {
  ACTION_IDS,
  CHEMISTRY_LAB_ROOT,
  CONTAINER_SUB_TYPES,
  ITEM_TYPES,
  MANIFESTS_ROOT,
  REACTION_CONDITIONS,
  STATIC_SVG_PREFIX,
  SVG_ROOT,
  createError
};
