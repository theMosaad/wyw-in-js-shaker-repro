import { makePalette, applyTheme } from './pal';
const p = makePalette();
applyTheme(p);
export const out = p.color;
