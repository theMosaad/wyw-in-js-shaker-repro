import { css } from '@linaria/core';
import { Montserrat } from 'next/font/google';
import { space } from './tokens';
import { withSession, withUser } from './with-session';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400'] });

const _exp = () => (space(2));
export const title = "tqf911m";

export const getServerSideProps = withSession(withUser('/login'));

export default function Page() {
  return montserrat.className + title;
}

export const __wywPreval = { _exp: _exp };
