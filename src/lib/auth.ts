import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'telecloud-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  name?: string;
  is_admin: boolean;
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

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

// Register user
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    
    // Check if user exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.error('Registration check error:', checkError);
      return { success: false, error: `Database error: ${checkError.message}` };
    }

    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        name: name || cleanEmail.split('@')[0],
        is_admin: false,
        storage_used: 0,
        storage_limit: 10737418240, // 10GB default
      })
      .select()
      .single();

    if (error) {
      console.error('Registration insert error:', error);
      return { success: false, error: `Failed to create user: ${error.message}` };
    }

    if (!user) {
      return { success: false, error: 'User creation failed' };
    }

    const token = generateToken(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin,
        storage_used: user.storage_used,
        storage_limit: user.storage_limit,
        created_at: user.created_at,
      },
      token,
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

// Login user
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('Login error from Supabase:', error);
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

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: user.is_admin,
        storage_used: user.storage_used,
        storage_limit: user.storage_limit,
        created_at: user.created_at,
      },
      token,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

// Get user from token
export async function getUserFromToken(token: string): Promise<User | null> {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return null;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .maybeSingle();

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      storage_used: user.storage_used,
      storage_limit: user.storage_limit,
      created_at: user.created_at,
    };
  } catch {
    return null;
  }
}

// Update user storage
export async function updateUserStorage(userId: string, bytesUsed: number): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({ storage_used: bytesUsed })
    .eq('id', userId);
}
