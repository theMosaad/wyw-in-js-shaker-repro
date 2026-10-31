# wyw-in-js 2.4.0+ shaker keeps top-level imported calls

```sh
pnpm matrix   # Node 22.12+, pnpm 12; the first run installs four variants of about 45 MB each
```

The script calls `transform()` and `oxcShaker` from `@wyw-in-js/transform` directly, with no bundler, once per variant, and exits 1 if anything differs from the tables below. Each variant under `variants/` is its own pnpm project with exact pins; `@wyw-in-js/shared` and `@wyw-in-js/processor-utils` are pinned to the version `transform` depends on (2.3.0 for 2.3.1, otherwise the same version). `@linaria/core` is 8.0.0 everywhere; 8.2.0 gives the same failure on 2.7.0.

`next` is a local stub (`stubs/next`) holding only `font/google/index.js`, an empty file in the real package too, because Next's compiler rewrites `next/font` calls. The error is the same as with the real package.

## Results

| `@wyw-in-js/transform` | `src/page.js` | `src/palette-page.js` (expect blue, green) | `src/theme-page.js` (expect blue) |
|---|---|---|---|
| 2.3.1 | `.tqf911m{padding:8px;}` | blue, red | red |
| 2.4.0 | `Error: The requested module 'next/font/google' does not provide an export named 'Montserrat'` | blue, green | blue |
| 2.7.0 | same error | blue, green | blue |
| 2.7.0 + `patches/transform-2.7.0.patch` | `.tqf911m{padding:8px;}` | blue, green | red |

`src/page-pure.js`, the same page with `/*#__PURE__*/` on all three calls, gives the same results as `src/page.js`. 2.4.1 to 2.6.0 fail `src/page.js` the same way as 2.4.0, checked by hand with the same script.

The script also prints:

- the `oxcShaker` output diff, 2.3.1 vs 2.7.0, for `preeval/page.js` (the preeval code 2.7.0 produces for `src/page.js`, from a `DEBUG=wyw-in-js:*` run) with `onlyExports=['__wywPreval']` and for `preeval/destructure.js` with `onlyExports=['color']`. 2.4.0 matches 2.7.0, and the patched output matches 2.3.1.
- `preeval/page-local.js`, where `space` is declared in the file: no version keeps any import.
- `preeval/abrupt.js`, `const { a } = null;` before `export const color`: 2.4.0 and 2.7.0 keep the throwing line, 2.3.1 and the patch drop it.
- `preeval/cases/*.js` with `preeval/cases/cases.txt`: 16 statements in 14 cases that must stay (`keep`) or go (`drop`) after shaking. The patch gets 14 right and drops `setTheme('blue')` in `theme-call` and `alias.width = 400` in `alias-mut`; 2.4.0 and 2.7.0 keep the 7 that should go; 2.3.1 drops 5 of the 9 that should stay.
- the workarounds on unpatched 2.7.0:

| pluginOptions on 2.7.0 | result |
|---|---|
| `importOverrides: { 'next/font/google': { mock } }` | `Error: SESSION_SECRET is not set` (`with-session.js` now loads and throws at module scope) |
| same + `'./src/with-session.js': { mock }` | passes |
| `codeRemover.hocs: { 'next/font/google': ['Montserrat'] }` | `Error: SESSION_SECRET is not set` |
| same + `'./with-session': ['withSession']` | passes |
| `staticBindings: { './tokens': { space } }` (`options/static-bindings.mjs`) | passes |

## Why

1. `src/page.js` has one `css` interpolation, `space(2)`, where `space` is imported from `./tokens`. It needs neither `Montserrat(...)` nor `withSession(...)`.
2. Since 2.4.0 the Oxc shaker treats a top-level call of an imported function as an effect of every import binding, because an opaque call could change any import (the comment above `importedEffects` in `statementGraph.js`). In 2.7.0, `statementGraph.js` L382 records the call and L419–421 attaches it to every import; `callableProvenanceIndex.js` L324–328 (`addCallableResultEffects`) and L400–402 (an imported call passed as an argument, such as `withUser('/login')`) make every import a root of that call too.
3. `space` is live for `__wywPreval`, so the shaker keeps `const montserrat = Montserrat(...)` and `export const getServerSideProps = withSession(withUser('/login'))` along with their imports. Separately, `statementGraph.js` L477 keeps every top-level destructuring the shaker can't prove won't throw.
4. Eval then links `next/font/google`, which is empty at runtime, and fails on the missing named export. Without that error it would load `with-session.js`, which throws at module scope without `SESSION_SECRET`.
5. The patch removes L419–421, L324–328, L400–402 and L477. A statement still keeps the effects of the bindings it uses, so `q.setColor('green')` stays (2.3.1 lost it). It gives up a call that changes another import's state (`setTheme('blue')` before `${getColor()}` comes out red, as on 2.3.1), a write through one import alias read through another by destructuring, and a top-level destructuring that would throw. Against the upstream `packages/transform` suite at the 2.7.0 tag it fails 36 of 2746 tests; see `upstream-tests.md`.

## Files

- `src/`: fixtures for `transform()`, copied into each variant before each run so `@linaria/core` and `next` resolve from that variant
- `preeval/`: shaker-only inputs; `preeval/cases/` holds the keep/drop cases
- `mocks/`: modules used by the `importOverrides` rows; `options/`: pluginOptions that can't be passed as JSON
- `scripts/transform.mjs <variant> [src file] [pluginOptions JSON or .mjs file]`, `scripts/shake.mjs <variant> <file> <onlyExports>`
- `patches/transform-2.7.0.patch`: removes the four rules above from the 2.7.0 `esm/` build; wired in `variants/2.7.0-patched`. It is the patch our app runs, which passes the app's own Jest suites and Storybook build
- `upstream-tests.md`: the same patch ported to the TypeScript source, with the upstream test results unpatched vs patched
