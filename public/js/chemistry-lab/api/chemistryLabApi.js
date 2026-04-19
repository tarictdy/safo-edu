import { getJSON, postJSON } from '../../utils/api.js';

export async function fetchCatalog() {
  const { data } = await getJSON('/api/chemistry-lab/catalog');
  return data;
}

export async function fetchAssetManifest() {
  const { data } = await getJSON('/api/chemistry-lab/assets/manifest');
  return data;
}

export async function validateSandboxAction(payload) {
  const { data } = await postJSON('/api/chemistry-lab/sandbox/validate-action', payload);
  return data;
}

export async function evaluateSandboxReaction(payload) {
  const { data } = await postJSON('/api/chemistry-lab/sandbox/evaluate-reaction', payload);
  return data;
}

export async function loadPresetById(presetId) {
  const { data } = await postJSON('/api/chemistry-lab/sandbox/load-preset', { presetId });
  return data;
}
