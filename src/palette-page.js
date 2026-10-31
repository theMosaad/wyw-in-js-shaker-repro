import { css } from '@linaria/core';
import { makePalette } from './palette';

const p = makePalette();
p.color = 'blue';

const q = makePalette();
q.setColor('green');

export const assigned = css`
  color: ${p.color};
`;

export const called = css`
  color: ${q.color};
`;
