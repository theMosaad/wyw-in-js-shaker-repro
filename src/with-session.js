// Stands in for server-only setup that cannot run at build time (env validation, database clients, ...).
const secret = requiredEnv('SESSION_SECRET');

export const withSession = (gssp) => async (ctx) => {
  const session = ctx.req.headers.cookie === secret ? secret : null;
  return gssp({ ...ctx, session });
};

export const withUser = (loginPath) => async ({ session }) =>
  session ? { props: {} } : { redirect: { destination: loginPath, permanent: false } };

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is not set`);
  return process.env[name];
}
