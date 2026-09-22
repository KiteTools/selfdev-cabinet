import test from 'node:test';
import assert from 'node:assert/strict';
import { convertTimeBetweenZones, toSendPulse, fromSendPulse } from '../netlify/functions/lib/variables.js';

test('schedule conversion handles crossing midnight and half-hour offsets', () => {
  const winter = new Date('2026-01-15T12:00:00Z');
  assert.equal(convertTimeBetweenZones('02:30', 'Asia/Tokyo', 'UTC', winter), '17:30');
  assert.equal(convertTimeBetweenZones('08:00', 'Asia/Kolkata', 'UTC', winter), '02:30');
  assert.equal(convertTimeBetweenZones('08:00', 'Europe/Lisbon', 'UTC', winter), '08:00');
  assert.equal(convertTimeBetweenZones('08:00', 'Europe/Lisbon', 'UTC', new Date('2026-07-15T12:00:00Z')), '07:00');
});

test('imported bot schedule returns to the client timezone on reload', () => {
  const state = { tz: 'Asia/Dubai', t1: '08:00', t2: '22:00' };
  const outgoing = toSendPulse(state, state.tz);
  assert.deepEqual({ tz: state.tz, ...fromSendPulse(outgoing, state.tz) }, state);
});
