import { withSession } from './with-session';
import { spacing } from './tokens';
export const out = spacing;
export const getServerSideProps = withSession(() => ({}));
