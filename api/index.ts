import { app } from '../server';
import { db } from '../server/db';

let isDbInitialized = false;

export const config = {
  runtime: 'nodejs18.x',
};

export default async function handler(req: any, res: any) {
  if (!isDbInitialized) {
    try {
      console.log("[VERCEL SERVERLESS] Initializing database connection...");
      await db.initMongo();
      isDbInitialized = true;
    } catch (err) {
      console.error("[VERCEL SERVERLESS] MongoDB init error:", err);
    }
  }
  return app(req, res);
}
