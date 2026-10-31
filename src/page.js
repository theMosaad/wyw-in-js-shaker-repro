import { css } from '@linaria/core';
import { Montserrat } from 'next/font/google';
import { space } from './tokens';
import { withSession, withUser } from './with-session';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400'] });

export const title = css`
  padding: ${space(2)};
`;

export const getServerSideProps = withSession(withUser('/login'));

export default function Page() {
  return montserrat.className + title;
}
