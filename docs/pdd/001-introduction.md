# Introduction

This preliminary design explores the [vision](../vision.md) through a consumer API centered on
explicit domain language. It remains nonbinding, and its examples are not implementation contracts.

The latest direction uses explicit typed domain composition, passive contexts, executable
commands, aggregates, public events, and an analyzer. It supersedes the earlier required
application-service and separate command-handler layers.

Hosts such as NestJS own startup, controllers, and infrastructure integration. Contexts remain
definitions. The [open questions](010-open-questions.md) distinguish unresolved choices from
the current direction.
