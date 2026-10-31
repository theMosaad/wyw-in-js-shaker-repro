import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = import.meta.dirname;
const variants = [
  { name: '2.3.1', good: true },
  { name: '2.4.0', good: false },
  { name: '2.7.0', good: false },
  { name: '2.7.0-patched', label: '2.7.0 + patch', good: true },
];

for (const { name } of variants) {
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--silent'], { cwd: path.join(root, 'variants', name), stdio: 'inherit' });
}

let mismatches = 0;
const check = (actual, expected) => {
  if (actual === expected) return actual;
  mismatches += 1;
  return `${actual} (expected ${expected})`;
};
const node = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, SESSION_SECRET: '' } });
  const out = (r.stdout ?? '').trim();
  const shaking = args[0] === 'scripts/shake.mjs';
  const status = shaking || out.startsWith('PASS') ? 0 : out.startsWith('FAIL') ? 1 : null;
  if (!out || r.error || r.signal || r.status !== status) {
    mismatches += 1;
    console.error(`unexpected exit from node ${args.join(' ')}: status ${r.status}, signal ${r.signal}, ${r.error ?? 'no spawn error'}\n${r.stderr}`);
  }
  return { out, err: r.stderr ?? '' };
};
const transform = (name, file, options) => node(['scripts/transform.mjs', `variants/${name}`, file, ...(options ? [typeof options === 'string' ? options : JSON.stringify(options)] : [])]);
const shake = (name, file, only) => node(['scripts/shake.mjs', `variants/${name}`, file, only]).out;
const fallbacks = (err) => [...err.matchAll(/Runtime require\(\) fallback during eval\nimporter: .*\nsource: +(\S+)/g)].map((m) => m[1]).join(', ') || 'none';
const cell = (s) => `\`${s.replace(/^PASS css: /, '').replace(/\n/g, ' ')}\``;

const fontError = "FAIL Error: The requested module 'next/font/google' does not provide an export named 'Montserrat'";
const label = ({ name, label: l = name }) => l;

console.log('## 1. transform() on src/page.js and src/page-pure.js (same page with /*#__PURE__*/ on all three calls)\n');
console.log('| @wyw-in-js/transform | page.js | page-pure.js | runtime require() fallbacks |');
console.log('|---|---|---|---|');
for (const v of variants) {
  const page = transform(v.name, 'page.js');
  const pure = transform(v.name, 'page-pure.js');
  const fb = fallbacks(page.err);
  console.log(`| ${label(v)} | ${cell(check(page.out, v.good ? 'PASS css: .tqf911m{padding:8px;}' : fontError))} | ${cell(check(pure.out, v.good ? 'PASS css: .tks3sc3{padding:8px;}' : fontError))} | ${check(fb, v.good ? 'none' : 'next/font/google')} |`);
}

console.log('\n## 2. Mutations that eval has to keep, through transform()\n');
console.log('For `src/palette-page.js` the correct result is `color:blue` and `color:green` (2.3.1 drops `q.setColor(\'green\')`, 2.4.0 fixed it). For `src/theme-page.js` the correct result is `color:blue` (`setTheme(\'blue\')` changes what the imported `getColor()` returns).\n');
console.log('| @wyw-in-js/transform | palette-page.js | theme-page.js |');
console.log('|---|---|---|');
for (const v of variants) {
  const palette = transform(v.name, 'palette-page.js').out;
  const theme = transform(v.name, 'theme-page.js').out;
  const paletteExpected = `.ajy1lj3{color:blue;} .c1yjufee{color:${v.name === '2.3.1' ? 'red' : 'green'};}`;
  const themeExpected = `.tev6j9o{color:${v.good ? 'red' : 'blue'};}`;
  const rules = (s) => [...s.matchAll(/\.\w+\{[^}]*\}/g)].map((m) => m[0]).sort().join(' ');
  console.log(`| ${label(v)} | \`${check(rules(palette), paletteExpected)}\` | \`${check(rules(theme), themeExpected)}\` |`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wyw-shake-'));
const diff = (a, b, labels) => {
  fs.writeFileSync(path.join(tmp, 'a.js'), `${a}\n`);
  fs.writeFileSync(path.join(tmp, 'b.js'), `${b}\n`);
  return spawnSync('diff', ['-u', '--label', labels[0], '--label', labels[1], path.join(tmp, 'a.js'), path.join(tmp, 'b.js')], { encoding: 'utf8' }).stdout.trim();
};
const shakes = [
  ['preeval/page.js', '__wywPreval', ['require("./tokens")', 'const _exp = () => (space(2));', 'exports.__wywPreval ='], ['require("next/font/google")', 'Montserrat({', 'require("./with-session")', "withSession(withUser('/login'))"]],
  ['preeval/destructure.js', 'color', ["exports.color = 'red'"], ['require("@reduxjs/toolkit")', 'createSlice({', 'slice.actions']],
];
for (const [i, [file, only, always, onlyBad]] of shakes.entries()) {
  const out = Object.fromEntries(variants.map(({ name }) => [name, shake(name, file, only)]));
  console.log(`\n## 3${'ab'[i]}. oxcShaker on ${file}, onlyExports=['${only}'] (2.4.0 = 2.7.0, 2.7.0 + patch = 2.3.1)\n`);
  const same = { '2.4.0 = 2.7.0': out['2.4.0'] === out['2.7.0'], '2.7.0 + patch = 2.3.1': out['2.7.0-patched'] === out['2.3.1'] };
  for (const [what, ok] of Object.entries(same)) if (check(ok, true) !== true) console.log(`MISMATCH: ${what} is false`);
  for (const v of variants) {
    for (const text of always) if (check(out[v.name].includes(text), true) !== true) console.log(`MISMATCH: ${label(v)} drops ${text}`);
    for (const text of onlyBad) if (check(out[v.name].includes(text), !v.good) !== !v.good) console.log(`MISMATCH: ${label(v)} ${v.good ? 'keeps' : 'drops'} ${text}`);
  }
  console.log('```diff');
  console.log(diff(out['2.3.1'], out['2.7.0'], ['2.3.1', '2.7.0']));
  console.log('```');
}

console.log('\n## 4. oxcShaker on two more inputs\n');
console.log("`preeval/page-local.js` is `preeval/page.js` with `space` declared in the file (onlyExports=['__wywPreval']). `preeval/abrupt.js` is `const { a } = null;` before `export const color` (onlyExports=['color']).\n");
console.log('| @wyw-in-js/transform | page-local.js: imports kept | abrupt.js: `const { a } = null` |');
console.log('|---|---|---|');
for (const v of variants) {
  const local = shake(v.name, 'preeval/page-local.js', '__wywPreval');
  for (const text of ['const space = (n) =>', 'const _exp = () => (space(2));', 'exports.__wywPreval =']) if (check(local.includes(text), true) !== true) console.log(`MISMATCH: ${label(v)} page-local.js drops ${text}`);
  const imports = [...local.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]).join(', ') || 'none';
  const abrupt = shake(v.name, 'preeval/abrupt.js', 'color').includes('= null') ? 'kept' : 'dropped';
  console.log(`| ${label(v)} | ${check(imports, 'none')} | ${check(abrupt, v.good ? 'dropped' : 'kept')} |`);
}

