// Mock jose before importing anything that uses it
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    setSubject: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: jest.fn().mockResolvedValue({
    payload: { sub: 'user-1', email: 'test@example.com' },
  }),
}));

import {
  generateHashid,
  validateGoogleIdToken,
  upsertUser,
  createSession,
  verifySession,
} from '@/lib/auth';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock fetch for Google token validation
global.fetch = jest.fn();

describe('Auth Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.SESSION_SECRET = 'test-session-secret-min-32-chars-long';
  });

  describe('generateHashid', () => {
    it('should generate a hashid of length 10', () => {
      const hashid = generateHashid();
      expect(hashid).toHaveLength(10);
    });

    it('should generate unique hashids', () => {
      const hashid1 = generateHashid();
      const hashid2 = generateHashid();
      expect(hashid1).not.toBe(hashid2);
    });
  });

  describe('validateGoogleIdToken', () => {
    it('should validate a valid Google ID token', async () => {
      const mockTokenInfo = {
        sub: '123456789',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        aud: 'test-client-id',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenInfo,
      });

      const result = await validateGoogleIdToken('valid-token');
      expect(result).toEqual({
        sub: '123456789',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      });
    });

    it('should throw error for invalid token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      await expect(validateGoogleIdToken('invalid-token')).rejects.toThrow();
    });

    it('should throw error for token with wrong audience', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: '123456789',
          aud: 'wrong-client-id',
        }),
      });

      await expect(validateGoogleIdToken('token')).rejects.toThrow('Token audience mismatch');
    });
  });

  describe('upsertUser', () => {
    it('should update existing user', async () => {
      const existingUser = {
        id: 'user-1',
        hashid: 'abc123',
        googleSub: '123456789',
        email: 'old@example.com',
        name: 'Old Name',
        picture: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser);
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        ...existingUser,
        email: 'new@example.com',
        name: 'New Name',
      });

      const result = await upsertUser({
        sub: '123456789',
        email: 'new@example.com',
        name: 'New Name',
      });

      expect(result.id).toBe('user-1');
      expect(result.hashid).toBe('abc123');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should create new user with unique hashid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.user.create as jest.Mock).mockResolvedValueOnce({
        id: 'user-2',
        hashid: 'xyz789',
        googleSub: '987654321',
        email: 'new@example.com',
        name: 'New User',
        picture: null,
      });

      const result = await upsertUser({
        sub: '987654321',
        email: 'new@example.com',
        name: 'New User',
      });

      expect(result.id).toBe('user-2');
      expect(result.hashid).toBe('xyz789');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should retry on hashid collision', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      // First attempt fails with hashid collision
      (prisma.user.create as jest.Mock)
        .mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['hashid'] },
        })
        .mockResolvedValueOnce({
          id: 'user-3',
          hashid: 'new-hashid',
          googleSub: '111222333',
          email: 'test@example.com',
          name: null,
          picture: null,
        });

      const result = await upsertUser({
        sub: '111222333',
        email: 'test@example.com',
      });

      expect(result.id).toBe('user-3');
      expect(prisma.user.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('createSession and verifySession', () => {
    it('should create and verify a session token', async () => {
      const user = {
        id: 'user-1',
        hashid: 'abc123',
        email: 'test@example.com',
        name: 'Test User',
        picture: null,
      };

      const token = await createSession(user);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const verified = await verifySession(token);
      expect(verified).toEqual(user);
    });

    it('should return null for invalid token', async () => {
      const verified = await verifySession('invalid-token');
      expect(verified).toBeNull();
    });
  });
});

