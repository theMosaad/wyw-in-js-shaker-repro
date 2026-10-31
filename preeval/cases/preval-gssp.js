import { withSession } from './with-session';
import { withHeader } from './with-header';
import { rem } from 'polished';
const _exp = () => rem(4);
export const getServerSideProps = withSession(withHeader, 1);
const Page = () => null;
export default Page;
export const __wywPreval = { _exp: _exp };
