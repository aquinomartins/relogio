const NS = 'http://www.w3.org/2000/svg';

/** Geometry in SVG units. Material colors live in styles.css. */
export const CLOCK_CONFIG = {
  center: { x: 500, y: 500 },
  dial: {
    outerRadius: 400, majorLength: 76, majorWidth: 15,
    inlayWidth: 9, inlayLength: 65,
    minorLength: 28, minorWidth: 3,
    hourRadius: 270, hourSize: 60, hourStroke: 2.9,
    scaleRadius: 445, scaleSize: 30, scaleStroke: 3.1,
  },
  hands: {
    hour: { length: 260, width: 18 },
    minute: { length: 388, width: 14 },
    second: { length: 398, width: 2.6, tailLength: 92, tailWidth: 7 },
  },
  hubRadius: 22,
  shadows: {
    index: { dx: 2, dy: 4, blur: 2.4, opacity: 0.23 },
    hand: { dx: 3, dy: 7, blur: 4.2, opacity: 0.25 },
    second: { dx: 2, dy: 4, blur: 1.8, opacity: 0.19 },
    hub: { dx: 2, dy: 4, blur: 2.4, opacity: 0.25 },
  },
  // Set to e.g. '09:30:08' for a permanent study. null keeps real local time.
  referenceTime: null,
};

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.append(node);
  return node;
}

export function polar(radius, degrees, center = CLOCK_CONFIG.center) {
  const radians = degrees * Math.PI / 180;
  return { x: center.x + radius * Math.sin(radians), y: center.y - radius * Math.cos(radians) };
}

// Original monoline outlines, not a claim about the font used in the video.
const DIGITS = {
  0: { width: 34, path: 'M17 1C6 1 1 9 1 21V39C1 51 6 59 17 59S33 51 33 39V21C33 9 28 1 17 1Z' },
  1: { width: 12, path: 'M6 1V59' },
  2: { width: 34, path: 'M2 13C3 5 9 1 17 1C27 1 33 7 33 16C33 24 28 29 21 35L2 53V59H33' },
  3: { width: 34, path: 'M2 8C6 3 11 1 18 1C27 1 33 7 33 15C33 24 27 29 17 29M17 29C27 29 33 35 33 44C33 53 27 59 17 59C10 59 5 56 1 51' },
  4: { width: 36, path: 'M24 1L1 41H35M27 20V59' },
  5: { width: 34, path: 'M32 1H4L2 28C7 25 12 24 18 24C28 24 33 31 33 41C33 52 27 59 17 59C10 59 4 56 1 51' },
  6: { width: 34, path: 'M30 5C26 2 23 1 18 1C7 1 1 12 1 29V40C1 52 7 59 17 59S33 52 33 41C33 30 27 24 17 24C10 24 4 28 1 34' },
  7: { width: 34, path: 'M1 1H33L10 59' },
  8: { width: 34, path: 'M17 28C7 28 2 23 2 15C2 6 8 1 17 1S32 6 32 15C32 23 27 28 17 28ZM17 28C6 28 1 34 1 44C1 53 7 59 17 59S33 53 33 44C33 34 28 28 17 28Z' },
  9: { width: 34, path: 'M4 55C8 58 11 59 16 59C27 59 33 48 33 31V20C33 8 27 1 17 1S1 8 1 19C1 30 7 36 17 36C24 36 30 32 33 26' },
};

function number(parent, value, position, size, stroke, className, rotation = 0) {
  const digits = [...String(value)].map(digit => DIGITS[digit]);
  const gap = 9;
  const width = digits.reduce((sum, digit) => sum + digit.width, 0) + gap * (digits.length - 1);
  const group = el('g', {
    class: className, 'data-value': value, 'stroke-width': stroke,
    transform: `translate(${position.x} ${position.y}) rotate(${rotation}) scale(${size / 60})`,
  }, parent);
  let x = -width / 2;
  for (const digit of digits) {
    el('path', { d: digit.path, transform: `translate(${x} -30)` }, group);
    x += digit.width + gap;
  }
}

function gradient(defs, id, x1, y1, x2, y2, stops) {
  const node = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, defs);
  for (const [offset, tone] of stops) el('stop', { offset, class: `${tone}-stop` }, node);
  return node;
}