const cases = fs.readFileSync(path.join(root, 'preeval/cases/cases.txt'), 'utf8').trim().split('\n').map((line) => {
  const [name, only, want, ...text] = line.split(' ');
  return { name, only, want, text: text.join(' ') };
});
const droppedBy231 = new Set(['call', 'arg', 'import-arg', 'cross', 'theme-call']);
const droppedByPatch = new Set(['theme-call', 'alias-mut']);
console.log('\n## 5. oxcShaker on preeval/cases/*.js: statements that must stay (keep) or go (drop)\n');
console.log(`| case | onlyExports | statement | want | ${variants.map(label).join(' | ')} |`);
console.log(`|---|---|---|---|${variants.map(() => '---').join('|')}|`);
for (const c of cases) {
  const cells = variants.map((v) => {
    const kept = shake(v.name, `preeval/cases/${c.name}.js`, c.only).includes(c.text) ? 'keep' : 'drop';
    const wrong = (c.want === 'drop' && ['2.4.0', '2.7.0'].includes(v.name)) || (v.name === '2.3.1' && droppedBy231.has(c.name)) || (v.name === '2.7.0-patched' && droppedByPatch.has(c.name));
    const expected = wrong ? (c.want === 'keep' ? 'drop' : 'keep') : c.want;
    if (check(kept, expected) !== expected) console.log(`MISMATCH: ${label(v)} ${c.name} ${kept}, expected ${expected}`);
    return kept === c.want ? kept : `**${kept}**`;
  });
  console.log(`| ${c.name} | ${c.only} | \`${c.text}\` | ${c.want} | ${cells.join(' | ')} |`);
}

const mock = (file) => path.join(root, 'mocks', file);
const workarounds = [
  ["importOverrides: { 'next/font/google': { mock } }", { importOverrides: { 'next/font/google': { mock: mock('next-font-google.js') } } }, 'FAIL Error: SESSION_SECRET is not set'],
  ["  + { './src/with-session.js': { mock } }", { importOverrides: { 'next/font/google': { mock: mock('next-font-google.js') }, './src/with-session.js': { mock: mock('with-session.js') } } }, 'PASS css: .tqf911m{padding:8px;}'],
  ["codeRemover.hocs: { 'next/font/google': ['Montserrat'] }", { codeRemover: { hocs: { 'next/font/google': ['Montserrat'] } } }, 'FAIL Error: SESSION_SECRET is not set'],
  ["  + { './with-session': ['withSession'] }", { codeRemover: { hocs: { 'next/font/google': ['Montserrat'], './with-session': ['withSession'] } } }, 'PASS css: .tqf911m{padding:8px;}'],
  ["staticBindings: { './tokens': { space } } (options/static-bindings.mjs)", 'options/static-bindings.mjs', 'PASS css: .tqf911m{padding:8px;}'],
];
console.log('\n## 6. Workarounds on unpatched 2.7.0 (src/page.js)\n');
console.log('| pluginOptions | output |');
console.log('|---|---|');
for (const [text, options, expected] of workarounds) {
  console.log(`| \`${text}\` | ${cell(check(transform('2.7.0', 'page.js', options).out, expected))} |`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(mismatches ? `\n${mismatches} result(s) differ from the expected matrix.` : '\nAll results match the expected matrix.');
process.exitCode = mismatches ? 1 : 0;
