// Ownership: NIU Driver app edge. Access credentials are kept in OS-backed secure storage.

import * as SecureStore from 'expo-secure-store';
import type {
  DriverActiveSession,
  DriverActiveSessionStorage,
  NativeAccessCredential,
  NativeAuthStorage,
} from '@bookingapp/driver-tracking';

const AUTH_KEY = 'niu-driver.native-auth.v1';
const ACTIVE_SESSION_KEY = 'niu-driver.active-session.v1';
const REFRESH_TOKEN_KEY = 'niu-driver.native-refresh.v1';

export interface NativeRefreshTokenStorage {
  read(): Promise<string | null>;
  write(refreshToken: string): Promise<void>;
  clear(): Promise<void>;
}

function isCredential(value: unknown): value is NativeAccessCredential {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.accessToken === 'string'
    && candidate.accessToken.length > 0
    && typeof candidate.expiresAt === 'string'
    && Number.isFinite(Date.parse(candidate.expiresAt));
}

function isActiveSession(value: unknown): value is DriverActiveSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.tenantId === 'string'
    && typeof candidate.tripId === 'string'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.deviceId === 'string'
    && candidate.deviceId.length > 0
    && typeof candidate.traccarCredential === 'string'
    && candidate.traccarCredential.startsWith('niu_traccar_v1.')
    && typeof candidate.expiresAt === 'string'
    && Number.isFinite(Date.parse(candidate.expiresAt));
}

async function readJson(key: string): Promise<unknown | null> {
  const stored = await SecureStore.getItemAsync(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as unknown;
  } catch {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
}

export function createSecureNativeAuthStorage(key = AUTH_KEY): NativeAuthStorage {
  return {
    async read() {
      const value = await readJson(key);
      if (!isCredential(value)) {
        if (value !== null) await SecureStore.deleteItemAsync(key);
        return null;
      }
      return value;
    },
    write(credential) {
      return SecureStore.setItemAsync(key, JSON.stringify(credential));
    },
    clear() {
      return SecureStore.deleteItemAsync(key);
    },
  };
}

export function createSecureActiveSessionStorage(key = ACTIVE_SESSION_KEY): DriverActiveSessionStorage {
  return {
    async read() {
      const value = await readJson(key);
      if (!isActiveSession(value)) {
        if (value !== null) await SecureStore.deleteItemAsync(key);
        return null;
      }
      return value;
    },
    write(session) {
      return SecureStore.setItemAsync(key, JSON.stringify(session));
    },
    clear() {
      return SecureStore.deleteItemAsync(key);
    },
  };
}

export function createSecureNativeRefreshTokenStorage(key = REFRESH_TOKEN_KEY): NativeRefreshTokenStorage {
  return {
    async read() {
      const stored = await SecureStore.getItemAsync(key);
      if (stored?.trim()) return stored;
      if (stored !== null) await SecureStore.deleteItemAsync(key);
      return null;
    },
    write(refreshToken) {
      return SecureStore.setItemAsync(key, refreshToken);
    },
    clear() {
      return SecureStore.deleteItemAsync(key);
    },
  };
}
