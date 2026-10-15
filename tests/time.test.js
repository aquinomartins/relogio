import test from 'node:test';
import assert from 'node:assert/strict';
import { anglesForTime, parseReference, localTime, formatTime } from '../clock-time.js';

test('posição dos ponteiros nos horários de comparação', () => {
  for (const [time, expected] of [
    ['12:00:00', { hour: 0, minute: 0, second: 0 }],
    ['03:15:00', { hour: 97.5, minute: 90, second: 0 }],
    ['09:30:00', { hour: 285, minute: 180, second: 0 }],
    ['09:30:08', { hour: 285 + 8 / 120, minute: 180.8, second: 48 }],
  ]) {
    const result = anglesForTime(parseReference(time));
    for (const hand of Object.keys(expected)) assert.ok(Math.abs(result[hand] - expected[hand]) < 1e-10);
  }
});

test('frações e viradas de minuto, hora e dia continuam no sentido horário', () => {
  for (const [before, after] of [
    ['09:30:59.999', '09:31:00.000'],
    ['11:59:59.999', '12:00:00.000'],
    ['23:59:59.999', '00:00:00.000'],
  ]) {
    const a = anglesForTime(parseReference(before));
    const b = anglesForTime(parseReference(after));
    for (const [hand, expected] of [['second', 0.006], ['minute', 0.0001], ['hour', 1 / 120000]]) {
      const delta = (b[hand] - a[hand] + 360) % 360;
      assert.ok(Math.abs(delta - expected) < 1e-10, `${before}: ${hand}`);
    }
  }
});

test('modo de referência aceita milissegundos e rejeita horários inválidos', () => {
  assert.equal(parseReference('00:00:00.1').milliseconds, 100);
  assert.equal(parseReference('00:00:00.12').milliseconds, 120);
  for (const value of [null, '', '24:00:00', '12:60:00', '12:00:60', '9:30:08', '12:00:00.1234', '<script>']) {
    assert.equal(parseReference(value), null);
  }
});

test('hora local e representação textual preservam os valores do dispositivo', () => {
  const date = new Date(2026, 9, 15, 21, 7, 3, 456);
  assert.deepEqual(localTime(date), { hours: 21, minutes: 7, seconds: 3, milliseconds: 456 });
  assert.equal(formatTime(localTime(date)), '21:07:03');
});
