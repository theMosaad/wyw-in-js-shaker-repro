import { css } from '@linaria/core';
import { getColor, setTheme } from './theme';

setTheme('blue');

export const themed = css`
  color: ${getColor()};
`;
