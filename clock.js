import { CLOCK_CONFIG, buildClock } from './clock-face.js';
import { anglesForTime, localTime, parseReference, formatTime } from './clock-time.js';

export function mountClock(svg, accessibleTime, config = CLOCK_CONFIG) {
  const clock = buildClock(svg, config);
  const params = new URLSearchParams(window.location.search);
  const requestedTime = params.has('reference') ? (params.get('reference') || '09:30:08') : config.referenceTime;
  const reference = parseReference(requestedTime);
  if (requestedTime != null && !reference) {
    console.warn('Horário de referência inválido. Use ?reference=HH:MM:SS ou HH:MM:SS.sss. Exibindo hora local.');
  }
  svg.dataset.mode = reference ? 'reference' : 'local';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let frame = null;
  let timer = null;
  let lastText = '';
  let destroyed = false;

  function paint(time) {
    clock.update(anglesForTime(time));
    const text = formatTime(time);
    if (lastText !== text) {
      accessibleTime.dateTime = text;
      accessibleTime.textContent = `${reference ? 'Horário de referência' : 'Horário local'}: ${text}`;
      lastText = text;
    }
  }

  function cancelWork() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = timer = null;
  }

  function tick() {
    frame = timer = null;
    if (destroyed || document.hidden) return;
    const now = new Date();
    const time = localTime(now);
    if (motion.matches) time.milliseconds = 0;
    paint(time);
    if (motion.matches) {
      timer = setTimeout(tick, 1000 - now.getMilliseconds());
    } else {
      frame = requestAnimationFrame(tick);
    }
  }

  function resume() {
    cancelWork();
    if (destroyed) return;
    if (reference) paint(reference);
    else tick();
  }

  document.addEventListener('visibilitychange', resume, { signal: events.signal });
  window.addEventListener('pageshow', resume, { signal: events.signal });
  window.addEventListener('pagehide', cancelWork, { signal: events.signal });
  motion.addEventListener('change', resume, { signal: events.signal });
  resume();
  return function destroy() {
    destroyed = true;
    cancelWork();
    events.abort();
    svg.replaceChildren();
  };
}

mountClock(document.querySelector('#clock'), document.querySelector('#clock-time'));
