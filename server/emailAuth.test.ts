import { describe, it, expect, beforeAll } from 'vitest';
import { registerEmail, loginEmail } from './emailAuth';

describe('Email Auth', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  it('should register new user', async () => {
    const user = await registerEmail(testEmail, testPassword, 'Test User');
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe('Test User');
  });

  it('should reject duplicate email', async () => {
    await expect(registerEmail(testEmail, 'AnotherPassword123!', 'Another')).rejects.toThrow('already registered');
  });

  it('should login with correct password', async () => {
    const user = await loginEmail(testEmail, testPassword);
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
  });

  it('should reject wrong password', async () => {
    await expect(loginEmail(testEmail, 'WrongPassword')).rejects.toThrow('Invalid credentials');
  });

  it('should reject non-existent email', async () => {
    await expect(loginEmail('nonexistent@example.com', testPassword)).rejects.toThrow('Invalid credentials');
  });
});
