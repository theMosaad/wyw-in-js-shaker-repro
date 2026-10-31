// usage: node scripts/shake.mjs <variant dir> <file> <onlyExports comma list>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [variant, file, only] = process.argv.slice(2);
const { oxcShaker } = await import(pathToFileURL(path.resolve(variant, 'node_modules/@wyw-in-js/transform/esm/index.js')).href);
const filename = path.resolve(file);
const [, code] = oxcShaker({ filename }, null, fs.readFileSync(filename, 'utf8'), {
  onlyExports: only.split(','),
  features: {},
  highPriorityPlugins: [],
  root: path.dirname(filename),
});
console.log(code.trim());
