# wyw-in-js 2.4.0+ shaker keeps top-level imported calls

Repro for an issue against [wyw-in-js](https://github.com/wyw-in-js/wyw-in-js). Since `@wyw-in-js/transform` 2.4.0, once one imported binding is live for `__wywPreval`, the OXC shaker also keeps every top-level call of an imported function in the module, so evaluating a Next.js page's CSS loads its `getServerSideProps` wrappers and `next/font` calls. 2.3.1 dropped them.

```sh
pnpm matrix   # Node 22.12+, pnpm 12; the first run installs four variants of about 45 MB each
```

The script calls `transform()` and `oxcShaker` from `@wyw-in-js/transform` directly, with no bundler, once per variant, and exits 1 if anything differs from the tables below. Each variant under `variants/` is its own pnpm project with exact pins. `next` is a local stub (`stubs/next`) holding only `font/google/index.js`, an empty file in the real package too.

## Results

| `@wyw-in-js/transform` | `src/page.js` | `src/palette-page.js` (expect blue, green) | `src/theme-page.js` (expect blue) |
|---|---|---|---|
| 2.3.1 | `.tqf911m{padding:8px;}` | blue, red | red |
| 2.4.0 | `Error: The requested module 'next/font/google' does not provide an export named 'Montserrat'` | blue, green | blue |
| 2.7.0 | same error | blue, green | blue |
| 2.7.0 + `patches/transform-2.7.0.patch` | `.tqf911m{padding:8px;}` | blue, green | red |

`src/page-pure.js`, the same page with `/*#__PURE__*/` on all three calls, gives the same results as `src/page.js`. 2.4.1 to 2.6.0 fail `src/page.js` the same way as 2.4.0, checked by hand with the same script.

The script also prints:

- the `oxcShaker` output diff, 2.3.1 vs 2.7.0, for `preeval/page.js` (the preeval code 2.7.0 produces for `src/page.js`) with `onlyExports=['__wywPreval']`, and for `preeval/destructure.js` with `onlyExports=['color']`. 2.4.0 matches 2.7.0, and the patched output matches 2.3.1.
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

`src/page.js` has one `css` interpolation, `space(2)`, with `space` imported from `./tokens`. Since 2.4.0 the shaker treats a top-level call of an imported function as an effect of every import binding, because an opaque call could change any import (the comment above `importedEffects` in `statementGraph.ts`). `callableProvenanceIndex.ts` also makes every import a root of such a call. `space` is live, so `Montserrat(...)` and `withSession(withUser('/login'))` stay, with their imports, and eval links `next/font/google`, which is empty at runtime. A separate rule in `statementGraph.ts` keeps every top-level destructuring the shaker cannot prove won't throw.

The patch removes those four rules. A statement still keeps the effects of the bindings it uses, so `q.setColor('green')` stays (2.3.1 lost it). The patch gives up a call that changes another import's state, a write through one import alias read through another by destructuring, and a throwing top-level destructuring. Against the upstream `packages/transform` suite at the 2.7.0 tag it fails 36 tests; see `upstream-tests.md`.

## Files

- `src/`: fixtures for `transform()`, copied into each variant before each run so `@linaria/core` and `next` resolve from that variant
- `preeval/`: shaker-only inputs; `preeval/cases/` holds the keep/drop cases
- `mocks/`: modules used by the `importOverrides` rows; `options/`: pluginOptions that can't be passed as JSON
- `scripts/transform.mjs <variant> [src file] [pluginOptions JSON or .mjs file]`, `scripts/shake.mjs <variant> <file> <onlyExports>`
- `patches/transform-2.7.0.patch`: removes the four rules above from the 2.7.0 `esm/` build; wired in `variants/2.7.0-patched`
- `upstream-tests.md`: the same patch ported to the TypeScript source, with the upstream test results unpatched vs patched
