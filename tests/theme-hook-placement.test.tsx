/**
 * Hook-placement rule for the checkout / auth / blog components.
 *
 * Rule: every `useThemeStrings()` call must sit at the top level of a
 * PascalCase component or a `use*` hook: no enclosing if / ternary / loop /
 * try / switch / && / ||, no early return before it, and never nested inside
 * another function (e.g. a `.map` callback). Violations break the Rules of
 * Hooks and silently untranslate strings, so this test FAILS when broken.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Files that use theme strings: each must call useThemeStrings() exactly once.
const EXPECTED_FILES = [
  'components/checkout/checkout-contact.tsx',
  'components/checkout/default-checkout-shell.tsx',
  'components/checkout/policy-links.tsx',
  'components/auth/auth-email-login-step.tsx',
  'components/auth/auth-email-otp-step.tsx',
  'components/auth/auth-email-otp-verify-step.tsx',
  'components/auth/auth-email-register-step.tsx',
  'components/auth/auth-signup-step.tsx',
  'components/blog/category-filter.tsx',
  'components/blog/pagination.tsx',
  'components/blog/post-meta.tsx',
  'components/blog/related-posts.tsx',
  'components/blog/share-buttons.tsx',
  'hooks/use-auth-flow.tsx',
];

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listTsx(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const NAME_RE = /^[A-Z][A-Za-z0-9]*$|^use[A-Z]/;

interface CallSite {
  file: string;
  line: number;
  problems: string[];
}

function enclosingName(fn: ts.Node): string | null {
  if (ts.isFunctionDeclaration(fn)) return fn.name?.text ?? null;
  if (ts.isMethodDeclaration(fn)) return ts.isIdentifier(fn.name) ? fn.name.text : null;
  if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent)) {
    return fn.parent.name.getText();
  }
  return null;
}

function isTopLevelFunction(fn: ts.Node): boolean {
  if (ts.isFunctionDeclaration(fn)) return ts.isSourceFile(fn.parent);
  if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
    return (
      ts.isVariableDeclaration(fn.parent) &&
      ts.isVariableDeclarationList(fn.parent.parent) &&
      ts.isVariableStatement(fn.parent.parent.parent) &&
      ts.isSourceFile(fn.parent.parent.parent.parent)
    );
  }
  return false;
}

function checkFile(rel: string): CallSite[] {
  const src = readFileSync(join(kitRoot, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sites: CallSite[] = [];
  const stack: ts.Node[] = [];

  function pushFn(node: ts.Node): void {
    stack.push(node);
    ts.forEachChild(node, visit);
    stack.pop();
  }

  function visit(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      pushFn(node);
      return;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useThemeStrings'
    ) {
      const problems: string[] = [];
      const enclosing = stack.length > 0 ? stack[stack.length - 1] : null;
      if (!enclosing || stack.length !== 1) {
        problems.push('not directly inside one top-level function (nested callback?)');
      } else {
        const name = enclosingName(enclosing);
        if (!name || !NAME_RE.test(name)) problems.push(`enclosing function '${name ?? '<anonymous>'}' is not a PascalCase component or use* hook`);
        if (!isTopLevelFunction(enclosing)) problems.push('enclosing function is not a module top-level declaration');
        let p: ts.Node = node.parent;
        while (p && p !== enclosing) {
          if (
            ts.isIfStatement(p) ||
            ts.isConditionalExpression(p) ||
            ts.isForStatement(p) ||
            ts.isForInStatement(p) ||
            ts.isForOfStatement(p) ||
            ts.isWhileStatement(p) ||
            ts.isDoStatement(p) ||
            ts.isTryStatement(p) ||
            ts.isCatchClause(p) ||
            ts.isSwitchStatement(p) ||
            ts.isCaseClause(p) ||
            ts.isDefaultClause(p) ||
            (ts.isBinaryExpression(p) &&
              (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                p.operatorToken.kind === ts.SyntaxKind.BarBarToken))
          ) {
            problems.push(`conditionally enclosed by ${ts.SyntaxKind[p.kind]}`);
            break;
          }
          p = p.parent;
        }
        const body = (enclosing as ts.FunctionLikeDeclaration).body;
        if (body && ts.isBlock(body)) {
          let host: ts.Node = node;
          while (host.parent && host.parent !== body) host = host.parent;
          for (const stmt of body.statements) {
            if (stmt === host) break;
            if (ts.isReturnStatement(stmt)) {
              problems.push('an early return precedes the hook call');
              break;
            }
          }
        }
      }
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      sites.push({ file: rel, line: line + 1, problems });
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return sites;
}

const scopeFiles = listTsx(join(kitRoot, 'components'))
  .concat(listTsx(join(kitRoot, 'hooks')))
  .map((f) => f.slice(kitRoot.length + 1));

describe('useThemeStrings() placement (Rules of Hooks)', () => {
  it('every migrated file calls useThemeStrings() exactly once', () => {
    for (const rel of EXPECTED_FILES) {
      expect(checkFile(rel).length, `${rel}: expected exactly one call`).toBe(1);
    }
  });

  it('every call in components/ + hooks/ is top-level in a component or hook', () => {
    const bad: string[] = [];
    for (const rel of scopeFiles) {
      for (const site of checkFile(rel)) {
        for (const problem of site.problems) bad.push(`${site.file}:${site.line}: ${problem}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
