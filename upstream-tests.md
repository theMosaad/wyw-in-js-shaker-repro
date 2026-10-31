# Upstream test suite with the patch applied

`patches/transform-2.7.0.patch` ported to the TypeScript source of wyw-in-js/wyw-in-js at the `@wyw-in-js/transform@2.7.0` tag (commit e9dd0d3e), then `bun test src` in `packages/transform` (bun 1.3.5, the repo's package manager, after `bun install --frozen-lockfile` and `bun run build:esm`).

| tree | pass | fail | skip | todo |
|---|---|---|---|---|
| 2.7.0 unpatched | 2743 | 0 | 2 | 1 |
| 2.7.0 + patch (all four hunks) | 2707 | 36 | 2 | 1 |

2746 tests across 186 files in both runs. Every failure is an assertion on shaker output or evaluated CSS; nothing crashes.

One hunk at a time, from the unpatched tree:

| hunk removed | fail |
|---|---|
| `addCallableResultEffects` fan-out (`callableProvenanceIndex.ts`, `mayAliasAnyRootImport`) | 0 |
| `collectContextualRoots` imported-callee fan-out (`callableProvenanceIndex.ts`) | 0 |
| `importedEffects` attached to every root import (`statementGraph.ts`) | 18 |
| `potentiallyAbruptStatements` marked live (`statementGraph.ts`) | 4 |

The other 14 failures appear only when the `importedEffects` hunk is combined with the two `callableProvenanceIndex.ts` hunks.

## Failing tests with all four hunks

`src/__tests__/oxc-shaker.test.ts` (31):

- keeps an opaque imported call that can mutate a surviving sibling import
- keeps opaque imported calls across root import sources
- treats direct imports as one identity cohort without an opaque result
- honors object-rest initializer mutation cutoffs
- honors mutations from an object-rest initializer alias component
- keeps an object-rest pattern behind an initializer cycle
- preserves callable-result lookup across opaque imported identities
- preserves cohort-wide lookup for a callable
- preserves cohort-wide lookup for an accessor
- preserves cohort-wide lookup for a class
- unions imported-cohort callables with the same suffix
- unions imported-cohort accessors with the same suffix
- unions imported-cohort classes from distinct roots
- keeps the imported-result cohort through a conditional
- keeps the imported-result cohort through a logical expression
- keeps the imported-result cohort through a sequence
- keeps the imported-result cohort through an assignment
- keeps the imported-result cohort through an imported callable alias
- keeps the imported-result cohort through await
- keeps the imported-result cohort through an object value
- keeps the imported-result cohort through an array value
- keeps the imported-result cohort through a destructuring default
- keeps the imported-result cohort through a nested destructuring target
- keeps the imported-result cohort through a for-of binding
- keeps the imported-result cohort through a catch binding
- keeps the imported-result cohort through a class static field
- keeps the imported-result cohort through an IIFE parameter
- keeps an opaque imported call through a top-level callable alias
- preserves potentially abrupt unused object and array patterns
- keeps an imported callable alias invoked inside a local wrapper
- keeps cross-source imported mutations and opaque returned aliases

`src/__tests__/transform.static-import-values.test.ts` (5), each expecting `width:400px` and getting `width:304px`:

- does not use a stale destructured value after a cross-export alias mutation with hybrid evaluation
- does not ignore an opaque imported mutation call with hybrid evaluation
- does not detach destructuring from a mutator imported from another module with hybrid evaluation
- does not detach destructuring from an alias returned from another module with hybrid evaluation
- does not detach destructuring from an alias re-exported through a barrel with hybrid evaluation

## The patch against the source

```diff
diff --git a/packages/transform/src/utils/oxcShaker/callableProvenanceIndex.ts b/packages/transform/src/utils/oxcShaker/callableProvenanceIndex.ts
index 03317a1a..451c1a4f 100644
--- a/packages/transform/src/utils/oxcShaker/callableProvenanceIndex.ts
+++ b/packages/transform/src/utils/oxcShaker/callableProvenanceIndex.ts
@@ -544,11 +544,6 @@ export const createCallableProvenanceIndex = ({
     provenance: TaggedBindingProvenance
   ): void => {
     provenance.bindings.forEach((binding) => roots.add(binding));
-    if (provenance.mayAliasAnyRootImport) {
-      // This is the liveness boundary: the virtual cohort becomes concrete
-      // only while computing effects of code that is actually reached.
-      rootImportedBindings.forEach((binding) => roots.add(binding));
-    }
   };
   const collectContextualRoots = (
     value: Node,
@@ -662,15 +657,6 @@ export const createCallableProvenanceIndex = ({
 
     if (current.type === 'CallExpression') {
       const roots = new Set(collectCallableExpressionRoots(current));
-      const calleeBinding = getCalleeBinding(current.callee);
-      if (
-        calleeBinding &&
-        [...resolveAliasBinding(calleeBinding, aliases)].some(
-          aliasesImportedRoot
-        )
-      ) {
-        rootImportedBindings.forEach((root) => roots.add(root));
-      }
       return roots;
     }
 
diff --git a/packages/transform/src/utils/oxcShaker/statementGraph.ts b/packages/transform/src/utils/oxcShaker/statementGraph.ts
index d7f9960b..102a7c1f 100644
--- a/packages/transform/src/utils/oxcShaker/statementGraph.ts
+++ b/packages/transform/src/utils/oxcShaker/statementGraph.ts
@@ -669,10 +669,6 @@ const buildShakerProgramFacts = (
       importedEffects.add(statement);
     }
   });
-  callableProvenance.rootImportedBindings.forEach((binding) => {
-    importedEffects.forEach((effect) => addEffect(binding, effect));
-  });
-
   callableProvenance.aliasComponents.forEach((component, binding) => {
     if (component.values().next().value !== binding) {
       return;
@@ -768,7 +764,6 @@ export const shakeOxcToESM = (
     );
   };
 
-  potentiallyAbruptStatements.forEach((statement) => mark(statement));
 
   statements.forEach((statement) => {
     const hasWildcardReexport = statement.exportNames.has('*');
```
