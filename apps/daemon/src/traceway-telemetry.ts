import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type SpanContext,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-node';
import type { Application, NextFunction, Request, Response } from 'express';

const DEFAULT_ENDPOINT = 'https://traceway.wxcode.ai/api/otel';
const SERVICE_NAME = 'open-design-daemon';
const SERVICE_NAMESPACE = 'wxcode';
const TRACEWAY_TRACE_ID = 'traceway.distributed_trace_id';
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_SPAN_NAMES = new Set([
  'daemon.start',
  'daemon.shutdown',
  'daemon.fatal',
  'daemon.model_error',
  'http.server',
  'critique.run',
]);
const SAFE_ATTRIBUTE_KEYS = new Set([
  'http.request.method',
  'http.route',
  'http.response.status_code',
  TRACEWAY_TRACE_ID,
]);
const RESOURCE_ATTRIBUTE_KEYS = new Set([
  'service.name',
  'service.namespace',
  'service.version',
  'deployment.environment.name',
]);

export interface TracewayConfig {
  endpoint: string;
  environment: string;
  sampleRatio: number;
  token: string;
  version: string;
}

export interface TracewayTelemetry {
  readonly enabled: boolean;
  recordFatalException(error: unknown): void;
  recordHandledModelError(code: TracewayModelErrorCode): void;
  shutdown(): Promise<void>;
  startLifecycleSpan(name: 'daemon.start' | 'daemon.shutdown'): Span;
}

export type TracewayModelErrorCode =
  | 'AGENT_AUTH_REQUIRED'
  | 'AGENT_EXECUTION_FAILED'
  | 'AGENT_UNAVAILABLE'
  | 'AMR_AUTH_REQUIRED'
  | 'AMR_INSUFFICIENT_BALANCE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE';

const TRACEWAY_MODEL_ERROR_CODES = new Set<TracewayModelErrorCode>([
  'AGENT_AUTH_REQUIRED',
  'AGENT_EXECUTION_FAILED',
  'AGENT_UNAVAILABLE',
  'AMR_AUTH_REQUIRED',
  'AMR_INSUFFICIENT_BALANCE',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
]);

const disabledTelemetry: TracewayTelemetry = {
  enabled: false,
  recordFatalException: () => {},
  recordHandledModelError: () => {},
  shutdown: async () => {},
  startLifecycleSpan: () => trace.getTracer(SERVICE_NAME).startSpan('daemon.start'),
};

let startedTelemetry: TracewayTelemetry | null = null;
const tracedApps = new WeakSet<object>();

/**
 * Parse the deployment-only Traceway contract. It deliberately does not reuse
 * Open Design's PostHog or Langfuse configuration and never consults user
 * consent preferences: this is an operator opt-in for wxcode infrastructure.
 */
export function readTracewayConfig(env: NodeJS.ProcessEnv = process.env): TracewayConfig | null {
  if (!isTelemetryEnabled(env.WXCODE_TELEMETRY_ENABLED)) return null;

  const token = env.WXCODE_TELEMETRY_TOKEN?.trim();
  const environment = env.WXCODE_TELEMETRY_ENVIRONMENT?.trim();
  const version = env.WXCODE_TELEMETRY_VERSION?.trim();
  const endpoint = normalizeEndpoint(env.WXCODE_TELEMETRY_ENDPOINT ?? DEFAULT_ENDPOINT);
  if (!token || !environment || !version || !endpoint) return null;

  return {
    endpoint,
    environment,
    sampleRatio: parseSampleRatio(env.WXCODE_TELEMETRY_SAMPLE_RATIO),
    token,
    version,
  };
}

export function isCanonicalTracewayTraceId(value: string | undefined): value is string {
  return typeof value === 'string' && CANONICAL_UUID.test(value);
}

export function recordTracewayException(span: Span, error: unknown): void {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.addEvent('exception', { 'exception.type': safeExceptionType(error) });
}

/**
 * Normalize the terminal model-service classes before they reach the tracing
 * boundary. The daemon must not derive an exception type from provider text.
 */
export function normalizeTracewayModelErrorCode(value: unknown): TracewayModelErrorCode {
  return typeof value === 'string' && TRACEWAY_MODEL_ERROR_CODES.has(value as TracewayModelErrorCode)
    ? value as TracewayModelErrorCode
    : 'AGENT_EXECUTION_FAILED';
}

/** Create a run-local, first-error-wins recorder for handled model failures. */
export function createTracewayModelErrorRecorder(
  record: (code: TracewayModelErrorCode) => void,
): (code: unknown) => void {
  let recorded = false;
  return (code: unknown): void => {
    if (recorded) return;
    recorded = true;
    record(normalizeTracewayModelErrorCode(code));
  };
}

