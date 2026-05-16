import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'telecloud-secret-key-change-in-production';

export const STORAGE_LIMIT_FREE = 52428800; // 50MB free tier
export const STORAGE_LIMIT_UPGRADED = 0; // 0 = unlimited (user has own bot)

export interface User {
  id: string;
  email: string;
  name?: string;
  is_admin: boolean;
  is_upgraded: boolean;
  storage_used: number;
  storage_limit: number;
  created_at: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

function mapUser(user: Record<string, unknown>): User {
  return {
    id: user.id as string,
    email: user.email as string,
    name: user.name as string | undefined,
    is_admin: user.is_admin as boolean,
    is_upgraded: user.is_upgraded as boolean || false,
    storage_used: user.storage_used as number,
    storage_limit: user.storage_limit as number,
    created_at: user.created_at as string,
  };
}

export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  try {
    const cleanEmail = email.toLowerCase().trim();

    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('telecloud_users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      return { success: false, error: `Database error: ${checkError.message}` };
    }

    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    const passwordHash = await hashPassword(password);

    const { data: user, error } = await supabaseAdmin
      .from('telecloud_users')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        name: name || cleanEmail.split('@')[0],
        is_admin: false,
        is_upgraded: false,
        storage_used: 0,
        storage_limit: STORAGE_LIMIT_FREE,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: `Failed to create user: ${error.message}` };
    }

    if (!user) {
      return { success: false, error: 'User creation failed' };
    }

    const token = generateToken(user.id);
    return { success: true, user: mapUser(user), token };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('telecloud_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      return { success: false, error: `Database error: ${error.message}` };
    }

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    if (!user.password_hash) {
      return { success: false, error: 'Account error - please reset password' };
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    const token = generateToken(user.id);
    return { success: true, user: mapUser(user), token };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

export async function getUserFromToken(token: string): Promise<User | null> {
  try {
    const decoded = verifyToken(token);
    if (decoded) {
      const { data: user } = await supabaseAdmin
        .from('telecloud_users')
        .select('*')
        .eq('id', decoded.userId)
        .maybeSingle();

      if (!user) return null;
      return mapUser(user);
    }

    if (token.startsWith('tc_')) {
      const { createHash } = await import('crypto');
      const keyHash = createHash('sha256').update(token).digest('hex');

      const { data: apiKey } = await supabaseAdmin
        .from('telecloud_api_keys')
        .select('user_id, expires_at')
        .eq('key_hash', keyHash)
        .maybeSingle();

      if (!apiKey) return null;
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return null;

      await supabaseAdmin
        .from('telecloud_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', keyHash);

      const { data: user } = await supabaseAdmin
        .from('telecloud_users')
        .select('*')
        .eq('id', apiKey.user_id)
        .maybeSingle();

      if (!user) return null;
      return mapUser(user);
    }

    return null;
  } catch {
    return null;
  }
}

export async function updateUserStorage(userId: string, bytesUsed: number): Promise<void> {
  await supabaseAdmin
    .from('telecloud_users')
    .update({ storage_used: bytesUsed })
    .eq('id', userId);
}
