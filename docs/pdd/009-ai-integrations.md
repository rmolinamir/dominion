# AI Integrations

AI SDKs remain external capabilities supplied through providers. The framework does not provide
its own AI library. AI use must respect aggregate invariants and context relationships.

## Current Direction

- Resolve AI providers through host-supplied dependencies and execution hooks.
- Validate AI output before using it as command input or an event payload.
- Map tools to defined commands and queries.
- Keep model calls outside automatically retried aggregate mutations where repeated calls
  would be inappropriate.
- Let host transports handle streamed output and client disconnects.
- Emit token, latency, and cost signals through observability adapters.

The former examples used a separate application-service layer. That layer is no longer required.
The exact placement and definition API for AI orchestration remain open rather than being
replaced with a new mandatory abstraction.

## Open Integration Choices

Tool approval, MCP adapters, tenant-specific routing and quotas, structured output validation,
and streaming operation contracts still need design. Ordinary streaming does not establish
reactive query or live subscription semantics.