/**
 * Starts the Node tracing SDK without auto-instrumentations. Manual spans are
 * intentional: automatic HTTP instrumentation records URLs and headers that
 * this daemon must never export.
 */
export function startTracewayTelemetry(env: NodeJS.ProcessEnv = process.env): TracewayTelemetry {
  if (startedTelemetry) return startedTelemetry;

  const config = readTracewayConfig(env);
  if (!config) return disabledTelemetry;

  try {
    const exporter = new PrivacySpanExporter(new OTLPTraceExporter({
      url: `${config.endpoint}/v1/traces`,
      headers: { Authorization: `Bearer ${config.token}` },
    }));
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        'service.name': SERVICE_NAME,
        'service.namespace': SERVICE_NAMESPACE,
        'service.version': config.version,
        'deployment.environment.name': config.environment,
      }),
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(config.sampleRatio) }),
      spanProcessors: [new BatchSpanProcessor(exporter, {
        exportTimeoutMillis: 3_000,
        maxExportBatchSize: 64,
        maxQueueSize: 256,
        scheduledDelayMillis: 5_000,
      })],
    });
    provider.register();

    let shutdownPromise: Promise<void> | null = null;
    const telemetry: TracewayTelemetry = {
      enabled: true,
      recordFatalException(error: unknown): void {
        const span = trace.getTracer(SERVICE_NAME).startSpan('daemon.fatal', {
          // Traceway promotes CONSUMER spans to Tasks. These daemon lifecycle
          // signals are not HTTP requests and intentionally carry no content.
          kind: SpanKind.CONSUMER,
        });
        recordTracewayException(span, error);
        span.end();
      },
      recordHandledModelError(code: TracewayModelErrorCode): void {
        const span = trace.getTracer(SERVICE_NAME).startSpan('daemon.model_error', {
          kind: SpanKind.CONSUMER,
        });
        recordTracewayException(span, normalizeTracewayModelErrorCode(code));
        span.end();
      },
      async shutdown(): Promise<void> {
        if (shutdownPromise) return shutdownPromise;
        const activeTelemetry = startedTelemetry;
        shutdownPromise = (async () => {
          try {
            await Promise.race([
              provider.shutdown(),
              new Promise<void>((resolve) => {
                const timeout = setTimeout(resolve, 3_000);
                timeout.unref?.();
              }),
            ]);
          } catch {
            // Collector failures are deliberately fail-open.
          } finally {
            // The OTel API retains its global provider after shutdown. Remove
            // the provider this module registered so another daemon lifecycle
            // does not silently write to a stopped processor.
            trace.disable();
            if (startedTelemetry === activeTelemetry) startedTelemetry = null;
          }
        })();
        return shutdownPromise;
      },
      startLifecycleSpan(name): Span {
        return trace.getTracer(SERVICE_NAME).startSpan(name, { kind: SpanKind.CONSUMER });
      },
    };
    startedTelemetry = telemetry;
    return telemetry;
  } catch {
    return disabledTelemetry;
  }
}

/** Install one privacy-preserving HTTP middleware on an Express app. */
export function installTracewayHttpTracing(app: Pick<Application, 'use'>): void {
  if (tracedApps.has(app as object)) return;
  tracedApps.add(app as object);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = trace.getTracer(SERVICE_NAME).startSpan('http.server', {
      attributes: { 'http.request.method': req.method },
      kind: SpanKind.SERVER,
    });
    const distributedTraceId = req.get('traceway-trace-id');
    if (isCanonicalTracewayTraceId(distributedTraceId)) {
      span.setAttribute(TRACEWAY_TRACE_ID, distributedTraceId);
    }

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      const route = routeTemplate(req);
      if (route) span.setAttribute('http.route', route);
      span.setAttribute('http.response.status_code', res.statusCode);
      if (res.statusCode >= 500) recordTracewayException(span, 'HttpServerError');
      else span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    };
    res.once('finish', finish);
    res.once('close', finish);

    return context.with(trace.setSpan(context.active(), span), () => next());
  });
}

