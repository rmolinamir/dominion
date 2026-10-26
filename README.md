# Dominion

Dominion is a domain-first TypeScript library. Define aggregates, commands, events, and catalogs in
`@atomly/dominion-core`. Execute commands in Node.js with `@atomly/dominion-node`.

The initial implementation includes Standard Schema validation, aggregate invariants, optimistic
concurrency, execution hooks, and an in-memory testing adapter. It does not yet include Postgres,
Redis, Express integrations, durable event delivery, or an analyzer. See [packages](docs/packages.md)
for the boundary between definitions and execution. The [design documents](docs/pdd/README.md)
describe a broader direction, including features that are not implemented yet.

## Getting started

Requires Node.js 22.20.0 or later. Packages are ESM-only. After the first public release:

```sh
pnpm add @atomly/dominion-core @atomly/dominion-node zod
```

Zod is one example of a Standard Schema implementation. Dominion does not require Zod itself.

```ts
import { defineAggregate, defineCommand, defineEvent } from '@atomly/dominion-core'
import { execute, raise } from '@atomly/dominion-node'
import { createMemoryStore } from '@atomly/dominion-node/testing'
import { z } from 'zod'

const Counter = defineAggregate('Counter')
  .schema(z.object({ id: z.string(), count: z.number().int().nonnegative() }))
  .id((state) => state.id)

const CounterIncremented = defineEvent('CounterIncremented').schema(
  z.object({ id: z.string(), count: z.number().int() }),
)

const increment = defineCommand('increment')
  .input(z.object({ id: z.string() }))
  .aggregate(Counter)
  .target((input) => input.id)
  .handle((_input, state) => {
    state.count += 1
    raise(CounterIncremented, { id: state.id, count: state.count })
    return state.count
  })

const memory = createMemoryStore()
memory.seed(Counter, { id: 'counter-1', count: 0 })

const result = await execute(
  increment,
  { id: 'counter-1' },
  {
    transactions: memory.transactions,
  },
)
if (result.ok) {
  console.log(result.value) // 1
  console.log(result.events[0]?.type) // CounterIncremented
}
console.log(memory.inspect(Counter, 'counter-1')?.state.count) // 1
```

The memory store is for tests and examples. Raised events appear in the successful result after
commit. Dominion does not persist or dispatch them. Commands operate on an existing aggregate.
Each call to `execute`, including a nested call, uses an independent transaction.

## Development

Use pnpm 10.12.4 and Node.js 22.20.0 or later:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs OXC lint and formatting checks, the build, strict TypeScript checks, Vitest,
and package artifact checks.
`pnpm pack:check` requires built packages. It inspects real pnpm tarballs, installs them in a clean
temporary consumer, and checks ESM imports and TypeScript declarations. It never publishes.
The consumer install needs npm registry access for dependencies. Temporary files are removed on exit.

## Releasing

Packages use independent versions with Changesets 3. Run `pnpm changeset` when a change affects a
published package. Commit the generated file with the change. The initial changeset bumps both
packages from `0.0.0` to `0.1.0`.

On a push to `main`, [release.yml](.github/workflows/release.yml) opens or updates a version pull
request. Review its versions, changelogs, and lockfile, then merge it. The next run checks and builds
the packages, checks the tarballs, and automatically publishes unpublished versions to public npm.
Only the publish job receives OIDC permission. Git tags and GitHub Releases are disabled, so that job
needs only read access to repository contents. A manual run on `main` can retry a failed release.

The workflow pins the Changesets v3-compatible action at v2.1.2. Its separate version, pack, and
publish actions follow the [Changesets automation guide](https://changesets.dev/guide/automating).
`pnpm version-packages` updates versions and the lockfile locally. `pnpm release` builds and publishes
from your machine using your npm authentication. It is not a dry run.

Before the first automated publish, a maintainer must complete these prerequisites:

1. Verify npm ownership or publishing rights for the `@atomly` scope and both package names.
   GitHub access to `rmolinamir/dominion` does not establish npm ownership. Scope control is not verified.
2. Create or bootstrap `@atomly/dominion-core` and `@atomly/dominion-node` as public packages under
   maintainer authentication if npm requires an initial publish before package settings exist.
   Coordinate those initial versions with the version pull request. Do not publish `0.0.0` by accident.
3. For **each** package, configure an npm trusted publisher: GitHub owner `rmolinamir`, repository
   `dominion`, workflow filename `release.yml`, and no environment name. Enable the allowed action
   **npm publish**, since the workflow publishes directly. It does not use staged publishing.
4. Enable **Allow GitHub Actions to create and approve pull requests** in the repository's
   **Settings → Actions → General**. Repository rules must allow the version pull request to merge.
   Pull requests created with the default GitHub token do not automatically trigger other workflows.
   If required checks are missing, use GitHub's documented token/workflow options before merging.
5. Complete the first trusted publish while its npm configuration is valid. npm currently requires
   validation within two days. Use GitHub-hosted runners. The workflow installs npm 11.5.1 with
   Node.js 24, which satisfies npm's trusted-publishing requirements.

See [npm's trusted publishing instructions](https://docs.npmjs.com/trusted-publishers/) for package
settings, bootstrap constraints, and current requirements. No npm token is stored in this workflow.
No packages were published as part of this setup.

## License

[MIT](LICENSE).
