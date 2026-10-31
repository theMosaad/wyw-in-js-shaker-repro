import { css } from '@linaria/core';
import { Montserrat } from 'next/font/google';
import { space } from './tokens';
import { withSession, withUser } from './with-session';

const montserrat = /*#__PURE__*/ Montserrat({ subsets: ['latin'], weight: ['400'] });

export const title = css`
  padding: ${space(2)};
`;

export const getServerSideProps = /*#__PURE__*/ withSession(/*#__PURE__*/ withUser('/login'));

export default function Page() {
  return montserrat.className + title;
}
