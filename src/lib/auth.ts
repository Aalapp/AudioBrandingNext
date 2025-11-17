import { nanoid } from 'nanoid';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';
const JWT_SECRET = new TextEncoder().encode(SESSION_SECRET);
export const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  hashid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * Generate a unique hashid for a user (8-12 chars)
 */
export function generateHashid(): string {
  return nanoid(10);
}

/**
 * Validate Google ID token and extract user info
 */
export async function validateGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  // In production, validate against Google's token endpoint
  // For now, we'll decode and validate the JWT structure
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    
    if (!response.ok) {
      throw new Error('Invalid ID token');
    }
    
    const data = await response.json();
    
    // Verify the token is for our client
    if (data.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Token audience mismatch');
    }
    
    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch (error) {
    throw new Error(`Failed to validate Google ID token: ${error}`);
  }
}

/**
 * Upsert user from Google OAuth data
 */
export async function upsertUser(googleUser: GoogleUserInfo): Promise<SessionUser> {
  // Try to find existing user by googleSub
  const existingUser = await prisma.user.findUnique({
    where: { googleSub: googleUser.sub },
  });

  if (existingUser) {
    // Update user info if needed
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: googleUser.email || existingUser.email,
        name: googleUser.name || existingUser.name,
        picture: googleUser.picture || existingUser.picture,
      },
    });

    return {
      id: updatedUser.id,
      hashid: updatedUser.hashid,
      email: updatedUser.email,
      name: updatedUser.name,
      picture: updatedUser.picture,
    };
  }

  // Create new user with unique hashid
  let hashid = generateHashid();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const newUser = await prisma.user.create({
        data: {
          hashid,
          googleSub: googleUser.sub,
          email: googleUser.email || null,
          name: googleUser.name || null,
          picture: googleUser.picture || null,
        },
      });

      return {
        id: newUser.id,
        hashid: newUser.hashid,
        email: newUser.email,
        name: newUser.name,
        picture: newUser.picture,
      };
    } catch (error: any) {
      // If hashid collision, try again
      if (error.code === 'P2002' && error.meta?.target?.includes('hashid')) {
        hashid = generateHashid();
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to create user after multiple hashid attempts');
}

/**
 * Create a session token for a user
 */
export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    hashid: user.hashid,
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode session token
 */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      id: payload.userId as string,
      hashid: payload.hashid as string,
      email: (payload.email as string) || null,
      name: (payload.name as string) || null,
      picture: (payload.picture as string) || null,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get current session from cookies
 */
export async function getSession(tokenOverride?: string | null): Promise<SessionUser | null> {
  let token = tokenOverride;

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) {
    return null;
  }

  return verifySession(token);
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/**
 * Delete session cookie
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current authenticated user or throw error
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

