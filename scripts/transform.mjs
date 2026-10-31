// usage: node scripts/transform.mjs <variant dir> [src file] [pluginOptions JSON or .mjs file]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const variant = path.resolve(process.argv[2]);
const file = process.argv[3] ?? 'page.js';
const extra = process.argv[4]?.endsWith('.mjs') ? (await import(pathToFileURL(path.resolve(process.argv[4])).href)).default : JSON.parse(process.argv[4] ?? '{}');
const pluginOptions = { configFile: false, ...extra };
const load = (pkg) => import(pathToFileURL(path.join(variant, 'node_modules', pkg, 'esm/index.js')).href);
const { transform, TransformCacheCollection, disposeEvalBroker } = await load('@wyw-in-js/transform');
const { asyncResolveFallback } = await load('@wyw-in-js/shared');

fs.cpSync(path.resolve(import.meta.dirname, '../src'), path.join(variant, 'src'), { recursive: true });
const filename = path.join(variant, 'src', file);
const cache = new TransformCacheCollection();
try {
  const result = await transform(
    { cache, options: { filename, root: variant, pluginOptions } },
    fs.readFileSync(filename, 'utf8'),
    asyncResolveFallback,
  );
  console.log(`PASS css: ${result.cssText}`);
} catch (error) {
  console.log(`FAIL ${String(error).split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  disposeEvalBroker?.(cache);
}
