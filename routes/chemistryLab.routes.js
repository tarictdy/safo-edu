const express = require('express');
const {
  actions,
  assetManifest,
  catalog,
  chemicals,
  constraints,
  curriculum,
  equipment,
  effectProfiles,
  evaluateSandboxReaction,
  experiments,
  instruments,
  loadSandboxPreset,
  presets,
  reactionProfiles,
  reactions,
  validateSandboxAction
} = require('../controllers/chemistryLab.controller');

const router = express.Router();

router.get('/catalog', catalog);
router.get('/instruments', instruments);
router.get('/chemicals', chemicals);
router.get('/equipment', equipment);
router.get('/presets', presets);
router.get('/reactions', reactions);
router.get('/curriculum', curriculum);
router.get('/experiments', experiments);
router.get('/reaction-profiles', reactionProfiles);
router.get('/effect-profiles', effectProfiles);
router.get('/constraints', constraints);
router.get('/actions', actions);
router.get('/assets/manifest', assetManifest);

router.post('/sandbox/validate-action', validateSandboxAction);
router.post('/sandbox/evaluate-reaction', evaluateSandboxReaction);
router.post('/sandbox/load-preset', loadSandboxPreset);

module.exports = router;
