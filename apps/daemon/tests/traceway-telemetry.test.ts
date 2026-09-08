import { describe, expect, it, vi } from 'vitest';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-node';
import {
  PrivacySpanExporter,
  installTracewayHttpTracing,
  isCanonicalTracewayTraceId,
  readTracewayConfig,
  recordTracewayException,
  routeTemplate,
  sanitizeSpan,
} from '../src/traceway-telemetry.js';

const VALID_TRACE_ID = '8a3970f1-7b8e-4a28-91bd-dad10ef3d0d7';

describe('Traceway configuration', () => {
  it('is disabled unless the dedicated operator flag and immutable metadata exist', () => {
    expect(readTracewayConfig({ WXCODE_TELEMETRY_ENABLED: 'true' })).toBeNull();
    expect(readTracewayConfig({
      WXCODE_TELEMETRY_ENABLED: 'true',
      WXCODE_TELEMETRY_TOKEN: 'dedicated-token',
      WXCODE_TELEMETRY_ENVIRONMENT: 'production',
      WXCODE_TELEMETRY_VERSION: 'git-sha',
      WXCODE_TELEMETRY_SAMPLE_RATIO: '0.25',
    })).toEqual({
      endpoint: 'https://traceway.wxcode.ai/api/otel',
      environment: 'production',
      sampleRatio: 0.25,
      token: 'dedicated-token',
      version: 'git-sha',
    });
  });

  it('rejects endpoint query strings and clamps sample ratios', () => {
    expect(readTracewayConfig({
      WXCODE_TELEMETRY_ENABLED: 'true',
      WXCODE_TELEMETRY_TOKEN: 'dedicated-token',
      WXCODE_TELEMETRY_ENVIRONMENT: 'production',
      WXCODE_TELEMETRY_VERSION: 'git-sha',
      WXCODE_TELEMETRY_ENDPOINT: 'https://traceway.wxcode.ai/api/otel?token=leak',
    })).toBeNull();
    expect(readTracewayConfig({
      WXCODE_TELEMETRY_ENABLED: 'true',
      WXCODE_TELEMETRY_TOKEN: 'dedicated-token',
      WXCODE_TELEMETRY_ENVIRONMENT: 'production',
      WXCODE_TELEMETRY_VERSION: 'git-sha',
      WXCODE_TELEMETRY_SAMPLE_RATIO: '20',
    })?.sampleRatio).toBe(1);
  });

  it.each(['1', 'true', 'yes', 'on'])('accepts the common enabled value %s', (enabled) => {
    expect(readTracewayConfig({
      WXCODE_TELEMETRY_ENABLED: enabled,
      WXCODE_TELEMETRY_TOKEN: 'dedicated-token',
      WXCODE_TELEMETRY_ENVIRONMENT: 'production',
      WXCODE_TELEMETRY_VERSION: 'git-sha',
    })).not.toBeNull();
  });

  it('accepts only canonical hyphenated UUIDs for Traceway correlation', () => {
    expect(isCanonicalTracewayTraceId(VALID_TRACE_ID)).toBe(true);
    expect(isCanonicalTracewayTraceId(VALID_TRACE_ID.toUpperCase())).toBe(false);
    expect(isCanonicalTracewayTraceId(VALID_TRACE_ID.replaceAll('-', ''))).toBe(false);
    expect(isCanonicalTracewayTraceId('8a3970f1-7b8e-0a28-91bd-dad10ef3d0d7')).toBe(false);
    expect(isCanonicalTracewayTraceId('tenant-slug')).toBe(false);
  });
});

