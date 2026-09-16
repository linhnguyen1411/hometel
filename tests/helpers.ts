import jwt from 'jsonwebtoken';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { runSeed } from '../server/seed.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rental-system-super-secure-jwt-secret-key-2026';

export interface TestUser {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'STAFF' | 'PROVIDER' | 'TENANT';
  memberships?: { companyId: string; role: string }[];
}

export function createToken(user: TestUser): string {
  return jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      memberships: user.memberships || []
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

export async function setupTestServer(): Promise<{ server: http.Server; baseUrl: string; close: () => Promise<void> }> {
  // Ensure seed data is initialized
  await runSeed(true);

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const close = () => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { server, baseUrl, close };
}

// Standard Test Personas from Seed
export const testUsers = {
  superAdmin: {
    userId: 'usr_adm_1',
    email: 'admin@homtel.com',
    role: 'SUPER_ADMIN' as const,
    memberships: []
  },
  owner1: {
    userId: 'usr_own_1',
    email: 'owner1@homtel.com',
    role: 'OWNER' as const,
    memberships: [{ companyId: 'cmp_own_1', role: 'ADMIN' }]
  },
  owner2: {
    userId: 'usr_own_2',
    email: 'owner2@homtel.com',
    role: 'OWNER' as const,
    memberships: [{ companyId: 'cmp_own_2', role: 'ADMIN' }]
  },
  staff1: {
    userId: 'usr_stf_1',
    email: 'staff.minh@homtel.com',
    role: 'STAFF' as const,
    memberships: [{ companyId: 'cmp_own_1', role: 'STAFF' }]
  },
  provider1: {
    userId: 'usr_prv_1',
    email: 'cleanmaster@clean.com',
    role: 'PROVIDER' as const,
    memberships: [{ companyId: 'cmp_prv_1', role: 'ADMIN' }]
  },
  tenant1: {
    userId: 'usr_tnt_1',
    email: 'tenant1@gmail.com',
    role: 'TENANT' as const,
    memberships: []
  },
  tenant2: {
    userId: 'usr_tnt_2',
    email: 'tenant2@gmail.com',
    role: 'TENANT' as const,
    memberships: []
  }
};
