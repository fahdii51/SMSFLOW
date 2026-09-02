import expressApp from '../dist/server.cjs';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  const app = (expressApp as any)?.default ?? expressApp;
  return app(req, res);
}