describe('Traceway privacy boundary', () => {
  it('exports only the allowlisted HTTP/correlation attributes and exception type', () => {
    const span = {
      name: 'critique.run',
      attributes: {
        'http.request.method': 'POST',
        'http.route': '/api/projects/:id/critique',
        'http.response.status_code': 500,
        'traceway.distributed_trace_id': VALID_TRACE_ID,
        prompt: 'never-export-this',
        'http.url': 'https://private.example/path?secret=1',
        'tenant.slug': 'private-tenant',
      },
      events: [
        { name: 'exception', time: [0, 0], attributes: { 'exception.type': 'TypeError', 'exception.message': 'secret' } },
        { name: 'critique.output', time: [0, 0], attributes: { html: '<html>private</html>' } },
      ],
    } as unknown as ReadableSpan;

    const sanitized = sanitizeSpan(span);
    expect(sanitized.attributes).toEqual({
      'http.request.method': 'POST',
      'http.route': '/api/projects/:id/critique',
      'http.response.status_code': 500,
      'traceway.distributed_trace_id': VALID_TRACE_ID,
    });
    expect(sanitized.events).toEqual([
      { name: 'exception', time: [0, 0], attributes: { 'exception.type': 'TypeError' } },
    ]);
    expect(sanitizeSpan({
      ...span,
      attributes: { 'http.route': `/api/projects/${VALID_TRACE_ID}` },
    } as unknown as ReadableSpan).attributes).toEqual({});
  });

  it('does not duplicate HTTP middleware on the same Express app', () => {
    const app = { use: vi.fn() };
    installTracewayHttpTracing(app as never);
    installTracewayHttpTracing(app as never);
    expect(app.use).toHaveBeenCalledTimes(1);
  });

  it('uses the Express route template instead of a request path with IDs', () => {
    expect(routeTemplate({
      route: { path: '/api/projects/:projectId/critique/:runId' },
    } as never)).toBe('/api/projects/:projectId/critique/:runId');
  });

  it('records Traceway issues without a message or stack', () => {
    const span = { addEvent: vi.fn(), setStatus: vi.fn() };
    recordTracewayException(span as never, new TypeError('private detail'));
    expect(span.addEvent).toHaveBeenCalledWith('exception', { 'exception.type': 'TypeError' });
    expect(span.addEvent.mock.calls[0]?.[1]).not.toHaveProperty('exception.message');
    expect(span.addEvent.mock.calls[0]?.[1]).not.toHaveProperty('exception.stacktrace');
  });

  it('sanitizes before handing spans to its delegate exporter', () => {
    const delegate: SpanExporter = {
      export: vi.fn((_spans, callback) => callback({ code: 0 })),
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const exporter = new PrivacySpanExporter(delegate);
    const readableSpan = {
      name: 'untrusted-name',
      attributes: { code: 'private' },
      events: [],
      spanContext: () => ({ traceId: '0'.repeat(32), spanId: '0'.repeat(16), traceFlags: 1 }),
      startTime: [0, 0],
      endTime: [1, 0],
      status: { code: 0 },
      links: [],
      duration: [1, 0],
      ended: true,
      resource: {
        attributes: { 'service.name': 'open-design-daemon' },
        merge: vi.fn(),
        getRawAttributes: vi.fn(() => []),
      },
      instrumentationScope: { name: 'test' },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    } as unknown as ReadableSpan;
    exporter.export([readableSpan], () => {});
    expect(delegate.export).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'open-design.operation',
        attributes: {},
        spanContext: readableSpan.spanContext,
        resource: readableSpan.resource,
      }),
    ], expect.any(Function));
  });

  it('exports a real SDK span through the privacy boundary without a collector', async () => {
    const memory = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(new PrivacySpanExporter(memory))],
    });
    const span = provider.getTracer('synthetic-smoke').startSpan('critique.run');
    span.setAttribute('prompt', 'never-export-this');
    span.setAttribute('http.route', '/api/projects/:projectId/critique');
    recordTracewayException(span, new Error('private detail'));
    span.end();
    await provider.forceFlush();

    const [exported] = memory.getFinishedSpans();
    expect(exported?.attributes).toEqual({ 'http.route': '/api/projects/:projectId/critique' });
    expect(exported?.events).toEqual([
      expect.objectContaining({ name: 'exception', attributes: { 'exception.type': 'Error' } }),
    ]);
    await provider.shutdown();
  });
});
