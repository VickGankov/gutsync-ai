import bcrypt from 'bcrypt';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export async function registerEmail(email: string, password: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new Error("Email already registered");
  
  const hash = await bcrypt.hash(password, 10);
  const result = await db.insert(users).values({
    email,
    password: hash,
    name: name || null,
    loginMethod: 'email',
    lastSignedIn: new Date(),
  });
  
  return { id: result[0].insertId as number, email, name: name || null };
}

export async function loginEmail(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (result.length === 0) throw new Error("Invalid credentials");
  
  const user = result[0];
  if (!user.password) throw new Error("Invalid credentials");
  
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid credentials");
  
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  
  return { id: user.id, email: user.email || '', name: user.name, role: user.role };
}
