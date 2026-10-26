# Host Integration

This section replaces the earlier required application-service layer. A separate application
service that forwards to a command handler is redundant. The current direction uses one
executable command definition for the operation.

## Host-Owned Controllers

A host such as NestJS consumes context definitions and configures controllers and dependencies.
It owns server startup and shutdown. Contexts do not start themselves.

Controllers translate routes, protocol inputs, authentication metadata, responses, and errors.
Commands validate their input and implement business operations. Aggregate rules remain part
of command execution, regardless of which transport invoked the operation.

For example, a Nest controller would map an HTTP request into the redemption input and invoke
the defined command through the host integration. The exact injection and invocation interface
is not decided. There is no agreed `bindContext`, `startContext`, `createApp`, or
`createFramework` API.

Optional controller helpers or higher-order functions may reduce adapter boilerplate, but
the framework does not require its own controller abstraction or replace existing servers.

## Execution Scope

The host passes execution metadata through the integration layer. Command execution establishes
ALS so hooks can resolve the active transaction and providers. One request can involve more
than one execution scope. Request lifetime and transaction lifetime are not automatically equal.

The final interface for identity, tenant information, trace propagation, and dependency lookup
is open. Host authentication does not replace business authorization within the operation.

## Other Entry Points

HTTP, RPC, message queues, CLI commands, and background jobs should invoke the same operation
definitions through supported host adapters. They should not require a forwarding application
service solely to enter the domain model.

Messaging adapters map event handlers and commands to queues and publishers. Streaming over
SSE or WebSockets remains a host concern. Reactive queries and live subscriptions are separate,
unresolved capabilities.

## Calls Between Domains

A context may include multiple domains. Rules for calling operations or accessing repositories
across those domains remain open. Nested writing commands are considered a code smell. Each
write command uses its own transaction; a caller failure does not roll back a nested command
that already committed.
