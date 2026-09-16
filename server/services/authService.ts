import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { UserRepository, UserRow } from '../db/repositories/userRepository.js';
import { CompanyRepository } from '../db/repositories/companyRepository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rental-system-super-secure-jwt-secret-key-2026';
const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_DAYS = 7;

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  memberships: { companyId: string; role: string }[];
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateTokens(user: UserRow) {
    const memberships = CompanyRepository.findUserMemberships(user.id).map(m => ({
      companyId: m.company_id,
      role: m.role
    }));

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      memberships
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    // Generate random refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const tokenId = 'tok_' + crypto.randomUUID().substring(0, 8);
    UserRepository.saveRefreshToken(tokenId, user.id, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 7200, // 2 hours in seconds
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatar_url,
        memberships
      }
    };
  }

  static async login(email: string, password: string) {
    const user = UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('ACCOUNT_INACTIVE');
    }

    const isValid = await this.comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return this.generateTokens(user);
  }

  static async registerTenant(data: { email: string; password: string; fullName: string; phone?: string }) {
    const existing = UserRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = await this.hashPassword(data.password);
    const userId = 'usr_tenant_' + crypto.randomUUID().substring(0, 8);

    const user = UserRepository.create({
      id: userId,
      email: data.email,
      password_hash: passwordHash,
      full_name: data.fullName,
      phone: data.phone || null,
      role: 'TENANT',
      status: 'ACTIVE',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.fullName)}`
    });

    return this.generateTokens(user);
  }

  static refreshAccessToken(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const record = UserRepository.findRefreshToken(tokenHash);

    if (!record) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    if (new Date(record.expires_at) < new Date()) {
      UserRepository.revokeRefreshToken(tokenHash);
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    const user = UserRepository.findById(record.user_id);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('USER_NOT_FOUND');
    }

    // Revoke used refresh token and issue new pair (rotation)
    UserRepository.revokeRefreshToken(tokenHash);
    return this.generateTokens(user);
  }

  static logout(rawRefreshToken?: string, userId?: string) {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      UserRepository.revokeRefreshToken(tokenHash);
    } else if (userId) {
      UserRepository.revokeAllUserRefreshTokens(userId);
    }
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
  }
}