/** A final allowlist prevents accidental source, request, or child data export. */
export class PrivacySpanExporter implements SpanExporter {
  constructor(private readonly delegate: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: Parameters<SpanExporter['export']>[1],
  ): void {
    this.delegate.export(spans.map(sanitizeSpan), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.delegate.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.delegate.forceFlush?.() ?? Promise.resolve();
  }
}

export function sanitizeSpan(span: ReadableSpan): ReadableSpan {
  return {
    // The OTLP transformer serializes more than attributes and events. Build
    // the exported shape field-by-field instead of spreading an untrusted span.
    name: SAFE_SPAN_NAMES.has(span.name) ? span.name : 'open-design.operation',
    kind: span.kind,
    spanContext: () => sanitizeSpanContext(span.spanContext()),
    ...(span.parentSpanContext ? { parentSpanContext: sanitizeSpanContext(span.parentSpanContext) } : {}),
    startTime: span.startTime,
    endTime: span.endTime,
    status: { code: span.status?.code ?? SpanStatusCode.UNSET },
    attributes: sanitizeAttributes(span.attributes),
    links: [],
    events: span.events.flatMap((event) => {
      if (event.name !== 'exception') return [];
      const type = event.attributes?.['exception.type'];
      if (typeof type !== 'string' || !isSafeExceptionType(type)) return [];
      return [{ ...event, attributes: { 'exception.type': type } }];
    }),
    duration: span.duration,
    ended: span.ended,
    resource: resourceFromAttributes(sanitizeResourceAttributes(span.resource?.attributes ?? {})),
    instrumentationScope: { name: SERVICE_NAME },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  };
}

function sanitizeResourceAttributes(attributes: Attributes): Attributes {
  const safe: Attributes = {};
  for (const key of RESOURCE_ATTRIBUTE_KEYS) {
    const value = attributes[key];
    if (key === 'service.name') safe[key] = SERVICE_NAME;
    else if (key === 'service.namespace') safe[key] = SERVICE_NAMESPACE;
    else if (typeof value === 'string' && isSafeResourceValue(value)) safe[key] = value;
    else safe[key] = 'unknown';
  }
  return safe;
}

function sanitizeSpanContext(spanContext: SpanContext): SpanContext {
  return {
    traceId: isTraceId(spanContext.traceId) ? spanContext.traceId.toLowerCase() : '0'.repeat(32),
    spanId: isSpanId(spanContext.spanId) ? spanContext.spanId.toLowerCase() : '0'.repeat(16),
    traceFlags: spanContext.traceFlags === 1 ? 1 : 0,
  };
}

export function sanitizeAttributes(attributes: Attributes): Attributes {
  const safe: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!SAFE_ATTRIBUTE_KEYS.has(key)) continue;
    if (key === TRACEWAY_TRACE_ID && typeof value === 'string' && isCanonicalTracewayTraceId(value)) {
      safe[key] = value;
    } else if (key === 'http.request.method' && typeof value === 'string' && /^[A-Z]{3,10}$/u.test(value)) {
      safe[key] = value;
    } else if (key === 'http.route' && typeof value === 'string' && isSafeRouteTemplate(value)) {
      safe[key] = value;
    } else if (key === 'http.response.status_code' && typeof value === 'number' && value >= 100 && value <= 599) {
      safe[key] = value;
    }
  }
  return safe;
}

function normalizeEndpoint(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/u, '')}`;
  } catch {
    return null;
  }
}

function parseSampleRatio(value: string | undefined): number {
  if (value == null || value.trim() === '') return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
}

export function routeTemplate(req: Pick<Request, 'route'>): string | null {
  const route = req.route?.path;
  return typeof route === 'string' && isSafeRouteTemplate(route) ? route : null;
}

function isSafeRouteTemplate(value: string): boolean {
  // A route with a dynamic segment must retain Express's `:name` template.
  // Dropping static routes is preferable to ever accepting a raw path whose
  // tenant/project/run segment has already been substituted.
  return value.startsWith('/') && value.includes(':') && value.length <= 200 && /^[a-zA-Z0-9_/:.-]+$/u.test(value);
}

function safeExceptionType(error: unknown): string {
  if (typeof error === 'string') return isSafeExceptionType(error) ? error : 'Error';
  if (error && typeof error === 'object') {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && isSafeExceptionType(name)) return name;
  }
  return 'Error';
}

function isSafeExceptionType(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,95}$/u.test(value);
}

function isSafeResourceValue(value: string): boolean {
  return /^[A-Za-z0-9_.-]{1,128}$/u.test(value);
}

function isTraceId(value: string): boolean {
  return /^[0-9a-f]{32}$/iu.test(value);
}

function isSpanId(value: string): boolean {
  return /^[0-9a-f]{16}$/iu.test(value);
}

function isTelemetryEnabled(value: string | undefined): boolean {
  return value != null && new Set(['1', 'true', 'yes', 'on']).has(value.trim().toLowerCase());
}
