/**
 * Consumes the kit the way an OUTSIDER does, from a packed tarball.
 *
 * WHY THIS EXISTS. @usequeek/theme-kit@0.1.0 was published and was broken for
 * every external consumer:
 *
 *     node_modules/@usequeek/theme-kit/provider.tsx(58,5):
 *     error TS2503: Cannot find namespace 'JSX'.
 *
 * 42 modules annotated returns as `JSX.Element`, relying on a GLOBAL JSX
 * namespace that came from a host app's `next-env.d.ts` — not from React.
 * Inside a host app the kit free-rode on that file, so tsc, the tests, the
 * build and the render smoke were ALL green. The workspace supplies exactly the
 * file whose absence is the bug, which is why no in-repo check could ever have
 * found it. (Every module now does `import type { JSX } from 'react'`, and this
 * script proves it.)
 *
 * It packs the CURRENT SOURCE rather than installing the published version, so
 * it fails before a broken version ships instead of after. Installing from the
 * registry would only ever test the last release.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The kit package is `"type": "module"`, so `__dirname` does not exist here.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = ROOT;

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main(): void {
  const sandbox = mkdtempSync(join(tmpdir(), 'kit-consumer-'));
  let failed = false;

  try {
    const kitPkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf-8')) as {
      name: string; version: string; peerDependencies?: Record<string, string>;
    };

    console.log(`verify-package: packing ${kitPkg.name}@${kitPkg.version} and consuming it as an outsider`);
    run('npm', ['pack', '--pack-destination', sandbox], KIT);
    const tarball = readdirSync(sandbox).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error('npm pack produced no tarball');

    // Peers are declared by the kit; pin the ones the fixture needs to compile.
    const peers = kitPkg.peerDependencies ?? {};
    writeFileSync(join(sandbox, 'package.json'), JSON.stringify({
      name: 'kit-consumer', private: true, version: '1.0.0',
      dependencies: {
        [kitPkg.name]: `file:./${tarball}`,
        '@queekai/client-sdk': peers['@queekai/client-sdk'] ?? '*',
        next: '^16.0.0', react: '^19.0.0', 'react-dom': '^19.0.0',
      },
      devDependencies: { typescript: '^5', '@types/react': '^19', '@types/react-dom': '^19', '@types/node': '^22' },
    }, null, 2));

    // `bundler` resolution + no ambient Next types — exactly what a theme
    // developer's own project looks like. NOT this repo's tsconfig.
    writeFileSync(join(sandbox, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], jsx: 'react-jsx',
        module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true,
        skipLibCheck: true, esModuleInterop: true, isolatedModules: true,
      },
      include: ['app/**/*.ts', 'app/**/*.tsx'],
    }, null, 2));

    mkdirSync(join(sandbox, 'app'), { recursive: true });
    writeFileSync(join(sandbox, 'app/theme.tsx'), readFileSync(join(ROOT, 'tests/fixtures/external-theme.tsx'), 'utf-8'));

    console.log('verify-package: installing from the tarball…');
    run('npm', ['install', '--no-audit', '--no-fund'], sandbox);

    console.log('verify-package: typechecking a real theme against it…');
    try {
      run(join(sandbox, 'node_modules/.bin/tsc'), ['--noEmit'], sandbox);
      console.log(`\n✓ ${kitPkg.name} is consumable from outside this repo.`);
    } catch (error) {
      const out = (error as { stdout?: string; stderr?: string });
      console.error('\n✗ the packed kit does NOT work for an external consumer:\n');
      console.error((out.stdout ?? '') + (out.stderr ?? ''));
      console.error('Errors inside node_modules/@usequeek/theme-kit are PACKAGE bugs — the kit is');
      console.error('relying on something only this repo provides. Errors in app/theme.tsx mean the');
      console.error('fixture drifted from the real API.');
      failed = true;
    }
  } catch (error) {
    console.error('✗ verify-package failed to run:', (error as Error).message);
    failed = true;
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }

  process.exit(failed ? 1 : 0);
}

main();
