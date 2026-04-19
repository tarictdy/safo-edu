const fs = require('fs/promises');
const path = require('path');
const { MANIFESTS_ROOT, SVG_ROOT, STATIC_SVG_PREFIX, createError } = require('./chemistryLab.constants');

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readManifest(fileName) {
  const manifestPath = path.join(MANIFESTS_ROOT, fileName);

  try {
    return await readJsonFile(manifestPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw createError(`Manifest introuvable: ${fileName}`, 404);
    }
    throw createError(`Impossible de lire ${fileName}.`, 500, { cause: error.message });
  }
}

async function readManifestWithFallback(primaryFileName, fallbackFileName) {
  try {
    return await readManifest(primaryFileName);
  } catch (error) {
    if (error.statusCode === 404 && fallbackFileName) {
      return readManifest(fallbackFileName);
    }
    throw error;
  }
}

async function listSvgManifest() {
  const categories = await fs.readdir(SVG_ROOT, { withFileTypes: true });
  const manifest = {};

  await Promise.all(categories
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const categoryPath = path.join(SVG_ROOT, entry.name);
      const files = await fs.readdir(categoryPath, { withFileTypes: true });
      manifest[entry.name] = files
        .filter((file) => file.isFile() && file.name.endsWith('.svg'))
        .map((file) => ({
          fileName: file.name,
          asset: `${STATIC_SVG_PREFIX}/${entry.name}/${file.name}`
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
    }));

  return manifest;
}

module.exports = {
  listSvgManifest,
  readManifest,
  readManifestWithFallback
};
