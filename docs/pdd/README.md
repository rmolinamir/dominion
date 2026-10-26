# Dominion Preliminary Design Document

## Purpose and Status

This document explores how the [vision](../vision.md) translates into a framework consumer API.
It is preliminary and nonbinding. It records the latest discussion direction while keeping
unresolved choices explicit. Code examples are sketches, not implemented interfaces.

## Current Model

Explicit `defineDomain` objects compose existing definitions into typed interfaces. Passive
`defineContext` objects compose domains. A host such as NestJS uses those definitions and owns controllers, dependency
composition, and application lifecycle.

Executable commands combine operation definition and behavior. Aggregates provide the write
boundary, including owned child entities and concurrency checks. ALS-backed execution hooks
make transactions and providers available within commands.

All events are public. Handlers raise them directly, and receivers declare reactions. An
analyzer discovers relationships from ordinary TypeScript without duplicate emission lists
or an effects DSL. Diagnostic strictness is configurable.

Persistence, durability, queue topology, and observability integrations use adapters. Event
wire identity encoding, versioning, and the host invocation interface remain open. Each write
command has an independent transaction, including nested commands.

## Sections

- [Introduction](001-introduction.md)
- [User Stories](002-user-stories.md)
- [Core Concepts](003-core-concepts.md)
- [Runtime Model](004-runtime-model.md)
- [Host Integration](005-application-services.md)
- [Repositories](006-repositories.md)
- [Infrastructure](007-infrastructure.md)
- [Observability](008-observability.md)
- [AI Integrations](009-ai-integrations.md)
- [Open Questions](010-open-questions.md)

The initial package implementation and adapter roadmap are described in [Package Structure](../packages.md).