function materials(defs, config) {
  const filters = {};
  for (const [name, shadow] of Object.entries(config.shadows)) {
    // Each filter stays on an untransformed parent, so dx/dy are page-aligned.
    // Static indices get tight global bounds; moving hands get their sweep bounds.
    const extent = name === 'hub' ? config.hubRadius + 16
      : name === 'second' ? config.hands.second.length + 18
        : Math.max(config.hands.hour.length, config.hands.minute.length) + 24;
    filters[name] = el('filter', { id: `shadow-${name}`, filterUnits: 'userSpaceOnUse',
      x: config.center.x - extent, y: config.center.y - extent,
      width: extent * 2, height: extent * 2, 'color-interpolation-filters': 'sRGB' }, defs);
    el('feDropShadow', { dx: shadow.dx, dy: shadow.dy, stdDeviation: shadow.blur,
      'flood-opacity': shadow.opacity, class: 'shadow-color' }, filters[name]);
  }
  const { x, y } = config.center;
  const cap = el('radialGradient', { id: 'hub-face', gradientUnits: 'userSpaceOnUse',
    cx: x - 7, cy: y - 9, r: config.hubRadius * 1.7 }, defs);
  for (const [offset, tone] of [[0, 'silver-light'], ['48%', 'silver'], ['100%', 'silver-dark']]) {
    el('stop', { offset, class: `${tone}-stop` }, cap);
  }
  const core = el('radialGradient', { id: 'hub-core', cx: '30%', cy: '25%', r: '75%' }, defs);
  el('stop', { offset: 0, class: 'edge-stop' }, core);
  el('stop', { offset: 1, class: 'axle-stop' }, core);
  return filters;
}

/** Shade the two bevels from their world-space surface normals and a top-left light. */
function worldLight(angle) {
  const radians = angle * Math.PI / 180;
  const dot = (-Math.cos(radians) - Math.sin(radians)) / Math.SQRT2;
  return { left: 0.21 - dot * 0.2, right: 0.21 + dot * 0.2 };
}

function metalShape(parent, defs, id, path, width, center) {
  const { x, y } = center;
  gradient(defs, `${id}-metal`, x - width / 2, y, x + width / 2, y, [
    [0, 'silver-dark'], ['17%', 'silver-light'], ['42%', 'silver'],
    ['66%', 'silver-light'], [1, 'silver-dark'],
  ]);
  el('path', { d: path, fill: `url(#${id}-metal)`, class: 'metal-edge', 'stroke-width': 0.7 }, parent);
  // Two half-face overlays light the bevels without rotating the light with the hand.
  const clips = [];
  for (const side of ['left', 'right']) {
    const clip = el('clipPath', { id: `${id}-${side}-clip`, clipPathUnits: 'userSpaceOnUse' }, defs);
    el('rect', { x: side === 'left' ? x - width : x, y: y - 450, width, height: 600 }, clip);
    clips.push(el('path', { d: path, fill: 'var(--silver-light)',
      'clip-path': `url(#${id}-${side}-clip)` }, parent));
  }
  return angle => {
    const light = worldLight(angle);
    clips[0].setAttribute('opacity', light.left.toFixed(3));
    clips[1].setAttribute('opacity', light.right.toFixed(3));
  };
}

function handPath({ length, width }, { x, y }) {
  const w = width / 2;
  return `M${x} ${y - length}C${x + 2.3} ${y - length} ${x + w - 1} ${y - length + 14} ${x + w - 1} ${y - length + 25}
    L${x + w} ${y - 39}Q${x + w + 2} ${y - 21} ${x + w + 1} ${y + 7}
    Q${x} ${y + 20} ${x - w - 1} ${y + 7}Q${x - w - 2} ${y - 21} ${x - w} ${y - 39}
    L${x - w + 1} ${y - length + 25}C${x - w + 1} ${y - length + 14} ${x - 2.3} ${y - length} ${x} ${y - length}Z`;
}

function inlayPath({ length, width }, { x, y }) {
  const w = width * 0.22;
  return `M${x} ${y - length + 18}Q${x + w} ${y - length + 28} ${x + w} ${y - length + 39}
    L${x + w} ${y - 43}Q${x} ${y - 36} ${x - w} ${y - 43}
    L${x - w} ${y - length + 39}Q${x - w} ${y - length + 28} ${x} ${y - length + 18}Z`;
}

