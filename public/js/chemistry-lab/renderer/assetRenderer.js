const assetCache = new Map();

async function loadAssetText(assetUrl) {
  if (!assetCache.has(assetUrl)) {
    assetCache.set(assetUrl, fetch(assetUrl).then((response) => {
      if (!response.ok) {
        throw new Error(`Impossible de charger ${assetUrl}`);
      }
      return response.text();
    }));
  }

  return assetCache.get(assetUrl);
}

export async function mountSvgAsset(container, assetUrl) {
  const svgText = await loadAssetText(assetUrl);
  const documentSvg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  documentSvg.classList.add('lab-svg');
  container.replaceChildren(documentSvg);
  return documentSvg;
}
