# Changesets

Run `pnpm changeset` for changes that affect a published package. Select each affected package and
explain its user-visible change. Packages have independent versions.

The release workflow opens a version pull request on `main`. Merging that pull request automatically
publishes unpublished versions after the quality and package checks pass. The initial changeset
prepares both packages for `0.1.0`.

See [release setup](../README.md#releasing) before the first release. Do not run `pnpm release` merely
to check a package: it publishes to npm. Use `pnpm build && pnpm pack:check` for a local check.
