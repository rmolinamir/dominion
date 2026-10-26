import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = mkdtempSync(join(tmpdir(), 'dominion-pack-'))
const packageNames = ['@atomly/dominion-core', '@atomly/dominion-node']

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = [error.stdout, error.stderr].filter(Boolean).join('\n')
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}.\n${detail}`, { cause: error })
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

try {
  const tarballs = []
  for (const name of packageNames) {
    const directory = name.endsWith('-core') ? 'core' : 'node'
    const packed = join(temporary, directory)
    mkdirSync(packed)
    run('pnpm', ['pack', '--pack-destination', packed], join(root, 'packages', directory))
    const archives = readdirSync(packed).filter((file) => file.endsWith('.tgz'))
    assert.equal(archives.length, 1, `${name}: expected exactly one pnpm pack tarball`)
    const archive = join(packed, archives[0])
    const files = run('tar', ['-tzf', archive], packed).trim().split('\n')
    const contents = files.filter((file) => !file.endsWith('/'))
    for (const file of files) {
      assert(
        file.startsWith('package/') && !file.split('/').includes('..'),
        `${name}: invalid archive path ${file}`,
      )
    }
    for (const file of contents) {
      assert(
        /^package\/(?:package\.json|README\.md|LICENSE|CHANGELOG\.md|dist\/.+\.(?:js|d\.ts)(?:\.map)?)$/.test(
          file,
        ),
        `${name}: unexpected packed file ${file}; ship only dist JavaScript, declarations, maps, and package docs`,
      )
    }
    for (const file of contents.filter((entry) => entry.startsWith('package/dist/'))) {
      assert(
        !/(?:^|\/)(?:src|test|tests|__tests__|fixtures)(?:\/|$)|\.(?:test|spec|config)\./.test(
          file,
        ),
        `${name}: source, test, or configuration file leaked into dist: ${file}`,
      )
    }
    run('tar', ['-xzf', archive, '-C', packed], packed)
    for (const file of contents.filter((entry) => entry.endsWith('.map'))) {
      const map = readJson(join(packed, file))
      assert(
        !map.sourcesContent?.some((source) => source !== null),
        `${name}: source map embeds source code: ${file}`,
      )
    }
    const manifest = readJson(join(packed, 'package/package.json'))
    assert.equal(manifest.name, name, `${name}: incorrect packed package name`)
    assert.equal(manifest.type, 'module', `${name}: package must use ESM`)
    assert.equal(manifest.license, 'MIT', `${name}: expected MIT license`)
    assert.notEqual(manifest.private, true, `${name}: public package is marked private`)
    assert.equal(manifest.publishConfig?.access, 'public', `${name}: publish access must be public`)
    assert(!JSON.stringify(manifest).includes('workspace:'), `${name}: unresolved workspace: range`)
    for (const required of ['README.md', 'LICENSE']) {
      assert(contents.includes(`package/${required}`), `${name}: missing ${required} in tarball`)
    }
    const expectedExports = directory === 'core' ? ['.'] : ['.', './testing']
    assert.deepEqual(
      Object.keys(manifest.exports).sort(),
      expectedExports.sort(),
      `${name}: exports changed; update the consumer check`,
    )
    for (const [subpath, conditions] of Object.entries(manifest.exports)) {
      assert.equal(
        Object.keys(conditions)[0],
        'types',
        `${name}${subpath}: types condition must be first`,
      )
      for (const [condition, extension] of [
        ['types', '.d.ts'],
        ['import', '.js'],
      ]) {
        const target = conditions[condition]
        assert(
          typeof target === 'string' && target.startsWith('./dist/') && target.endsWith(extension),
          `${name}${subpath}: ${condition} must point to dist/${extension}`,
        )
        assert(
          contents.includes(`package/${target.slice(2)}`),
          `${name}${subpath}: missing export ${target}; run pnpm build first`,
        )
      }
    }
    tarballs.push(archive)
    console.log(`Checked ${name}: ${contents.length} packed files`)
  }

  const consumer = join(temporary, 'consumer')
  mkdirSync(consumer)
  const nodeTypesVersion = readJson(join(root, 'node_modules/@types/node/package.json')).version
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      ...tarballs,
      `@types/node@${nodeTypesVersion}`,
    ],
    consumer,
  )
  writeFileSync(
    join(consumer, 'check.mjs'),
    `
import assert from 'node:assert/strict'
import * as core from '@atomly/dominion-core'
import * as node from '@atomly/dominion-node'
import * as testing from '@atomly/dominion-node/testing'
for (const name of ['defineAggregate', 'defineCommand', 'defineEvent', 'defineDomain', 'defineContext']) {
  assert.equal(typeof core[name], 'function', 'Missing core export: ' + name)
}
for (const name of ['execute', 'raise', 'useTransaction', 'useLogger', 'createProviderToken', 'useProvider']) {
  assert.equal(typeof node[name], 'function', 'Missing Node export: ' + name)
}
assert.equal(typeof testing.createMemoryStore, 'function')
`,
  )
  run(process.execPath, ['check.mjs'], consumer)
  writeFileSync(
    join(consumer, 'check.ts'),
    `
import { defineContext, defineDomain } from '@atomly/dominion-core'
import { execute, createProviderToken, useProvider } from '@atomly/dominion-node'
import { createMemoryStore } from '@atomly/dominion-node/testing'
const domain = defineDomain('consumer', {})
const context = defineContext('consumer', { domains: { domain } })
const name: string = context.domains.domain.name
const store = createMemoryStore()
const transactions = store.transactions
void [name, transactions, execute, createProviderToken, useProvider]
`,
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ['node'],
      },
      files: ['check.ts'],
    }),
  )
  run(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(consumer, 'tsconfig.json')],
    consumer,
  )
  console.log(
    'Clean consumer: core, node, and node/testing imports and TypeScript declarations passed',
  )
} catch (error) {
  console.error(`Package check failed: ${error.message}`)
  process.exitCode = 1
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
