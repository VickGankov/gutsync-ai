import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEmail, loginEmail } from './emailAuth';

const mockState = vi.hoisted(() => ({
  users: [] as Array<{
    id: number;
    email: string;
    password: string;
    name: string | null;
    role: 'user';
    lastSignedIn: Date;
  }>,
  nextId: 1,
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_column: unknown, value: unknown) => ({ value })),
  };
});

vi.mock('./db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: (condition: { value: unknown }) => ({
          limit: async (limit: number) =>
            mockState.users.filter((user) => user.email === condition.value).slice(0, limit),
        }),
      }),
    }),
    insert: () => ({
      values: async (value: { email: string; password: string; name?: string | null; lastSignedIn: Date }) => {
        const user = {
          id: mockState.nextId++,
          email: value.email,
          password: value.password,
          name: value.name ?? null,
          role: 'user' as const,
          lastSignedIn: value.lastSignedIn,
        };
        mockState.users.push(user);
        return [{ insertId: user.id }];
      },
    }),
    update: () => ({
      set: (updates: Record<string, unknown>) => ({
        where: async (condition: { value: unknown }) => {
          const user = mockState.users.find(
            (candidate) => candidate.email === condition.value || candidate.id === condition.value
          );
          if (user) Object.assign(user, updates);
        },
      }),
    }),
  })),
}));

describe('Email Auth', () => {
  const testEmail = 'test@example.com';
  const testPassword = 'TestPassword123!';

  beforeEach(() => {
    mockState.users = [];
    mockState.nextId = 1;
    vi.clearAllMocks();
  });

  it('should register new user', async () => {
    const user = await registerEmail(testEmail, testPassword, 'Test User');
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe('Test User');
  });

  it('should reject duplicate email', async () => {
    await registerEmail(testEmail, testPassword, 'Test User');
    await expect(registerEmail(testEmail, 'AnotherPassword123!', 'Another')).rejects.toThrow('already registered');
  });

  it('should login with correct password', async () => {
    await registerEmail(testEmail, testPassword, 'Test User');
    const user = await loginEmail(testEmail, testPassword);
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
  });

  it('should reject wrong password', async () => {
    await registerEmail(testEmail, testPassword, 'Test User');
    await expect(loginEmail(testEmail, 'WrongPassword')).rejects.toThrow('Invalid credentials');
  });

  it('should reject non-existent email', async () => {
    await expect(loginEmail('nonexistent@example.com', testPassword)).rejects.toThrow('Invalid credentials');
  });

  it('stores emails in lowercase and trims spaces', async () => {
    const user = await registerEmail('  Test@Example.COM ', testPassword, 'Test User');
    expect(user.email).toBe('test@example.com');
  });

  it('logs in regardless of the letter case typed', async () => {
    await registerEmail(testEmail, testPassword, 'Test User');
    const user = await loginEmail('TEST@Example.com', testPassword);
    expect(user.email).toBe(testEmail);
  });

  it('treats different capitalisation as the same account', async () => {
    await registerEmail(testEmail, testPassword, 'Test User');
    await expect(registerEmail('Test@Example.com', testPassword, 'Dup')).rejects.toThrow('already registered');
  });
});