export function buildClock(svg, config = CLOCK_CONFIG) {
  const { center, dial } = config;
  const { x, y } = center;
  const defs = el('defs', {}, svg);
  const filters = materials(defs, config);
  const print = el('g', { id: 'printed-dial' }, svg);
  const rotations = [0, 30, 60, 90, -60, -30, 0, 30, 60, -90, -60, -30];
  for (let i = 0; i < 12; i++) {
    number(print, i === 0 ? 12 : i, polar(dial.hourRadius, i * 30, center), dial.hourSize, dial.hourStroke, 'hour-number');
    number(print, i === 0 ? '60' : String(i * 5).padStart(2, '0'),
      polar(dial.scaleRadius, i * 30, center), dial.scaleSize, dial.scaleStroke, 'outer-number', rotations[i]);
  }
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = polar(dial.outerRadius - dial.minorLength, i * 6, center);
    const b = polar(dial.outerRadius, i * 6, center);
    el('line', { class: 'minor-tick', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': dial.minorWidth }, print);
  }
  const indices = el('g', { id: 'major-indices' }, svg);
  for (let i = 0; i < 12; i++) {
    const angle = i * 30;
    const p = polar(dial.outerRadius - dial.majorLength / 2, angle, center);
    const shadow = el('g', { filter: 'url(#shadow-index)' }, indices);
    // Tight filter bounds in global coordinates, including the short cast shadow.
    const filter = filters.index.cloneNode(true);
    const reach = dial.majorLength / 2 + 18;
    const filterId = `shadow-index-${i}`;
    for (const [key, value] of Object.entries({ id: filterId, x: p.x - reach, y: p.y - reach,
      width: reach * 2, height: reach * 2 })) filter.setAttribute(key, value);
    defs.append(filter);
    shadow.setAttribute('filter', `url(#${filterId})`);
    const body = el('g', { class: 'major-index', transform: `translate(${p.x} ${p.y}) rotate(${angle})` }, shadow);
    const w = dial.majorWidth, h = dial.majorLength;
    const path = `M0 ${-h / 2}A${w / 2} ${w / 2} 0 0 1 ${w / 2} ${-h / 2 + w / 2}
      V${h / 2 - w / 2}A${w / 2} ${w / 2} 0 0 1 ${-w / 2} ${h / 2 - w / 2}
      V${-h / 2 + w / 2}A${w / 2} ${w / 2} 0 0 1 0 ${-h / 2}Z`;
    metalShape(body, defs, `index-${i}`, path, w, { x: 0, y: 0 })(angle);
    gradient(defs, `index-${i}-inlay`, -dial.inlayWidth / 2, 0, dial.inlayWidth / 2, 0,
      [[0, 'inlay-light'], ['38%', 'inlay'], [1, 'inlay']]);
    el('rect', { x: -dial.inlayWidth / 2, y: -dial.inlayLength / 2, width: dial.inlayWidth,
      height: dial.inlayLength, rx: dial.inlayWidth / 2, fill: `url(#index-${i}-inlay)` }, body);
  }
  const handParts = {};
  for (const name of ['hour', 'minute', 'second']) {
    const dimensions = config.hands[name];
    const shadow = el('g', { id: `${name}-shadow`, filter: `url(#shadow-${name === 'second' ? 'second' : 'hand'})` }, svg);
    const body = el('g', { id: `${name}-hand` }, shadow);
    let shade;
    if (name === 'second') {
      const tailWidth = dimensions.tailWidth;
      gradient(defs, 'second-metal', x - tailWidth / 2, y, x + tailWidth / 2, y,
        [[0, 'silver'], ['40%', 'silver-light'], [1, 'silver-dark']]);
      el('path', { d: `M${x} ${y - dimensions.length}V${y + dimensions.tailLength - tailWidth / 2}`,
        fill: 'none', stroke: 'url(#second-metal)', 'stroke-width': dimensions.width, 'stroke-linecap': 'round' }, body);
      el('rect', { x: x - tailWidth / 2, y: y + 10, width: tailWidth,
        height: dimensions.tailLength - 10, rx: tailWidth / 2, fill: 'url(#second-metal)' }, body);
      shade = () => {};
    } else {
      shade = metalShape(body, defs, name, handPath(dimensions, center), dimensions.width, center);
      gradient(defs, `${name}-inlay`, x - dimensions.width / 4, y, x + dimensions.width / 4, y,
        [[0, 'inlay-light'], ['40%', 'inlay'], [1, 'inlay']]);
      el('path', { d: inlayPath(dimensions, center), fill: `url(#${name}-inlay)` }, body);
    }
    handParts[name] = { body, shade };
  }
  const hub = el('g', { id: 'hub', filter: 'url(#shadow-hub)' }, svg);
  const radius = config.hubRadius;
  el('circle', { cx: x, cy: y, r: radius, fill: 'var(--silver-dark)', class: 'metal-edge', 'stroke-width': 0.9 }, hub);
  el('circle', { cx: x, cy: y, r: radius - 1.5, fill: 'url(#hub-face)', class: 'metal-highlight', 'stroke-width': 1 }, hub);
  el('circle', { cx: x, cy: y, r: radius * 0.63, fill: 'none', stroke: 'var(--silver-dark)', 'stroke-width': 0.8, opacity: 0.65 }, hub);
  el('circle', { cx: x, cy: y, r: radius * 0.33, fill: 'url(#hub-core)', stroke: 'var(--metal-edge)', 'stroke-width': 0.7 }, hub);
  el('ellipse', { cx: x - 2, cy: y - 2.7, rx: 2.3, ry: 1.3, fill: 'var(--silver-light)', opacity: 0.55 }, hub);
  return {
    update(angles) {
      for (const [name, angle] of Object.entries(angles)) {
        handParts[name].body.setAttribute('transform', `rotate(${angle} ${x} ${y})`);
        handParts[name].shade(angle);
      }
    },
  };
}
