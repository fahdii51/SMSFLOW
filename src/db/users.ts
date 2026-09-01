import { sqlDb } from './index.ts';
import { users, wallets } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const existing = await sqlDb.select().from(users).where(eq(users.uid, uid));
    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await sqlDb.insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        role: email === 'fahdiikhann@gmail.com' ? 'admin' : 'user',
      })
      .returning();

    const newUser = inserted[0];
    
    // Auto-create wallet for new user
    await sqlDb.insert(wallets)
      .values({
        userId: newUser.id,
        balance: 0,
      })
      .onConflictDoNothing();

    return newUser;
  } catch (error) {
    console.error('Database getOrCreateUser failed:', error);
    throw new Error('Failed to synchronize user account to Cloud SQL', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await sqlDb.select().from(users);
  } catch (error) {
    console.error('Database getAllUsers failed:', error);
    throw new Error('Database query failed', { cause: error });
  }
}
