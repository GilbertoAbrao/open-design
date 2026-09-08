# Traceway observability for the embedded daemon

`apps/daemon` can export a deliberately small OpenTelemetry trace stream to
Traceway. This is a wxcode infrastructure integration; it is independent from
the existing PostHog and Langfuse flows and does not read or alter their user
consent preferences.

## Deployment contract

The daemon is disabled unless `WXCODE_TELEMETRY_ENABLED` is one of `1`,
`true`, `yes`, or `on` (case-insensitive). When it is enabled, all of the
following deployment variables are required except where noted:

| Variable | Required value / purpose |
| --- | --- |
| `WXCODE_TELEMETRY_ENABLED` | Explicit operator opt-in. |
| `WXCODE_TELEMETRY_ENDPOINT` | Optional; defaults to `https://traceway.wxcode.ai/api/otel`. HTTPS only, no credentials, query string, or fragment. The OTLP/HTTP trace exporter appends `/v1/traces`. |
| `WXCODE_TELEMETRY_TOKEN` | Dedicated Traceway ingest-project token for `open-design-daemon`; never a backend/admin token. |
| `WXCODE_TELEMETRY_ENVIRONMENT` | Canonical deployment environment, for example `production`. Exported as `deployment.environment.name`. |
| `WXCODE_TELEMETRY_VERSION` | Immutable release identifier (release tag or commit SHA), exported as `service.version`. |
| `WXCODE_TELEMETRY_SAMPLE_RATIO` | Optional ratio from `0` to `1`; defaults to `1`. |

The resource always identifies `service.namespace=wxcode` and
`service.name=open-design-daemon`. A missing or invalid configuration, failed
SDK initialization, and a failed/unreachable collector all leave the daemon
running. Export uses a small bounded batch queue and a bounded shutdown flush.

## Privacy boundary

The daemon uses manual Express spans instead of automatic HTTP
instrumentation. This avoids collecting URLs, query strings, headers, request
or response bodies, authentication data, cookies, source files, HTML/CSS,
prompts, critique output, images, shell commands, paths, or environment data.
The final exporter is an allowlist, so later spans cannot accidentally add
those fields.

Permitted span data is limited to request method, route template (never a
concrete path), response status, and a validated distributed Traceway ID. A
`traceway-trace-id` header is used only when it is a lowercase, hyphenated
RFC 4122 UUID; it is exported as `traceway.distributed_trace_id`. Tenant and
operation identifiers are intentionally not exported.

Errors set an `exception` event carrying only `exception.type`. Error message,
stack, and arbitrary error object attributes are never exported. This lets
Traceway create an Issue without receiving content.

The existing critique span remains content-free. Its prior run ID, adapter,
skill, terminal state, and score attributes are not exported.

## OpenCode and other agent children

OpenCode is a third-party CLI spawned by the daemon and has its normal agent
runtime access to its inherited process environment. `spawnEnvForAgent` strips
every `WXCODE_TELEMETRY_*` key case-insensitively for every agent child,
including OpenCode and agent probes. Do not add these variables to configured
agent environments or generic child-environment helpers.

This change does not instrument OpenCode itself. If child-level telemetry is
needed later, use a dedicated gateway/sidecar contract with a child-specific,
least-privilege credential; do not reuse the daemon's Traceway token.

## Required companion wiring (not changed in this repository)

`wxcode-control-plane` and `wxk-release` must inject the six
`WXCODE_TELEMETRY_*` variables only into the trusted embedded
`open-design-daemon` process. The token must come from a 0600 secret-backed
source and must not appear in Nomad job logs, release manifests, child launch
environment, or OpenCode configuration. The production environment value is
`production`; version must be the immutable release tag or commit SHA.

The chat runtime may pass `traceway-trace-id` as an HTTP header to the daemon
only after validating the same canonical UUID form. No application, tenant,
design, conversation, run, or user identifier should be added to this
contract.
