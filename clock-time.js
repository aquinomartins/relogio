/** All angles are clockwise, with zero at twelve. No frame accumulation. */
export function anglesForTime({ hours, minutes, seconds, milliseconds = 0 }) {
  const s = seconds + milliseconds / 1000;
  const m = minutes + s / 60;
  const h = (hours % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

export function localTime(date = new Date()) {
  return {
    hours: date.getHours(), minutes: date.getMinutes(),
    seconds: date.getSeconds(), milliseconds: date.getMilliseconds(),
  };
}

/** Strict wall-clock time, including optional milliseconds; never a timezone conversion. */
export function parseReference(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) return null;
  const [, h, m, s, ms = '0'] = match;
  if (+h > 23 || +m > 59 || +s > 59) return null;
  return { hours: +h, minutes: +m, seconds: +s, milliseconds: +ms.padEnd(3, '0') };
}

export function formatTime({ hours, minutes, seconds }) {
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}
