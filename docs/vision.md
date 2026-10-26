# Dominion: Vision and Principles

## The Problem Space

In the current Node.js landscape, event-driven architecture will be powerful but often fragmented. Many solutions will focus on infrastructure primitives (brokers, queues, SDKs) or web frameworks, while the business layer ends up expressed indirectly—spread across controllers, handlers, workers, and glue code. The result will be systems that “work,” but don’t clearly communicate what they are *for*, what constraints they must respect, or why they behave the way they do.

Node.js backends will also commonly center around a request-driven shape: a network request arrives, the system performs most of the work within that boundary, and application structure grows around that rhythm. Once the business requires longer-running processes, retries, background work, cross-boundary orchestration, and eventual consistency, teams will often reach for one-off patterns. Over time, the codebase will become a collection of “places where things happen,” rather than a coherent model of the domain.

Event-driven systems will add another layer of difficulty: **time becomes part of the design**. Ordering, causality, partial failure, and “what should happen next” become explicit concerns. Without strong conventions and visibility, it becomes hard to answer basic questions like: *why did this happen, what triggered it, and what trade-offs did we choose?*

### Code Getting Cheaper Won’t Remove the Hard Part

As producing code becomes faster, the hard part will shift even more toward **making changes safely**.

The bottleneck will not be syntax. It will be:

* capturing intent and constraints in the codebase
* making boundaries explicit
* preserving invariants (“things that must never happen”)
* documenting trade-offs through structure

When creating code becomes easy, creating coupling becomes easy too. Without deliberate design constraints, systems will accumulate accidental dependencies faster. That increases the cost of change even if implementation is quick, because every change risks unintended effects across the system.

### Generic CRUD Won’t Carry Domain Meaning

CRUD language describes state transitions in the abstract (“created/updated”), but it often fails to explain the actual behavior of the business. It can leave the workflow living in people’s heads instead of in the system.

A business-oriented vocabulary (“OrderDispatched”, “VehicleArrived”, “Loaded”, “Departed”, “Delivered”) encodes intent and preserves the narrative of what happened. That narrative matters for humans, tests, audits, debugging, and automation. Without it, systems may store the “what,” but lose the “why.”

## The Opportunity with AI

AI will amplify the quality of the context it is given.

If a codebase encodes domain language, constraints, and boundaries clearly, AI will have the raw material needed to assist with safer changes—because the system’s intent and design limitations will be discoverable. If the system is mostly implicit workflow and infrastructure glue, AI will generate more of the same quickly, which can accelerate coupling and brittle design.

The goal will not be to chase AI trends. The goal will be to build software that is easy to understand and change. AI benefits will follow as a consequence of clearer context.

## Our Solution

This framework will put **language and domain** first while treating asynchronous behavior as a normal design concern instead of a bolt-on.

It will provide a consistent way to model and implement systems such that:

* business intent will be explicit in the codebase
* workflows will be expressed through domain vocabulary (not generic CRUD)
* boundaries will be clearer, reducing accidental coupling
* asynchronous execution will be legible rather than ad-hoc
* traceability will preserve the system’s story across time

## What We Mean by Language

*Language* will mean the shared vocabulary used by business and engineers to describe the domain—terms like “Invoice”, “Refund”, “Dispute”, “Eligibility”, “Subscription”, “Settlement”. This is also known as the [*Ubiquitous Language*](https://martinfowler.com/bliki/UbiquitousLanguage.html).

In this framework, language will be treated as a constraint:

* **Encoded in code**: message names, types, domain model names, and use-case naming
* **Consistent within boundaries**: terms won’t drift in meaning inside a context
* **Boundary-preserving**: if language differs, it will reflect different contexts, not ambiguity

This will be one of the primary mechanisms for capturing context and controlling coupling.

## Core Principles

### Language at the Core

The system will be designed around explicit business language. Commands, events, and queries will carry domain meaning—intent, facts, and questions—so the code communicates what the system does and why.

### Guardrails over Flexibility

The framework will be intentionally opinionated. Conventions will reduce ambiguity and keep systems coherent as they grow. Constraints will be treated as a feature because they prevent silent coupling and “anything goes” designs.

### Context over Volume

The framework will optimize for preserving context: invariants, intent, boundaries, and trade-offs. It will aim to make behavioral change safer, not merely make implementation faster.

### Managing Coupling through Boundaries

The framework will encourage boundaries that preserve meaning and avoid concept conflation (e.g., treating “payments” and “invoices” as separate concerns). Boundaries and language will be the main tools for controlling coupling.

### Traceability by Default

Async systems become difficult when the narrative disappears. The framework will treat traceability and observability as foundational so cause, intent, and flow remain visible across time.

### Modular Adoption

The framework will be valuable for small projects and scale upward. Teams won’t be required to adopt every capability immediately to gain structure and clarity.

## The Framework

The framework will be designed with a domain-first approach, focusing on making domain logic intuitive and clear. At its core, it will emphasize the use of **commands** to express intended actions, **events** to capture what has occurred, and **queries** to request information. The framework’s primary job will be to make these concepts feel natural in application code and aligned with business language.

We will also not re-implement HTTP frameworks or compete with Express/Fastify/Hono/etc. Applications will run inside the server framework of their choice, while this framework focuses on executable operations and domain modeling. Where needed, it will integrate cleanly with existing servers and the networking realities of event-driven systems.

### Messages

* **Commands** will express intent: what the system should do.
* **Events** will express facts: what happened in the domain.
* **Queries** will express questions: what we want to know.

These message types will serve as the primary mechanism for encoding domain workflows and preserving intent in the codebase.

### Domains and Contexts

Explicit domain composition will collect related definitions and preserve their inferred types.
A passive context definition will
compose multiple domains. Hosts such as NestJS will use those definitions and own server
startup, controllers, and infrastructure lifecycle.

A framework domain will group related models and operations. It will not automatically imply
a DDD subdomain, bounded context, or deployment. Reusing domains across contexts will remain
possible, even when it indicates a design smell.

### Executable Operations

Commands will combine input definition and executable behavior. A separate command handler
and forwarding application service will not be required. Execution timing will be independent
of the operation's business responsibility.

### Domain Modeling

Entities will express identity. Aggregates will define consistency boundaries around roots
and owned child entities. Commands will preserve aggregate invariants, and persistence will
protect writes against concurrency conflicts.

### Public Events and Analysis

All event definitions will be public. Handlers will raise events directly without duplicate
emission or publication lists. Event identity will survive local symbol renames. Wire identity
encoding and versioning remain design questions.

An analyzer will discover relationships in ordinary TypeScript. Explicit domain composition
will supply the definition catalog. Diagnostics will be configurable, and unresolved
relationships will remain explicit rather than being presented as a complete graph.

### Temporal Decoupling as a First-Class Concept

The framework will treat temporal decoupling as a core architectural concept. Some business operations will happen immediately; others will be naturally asynchronous due to latency, workflow length, reliability requirements, or cross-boundary interaction. The framework will make this distinction explicit and legible in the application design.

### Dependency Management

The framework will integrate with host dependency management. Execution-scoped hooks will make providers, logging, and transactions available through AsyncLocalStorage. Host integration and provider lifetimes remain design questions.

### Observability and Traceability

The framework will include first-class concepts for traceability so message flows remain understandable:

* clear lineage between messages (what caused what)
* a consistent narrative across commands, events, and handlers over time
* support for modern tracing standards and tooling

Durability, transaction implementation, and queue topology will remain behind adapters. Their
guarantees must be explicit without exposing infrastructure mechanics throughout domain code.
