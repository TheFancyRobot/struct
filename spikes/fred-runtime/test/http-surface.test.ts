import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { generateApiKey, makeMemoryApiKeyStore } from '@fancyrobot/fred-http';
import {
  createHttpSpikeRuntime,
  makeResearchRunInput,
} from '../src/runtime-harness';

const ORIGIN = 'http://localhost:5173';

describe('fred-http compatibility', () => {
  test('serves typed JSON and coarse SSE lifecycle events without product-specific policies in Fred core', async () => {
    const store = makeMemoryApiKeyStore();
    const [jsonKey, streamKey] = await Effect.runPromise(Effect.all([
      generateApiKey(['workflows:run'], { id: 'json-client' }),
      generateApiKey(['workflows:stream'], { id: 'stream-client' }),
    ]));

    await Effect.runPromise(Effect.all([
      store.insert(jsonKey.record),
      store.insert(streamKey.record),
    ]));

    const fred = await createHttpSpikeRuntime({ apiKeyStore: store });
    const server = await fred.server.listen({ hostname: '127.0.0.1', port: 0 });

    try {
      const jsonResponse = await fetch(`${server.url}/workflows/research-run-spike`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${jsonKey.token}`,
          'content-type': 'application/json',
          origin: ORIGIN,
        },
        body: JSON.stringify(makeResearchRunInput()),
      });

      expect(jsonResponse.status).toBe(200);
      const jsonBody = await jsonResponse.json() as {
        output?: {
          recommendation?: {
            step02Handoff?: { checkpointOwner?: string };
          };
        };
      };
      expect(jsonBody.output?.recommendation?.step02Handoff?.checkpointOwner).toBe(
        'product-journal',
      );

      const streamResponse = await fetch(`${server.url}/workflows/research-progress-spike`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${streamKey.token}`,
          'content-type': 'application/json',
          origin: ORIGIN,
        },
        body: JSON.stringify({ job: 'step-00-01' }),
      });

      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers.get('content-type')).toContain('text/event-stream');
      const events = await streamResponse.text();
      expect(events).toContain('"event":"started"');
      expect(events).toContain('"event":"node-completed"');
      expect(events).toContain('"event":"completed"');
      expect((events.match(/"event":"completed"/g) ?? []).length).toBe(1);
    } finally {
      await fred.shutdown();
    }
  });
});
