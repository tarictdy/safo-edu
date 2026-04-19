const SVG_NS = 'http://www.w3.org/2000/svg';

function hasEffect(itemEffects = [], effectType) {
  return itemEffects.some((effect) => effect.effectType === effectType || effect.type === effectType);
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

function buildSurfaceDepositMarkup(item) {
  switch (item.catalogId) {
    case 'metal_strip':
      return `
        <g class="effect-surface-deposit effect-surface-deposit--strip">
          <path d="M26 48c5-4 13-5 19-4"></path>
          <path d="M26 82c7-5 13-5 19-3"></path>
          <path d="M26 118c6-4 12-4 19-2"></path>
          <path d="M26 154c7-5 13-4 19-2"></path>
        </g>
      `;
    case 'electrode_zinc':
    case 'electrode_copper':
      return `
        <g class="effect-surface-deposit effect-surface-deposit--electrode">
          <path d="M26 54c6-3 13-4 18-3"></path>
          <path d="M26 96c6-3 13-4 18-2"></path>
          <path d="M26 138c6-4 12-4 18-2"></path>
        </g>
      `;
    case 'electrode_pair':
      return `
        <g class="effect-surface-deposit effect-surface-deposit--pair">
          <path d="M41 64c4-3 8-3 12-2"></path>
          <path d="M87 78c4-3 8-3 12-2"></path>
          <path d="M41 114c4-3 8-3 12-2"></path>
          <path d="M87 128c4-3 8-3 12-2"></path>
        </g>
      `;
    default:
      return `
        <g class="effect-surface-deposit">
          <path d="M46 42c12-6 24-8 38-7 16 1 25 4 37 11"></path>
        </g>
      `;
  }
}

function buildCustomEffectMarkup(item) {
  const visuals = item.state.visual || {};

  switch (item.catalogId) {
    case 'voltmeter_simple':
      if (!visuals.meterActive) return '';
      return `
        <g class="effect-meter-live">
          <rect class="effect-meter-live__screen" x="28" y="28" width="98" height="42" rx="10"></rect>
          <text class="effect-meter-live__text" x="77" y="56" text-anchor="middle">${visuals.meterValue || '1.10 V'}</text>
          <text class="effect-meter-live__mode" x="145" y="92" text-anchor="middle">${visuals.meterMode || 'DC'}</text>
          <circle class="effect-meter-live__ring" cx="145" cy="58" r="24"></circle>
          <path class="effect-meter-live__needle" d="M145 58l14-11"></path>
          <circle class="effect-meter-live__jack effect-meter-live__jack--left" cx="62" cy="92" r="7"></circle>
          <circle class="effect-meter-live__jack effect-meter-live__jack--right" cx="126" cy="92" r="7"></circle>
        </g>
      `;
    case 'ph_meter_basic':
      if (!visuals.phMeterActive) return '';
      return `
        <g class="effect-ph-meter-live" style="--sensor-tone:${visuals.phTone || '#8dff9a'};">
          <rect class="effect-ph-meter-live__screen" x="26" y="26" width="46" height="30" rx="8"></rect>
          <text class="effect-ph-meter-live__text" x="49" y="47" text-anchor="middle">${visuals.phValue || '7.0'}</text>
          <text class="effect-ph-meter-live__unit" x="49" y="69" text-anchor="middle">pH</text>
          <path class="effect-ph-meter-live__probe" d="M50 126v82"></path>
          <circle class="effect-ph-meter-live__tip" cx="50" cy="208" r="5"></circle>
        </g>
      `;
    case 'conductivity_meter_basic':
      if (!visuals.conductivityActive) return '';
      return `
        <g class="effect-conductivity-live" style="--sensor-tone:${visuals.conductivityTone || '#76f5ff'};">
          <rect class="effect-conductivity-live__screen" x="28" y="26" width="46" height="30" rx="8"></rect>
          <text class="effect-conductivity-live__text" x="51" y="44" text-anchor="middle">${visuals.conductivityValue || '0.0'}</text>
          <text class="effect-conductivity-live__unit" x="51" y="57" text-anchor="middle">${visuals.conductivityUnit || 'mS/cm'}</text>
          <path class="effect-conductivity-live__probe" d="M51 126v82"></path>
          <circle class="effect-conductivity-live__tip" cx="51" cy="208" r="5"></circle>
        </g>
      `;
    case 'hotplate_basic':
      if (!item.state.isHeated) return '';
      return `
        <g class="effect-hotplate-live">
          <ellipse class="effect-hotplate-live__ring effect-hotplate-live__ring--outer" cx="90" cy="35" rx="42" ry="11"></ellipse>
          <ellipse class="effect-hotplate-live__ring effect-hotplate-live__ring--inner" cx="90" cy="35" rx="31" ry="7"></ellipse>
          <path class="effect-hotplate-live__haze" d="M71 14c2 6-2 10-2 15 0 4 2 6 2 10"></path>
          <path class="effect-hotplate-live__haze" d="M90 10c2 8-3 12-3 18 0 4 2 6 2 10"></path>
          <path class="effect-hotplate-live__haze" d="M109 14c2 6-2 10-2 15 0 4 2 6 2 10"></path>
        </g>
      `;
    case 'power_source':
      if (!visuals.currentPulse) return '';
      return `
        <g class="effect-current-pulse">
          <circle class="effect-current-pulse__terminal effect-current-pulse__terminal--left" cx="62" cy="112" r="7"></circle>
          <circle class="effect-current-pulse__terminal effect-current-pulse__terminal--right" cx="118" cy="112" r="7"></circle>
          <path class="effect-current-pulse__arc" d="M64 112c14-10 38-10 52 0"></path>
        </g>
      `;
    case 'salt_bridge':
      if (!visuals.ionicBridge) return '';
      return `
        <g class="effect-ionic-bridge">
          <circle class="effect-ionic-bridge__ion effect-ionic-bridge__ion--a" cx="38" cy="76" r="4"></circle>
          <circle class="effect-ionic-bridge__ion effect-ionic-bridge__ion--b" cx="76" cy="56" r="4"></circle>
          <circle class="effect-ionic-bridge__ion effect-ionic-bridge__ion--c" cx="118" cy="74" r="4"></circle>
          <path class="effect-ionic-bridge__flow" d="M30 76c18-28 36-34 50-20 12 12 20 12 30 0 13-16 27-16 42 6"></path>
        </g>
      `;
    case 'electrolysis_tank':
      if (!visuals.splitBubbles) return '';
      return `
        <g class="effect-electrolysis">
          <g class="effect-electrolysis__left">
            <circle cx="58" cy="112" r="5"></circle>
            <circle cx="54" cy="90" r="4"></circle>
            <circle cx="62" cy="72" r="3"></circle>
          </g>
          <g class="effect-electrolysis__right">
            <circle cx="122" cy="112" r="6"></circle>
            <circle cx="126" cy="90" r="5"></circle>
            <circle cx="118" cy="72" r="4"></circle>
          </g>
          <text class="effect-electrolysis__label effect-electrolysis__label--left" x="48" y="56">${visuals.anodeLabel || 'O2'}</text>
          <text class="effect-electrolysis__label effect-electrolysis__label--right" x="114" y="56">${visuals.cathodeLabel || 'H2'}</text>
          <path class="effect-electrolysis__glow" d="M50 40v90"></path>
          <path class="effect-electrolysis__glow effect-electrolysis__glow--right" d="M130 40v90"></path>
        </g>
      `;
    case 'electrode_pair':
      if (!visuals.currentFlow) return '';
      return `
        <g class="effect-electrode-current">
          <path class="effect-electrode-current__arc" d="M46 12c10-8 38-8 48 0"></path>
          <circle class="effect-electrode-current__spark effect-electrode-current__spark--left" cx="47" cy="16" r="4"></circle>
          <circle class="effect-electrode-current__spark effect-electrode-current__spark--right" cx="93" cy="16" r="4"></circle>
        </g>
      `;
    default:
      return '';
  }
}

export function renderEffects(svgElement, item, itemEffects = []) {
  const effectZone = svgElement.querySelector('[data-zone="effect-zone"]');
  if (effectZone) {
    const showBubbles = !item.state.visual.splitBubbles && (item.state.visual.bubbles || hasEffect(itemEffects, 'bubbleEmitter'));
    const showSteam = item.state.visual.steam || hasEffect(itemEffects, 'steamEmitter');
    const showSmoke = item.state.visual.smoke || hasEffect(itemEffects, 'smokeEmitter');
    const showDeposit = item.state.visual.surfaceDeposit || hasEffect(itemEffects, 'surfaceDeposit');
    const showFlash = item.state.visual.flash || hasEffect(itemEffects, 'flashReaction');
    const showExplosion = item.state.visual.explosion || hasEffect(itemEffects, 'explosionBurst');
    const showReactionFlame = item.state.visual.reactionFlame || hasEffect(itemEffects, 'flameBurst');
    const showHeatShimmer = item.state.visual.heatHaze || hasEffect(itemEffects, 'heatShimmer');

    effectZone.innerHTML = [
      showHeatShimmer ? `
        <g class="effect-heat-shimmer">
          <path d="M50 138c3-20 12-36 10-56-1-12-8-19-6-33"></path>
          <path d="M72 144c2-18 10-33 8-51-1-11-6-18-4-31"></path>
          <path d="M92 140c4-18 10-30 9-48-1-11-7-18-5-31"></path>
        </g>
      ` : '',
      showBubbles ? `
        <g class="effect-bubbles">
          <circle cx="54" cy="122" r="6"></circle>
          <circle cx="72" cy="98" r="5"></circle>
          <circle cx="88" cy="78" r="4"></circle>
        </g>
      ` : '',
      showSteam ? `
        <g class="effect-steam">
          <path d="M52 48c0-12 10-14 10-24 0-8-8-12-8-21"></path>
          <path d="M76 54c0-10 9-14 9-23 0-8-7-11-7-19"></path>
        </g>
      ` : '',
      showSmoke ? `
        <g class="effect-smoke">
          <path d="M48 86c-4-10-2-18 5-25 8-8 11-16 9-25"></path>
          <path d="M72 90c-3-11 1-18 8-26 7-7 10-16 8-24"></path>
          <path d="M91 88c-4-9-3-16 3-22 7-8 9-15 7-23"></path>
        </g>
      ` : '',
      showDeposit ? buildSurfaceDepositMarkup(item) : '',
      showReactionFlame ? `
        <g class="effect-reaction-flame">
          <path class="flame-outer" d="M72 132c15-18 20-33 20-47 0-9-4-17-10-24-1 10-7 18-14 25-6 6-15 15-15 28 0 10 8 18 19 18Z"></path>
          <path class="flame-mid" d="M72 127c10-13 14-23 14-34 0-6-2-11-6-16-2 7-6 12-10 17-4 5-9 11-9 20 0 8 5 13 11 13Z"></path>
          <path class="flame-core" d="M72 121c6-9 8-15 8-22 0-4-1-7-3-10-2 5-4 8-6 11-3 3-6 8-6 13 0 5 3 8 7 8Z"></path>
        </g>
      ` : '',
      showFlash ? `
        <g class="effect-flash">
          <circle cx="72" cy="78" r="18"></circle>
        </g>
      ` : '',
      showExplosion ? `
        <g class="effect-explosion">
          <circle class="effect-explosion__core" cx="72" cy="112" r="15"></circle>
          <circle class="effect-explosion__ring" cx="72" cy="112" r="28"></circle>
          <path class="effect-explosion__spark" d="M72 76l4 12 12-4-8 10 10 7-12-1 1 13-7-10-8 10 1-13-12 1 10-7-8-10 12 4 5-12Z"></path>
        </g>
      ` : '',
      buildCustomEffectMarkup(item)
    ].join('');
  }

  const flameZone = svgElement.querySelector('[data-zone="flame-zone"]');
  if (flameZone) {
    const flameLayer = ensureRenderLayer(svgElement, 'flame');
    const showFlame = item.state.visual.flame || hasEffect(itemEffects, 'heatGlow');
    flameLayer.innerHTML = showFlame ? `
      <g class="effect-flame">
        <path class="flame-outer" d="M65 10c16 22 24 31 24 48 0 16-11 28-24 28S41 74 41 58c0-11 7-20 13-28 4-5 8-10 11-20Z"></path>
        <path class="flame-mid" d="M65 24c8 12 13 18 13 30 0 9-6 17-13 17s-13-8-13-17c0-7 4-13 7-18 2-3 4-5 6-12Z"></path>
        <path class="flame-core" d="M65 34c5 7 8 12 8 20 0 6-4 11-8 11s-8-5-8-11c0-4 2-8 5-12 1-2 2-4 3-8Z"></path>
      </g>
    ` : '';
  }

  const heatLayer = ensureRenderLayer(svgElement, 'heat-glow');
  const showHeatGlow = item.state.isHeated || hasEffect(itemEffects, 'heatGlow');
  const strongHeat = item.state.visual.heatIntensity >= 0.82 || itemEffects.some((effect) => effect.effectId === 'heat_glow_strong');
  heatLayer.innerHTML = showHeatGlow ? `
    <g class="effect-heat-glow">
      <ellipse cx="72" cy="128" rx="${strongHeat ? 44 : 34}" ry="${strongHeat ? 14 : 10}"></ellipse>
    </g>
  ` : '';
}
