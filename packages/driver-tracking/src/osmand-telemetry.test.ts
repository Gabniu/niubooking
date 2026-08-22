// Ownership: driver-tracking provider boundary tests. Scope must stay in the session credential, never the body.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeOsmAndTelemetryFetcher } from './index.js';

test('translates the shared upload into a scoped OsmAnd form payload', async () => {
  let seenUrl = '';
  let seenBody = '';
  const send = createNativeOsmAndTelemetryFetcher(async (url, init) => { seenUrl = url; seenBody = init.body; return { status: 200 }; });
  const result = await send('https://booking.test/v1/fleet/telemetry/osmand', {
    method: 'POST',
    headers: { authorization: 'Bearer niu_traccar_v1.tenant.session.secret', 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'session-1', eventId: 'event-1', sequence: 0, capturedAt: '2030-01-01T08:00:00.000Z', latitude: -1.28, longitude: 36.81, accuracyMetres: 8, speedMetresPerSecond: 5.14444, headingDegrees: 90, batteryPercent: 72 }),
  });
  const form = new URLSearchParams(seenBody);
  assert.equal(result.status, 200);
  assert.equal(seenUrl, 'https://booking.test/v1/fleet/telemetry/osmand');
  assert.equal(form.get('id'), 'niu_traccar_v1.tenant.session.secret');
  assert.equal(form.get('lat'), '-1.28');
  assert.equal(form.get('lon'), '36.81');
  assert.equal(form.get('valid'), '1');
  assert.equal(form.get('batt'), '72');
});
