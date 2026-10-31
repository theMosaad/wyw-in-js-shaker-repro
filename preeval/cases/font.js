import { Montserrat } from 'next/font/google';
import { rem } from 'polished';
import { last } from 'lodash';

export const labelColor = 'red';
export const gap = rem(4);

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400'] });
const pick = last([1, 2]);

export const Input = () => montserrat.style;
export const other = () => pick;
