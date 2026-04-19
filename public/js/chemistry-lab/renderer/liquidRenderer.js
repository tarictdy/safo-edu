const SVG_NS = 'http://www.w3.org/2000/svg';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(color) {
  const normalized = String(color || '#99d7ff').replace('#', '').trim();
  const compact = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.padEnd(6, normalized[normalized.length - 1] || '0').slice(0, 6);

  return {
    r: Number.parseInt(compact.slice(0, 2), 16),
    g: Number.parseInt(compact.slice(2, 4), 16),
    b: Number.parseInt(compact.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColors(source, target, amount = 0.5) {
  const from = hexToRgb(source);
  const to = hexToRgb(target);
  const ratio = clamp(amount, 0, 1);

  return rgbToHex({
    r: from.r + ((to.r - from.r) * ratio),
    g: from.g + ((to.g - from.g) * ratio),
    b: from.b + ((to.b - from.b) * ratio)
  });
}

function withAlpha(color, alpha) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

function getZoneMetrics(zoneElement) {
  const width = Number(zoneElement.getAttribute('width'));
  const height = Number(zoneElement.getAttribute('height'));
  const x = Number(zoneElement.getAttribute('x'));
  const y = Number(zoneElement.getAttribute('y'));
  const rx = Number(zoneElement.getAttribute('rx') || 0);

  if ([x, y, width, height].every((value) => Number.isFinite(value))) {
    return { x, y, width, height, rx };
  }

  const bbox = zoneElement.getBBox();
  return {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    rx
  };
}

function ensureRenderLayer(svgElement, layerName) {
  let layer = svgElement.querySelector(`[data-render-layer="${layerName}"]`);
  if (!layer) {
    layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('data-render-layer', layerName);
    svgElement.appendChild(layer);
  }
  return layer;
}

function buildSurfaceRipple(zone, fillY, meniscusCurve, widthRatio, tone, className) {
  const inset = zone.width * 0.1;
  const waveWidth = zone.width - (inset * 2);
  const startX = zone.x + inset;
  const endX = startX + waveWidth;
  const controlY = fillY + (meniscusCurve * widthRatio);

  return `
    <path
      class="${className}"
      d="M${startX.toFixed(2)} ${fillY.toFixed(2)}
         C${(startX + (waveWidth * 0.2)).toFixed(2)} ${(controlY + 1.4).toFixed(2)}
          ${(startX + (waveWidth * 0.45)).toFixed(2)} ${(controlY - 1.8).toFixed(2)}
          ${(startX + (waveWidth * 0.58)).toFixed(2)} ${fillY.toFixed(2)}
         C${(startX + (waveWidth * 0.72)).toFixed(2)} ${(controlY + 1.2).toFixed(2)}
          ${(startX + (waveWidth * 0.88)).toFixed(2)} ${(controlY - 1.2).toFixed(2)}
          ${endX.toFixed(2)} ${fillY.toFixed(2)}"
      stroke="${tone}"
    />
  `;
}

function buildMixStreaks(zone, fillY, fillHeight, primaryTone, secondaryTone) {
  if (fillHeight < 22) return '';

  const startX = zone.x + (zone.width * 0.12);
  const endX = zone.x + (zone.width * 0.88);
  const upperY = fillY + (fillHeight * 0.28);
  const lowerY = fillY + (fillHeight * 0.58);

  return `
    <path
      class="rendered-liquid rendered-liquid--mix"
      d="M${startX.toFixed(2)} ${upperY.toFixed(2)}
         C${(startX + zone.width * 0.2).toFixed(2)} ${(upperY - 5).toFixed(2)}
          ${(startX + zone.width * 0.45).toFixed(2)} ${(upperY + 8).toFixed(2)}
          ${endX.toFixed(2)} ${(upperY + 1).toFixed(2)}"
      stroke="${primaryTone}"
    />
    <path
      class="rendered-liquid rendered-liquid--mix is-secondary"
      d="M${(startX + 4).toFixed(2)} ${lowerY.toFixed(2)}
         C${(startX + zone.width * 0.16).toFixed(2)} ${(lowerY + 6).toFixed(2)}
          ${(startX + zone.width * 0.42).toFixed(2)} ${(lowerY - 6).toFixed(2)}
          ${(endX - 6).toFixed(2)} ${(lowerY + 2).toFixed(2)}"
      stroke="${secondaryTone}"
    />
  `;
}

export function renderLiquid(svgElement, item, catalogItem) {
  const liquidZone = svgElement.querySelector('[data-zone="liquid-zone"]');
  if (!liquidZone) return;

  const contents = Array.isArray(item?.state?.contents) ? item.state.contents : [];
  const totalVolume = contents.reduce((sum, entry) => sum + Number(entry.volumeMl || 0), 0);
  const layer = ensureRenderLayer(svgElement, 'liquid');

  if (!totalVolume) {
    layer.innerHTML = '';
    return;
  }

  const zone = getZoneMetrics(liquidZone);
  const capacity = Number(catalogItem.capacityMl || totalVolume || 1);
  const visual = item.state?.visual || {};
  const storedFillLevel = Number(visual.fillLevel || 0);
  const ratio = clamp(storedFillLevel || (totalVolume / capacity), 0.08, 1);
  const fillHeight = zone.height * ratio;
  const fillY = zone.y + zone.height - fillHeight;
  const opacity = Number(visual.liquidOpacity || 0.82);
  const meniscusCurve = clamp(Number(visual.meniscusCurve || zone.rx || 6), 4, 14);
  const heatIntensity = clamp(Number(visual.heatIntensity || 0), 0, 1);
  const viscosity = clamp(Number(visual.viscosity || 0.22), 0, 1);
  const baseColor = visual.liquidColor || '#99d7ff';
  const topColor = mixColors(baseColor, '#f7fdff', 0.46 - (heatIntensity * 0.06));
  const midColor = mixColors(baseColor, '#d1f4ff', 0.18);
  const bottomColor = mixColors(baseColor, '#14354a', 0.34 + (viscosity * 0.12));
  const highlightColor = mixColors(baseColor, '#ffffff', 0.86);
  const highlightTone = withAlpha(highlightColor, 0.5);
  const shadowTone = withAlpha(mixColors(baseColor, '#04131d', 0.7), 0.24);
  const warmColor = mixColors(baseColor, '#ffba66', 0.48);
  const warmTone = withAlpha(warmColor, 0.18 + (heatIntensity * 0.22));
  const mixPrimary = withAlpha(mixColors(baseColor, '#ffffff', 0.68), 0.28);
  const mixSecondary = withAlpha(mixColors(baseColor, '#90d9ff', 0.42), 0.22);

  const clipId = `liquid-clip-${item.instanceId}`;
  const gradientId = `liquid-gradient-${item.instanceId}`;
  const highlightId = `liquid-highlight-${item.instanceId}`;
  const warmId = `liquid-warm-${item.instanceId}`;
  const innerX = zone.x + (zone.width * 0.06);
  const innerWidth = zone.width * 0.88;
  const shineHeight = Math.max(12, fillHeight * 0.42);
  const shadowHeight = Math.max(12, fillHeight * 0.34);
  const mixMarkup = visual.mixingState && visual.mixingState !== 'empty'
    ? buildMixStreaks(zone, fillY, fillHeight, mixPrimary, mixSecondary)
    : '';
  const surfaceMarkup = `
    ${buildSurfaceRipple(zone, fillY + 1.4, meniscusCurve * 0.4, 0.42, highlightTone, 'rendered-liquid rendered-liquid--surface')}
    ${buildSurfaceRipple(zone, fillY + 4.8, meniscusCurve * 0.55, 0.68, shadowTone, 'rendered-liquid rendered-liquid--surface-shadow')}
  `;

  layer.innerHTML = `
    <defs>
      <clipPath id="${clipId}">
        ${liquidZone.outerHTML}
      </clipPath>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${topColor}" />
        <stop offset="38%" stop-color="${midColor}" />
        <stop offset="100%" stop-color="${bottomColor}" />
      </linearGradient>
      <linearGradient id="${highlightId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${highlightColor}" stop-opacity="0.5" />
        <stop offset="100%" stop-color="${highlightColor}" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="${warmId}" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${warmColor}" stop-opacity="0" />
        <stop offset="100%" stop-color="${warmColor}" stop-opacity="${(0.18 + (heatIntensity * 0.22)).toFixed(2)}" />
      </linearGradient>
    </defs>
    <g clip-path="url(#${clipId})">
      <rect
        class="rendered-liquid rendered-liquid--body"
        x="${zone.x}"
        y="${fillY}"
        width="${zone.width}"
        height="${fillHeight}"
        rx="${meniscusCurve}"
        fill="url(#${gradientId})"
        opacity="${opacity}"
      ></rect>
      <rect
        class="rendered-liquid rendered-liquid--shine"
        x="${innerX}"
        y="${fillY + 2}"
        width="${innerWidth}"
        height="${shineHeight}"
        rx="${meniscusCurve}"
        fill="url(#${highlightId})"
      ></rect>
      <rect
        class="rendered-liquid rendered-liquid--shadow"
        x="${zone.x}"
        y="${fillY + Math.max(6, fillHeight - shadowHeight)}"
        width="${zone.width}"
        height="${shadowHeight}"
        rx="${meniscusCurve}"
        fill="${shadowTone}"
      ></rect>
      ${heatIntensity ? `
        <rect
          class="rendered-liquid rendered-liquid--heat"
          x="${zone.x}"
          y="${fillY}"
          width="${zone.width}"
          height="${fillHeight}"
          rx="${meniscusCurve}"
          fill="url(#${warmId})"
        ></rect>
      ` : ''}
      ${surfaceMarkup}
      ${mixMarkup}
      ${visual.precipitate ? `<path class="effect-precipitate" d="M${zone.x} ${zone.y + zone.height - 14}c${zone.width / 4} 6 ${zone.width / 2} 6 ${zone.width} 0v14H${zone.x}Z"></path>` : ''}
    </g>
  `;
}
