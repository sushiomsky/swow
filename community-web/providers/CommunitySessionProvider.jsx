'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createCommunityApiClient, requestCommunity } from '../lib/communityClient';
import { disconnectCommunitySocket } from '../lib/socket';

const TOKEN_KEY = 'communityToken';
const USER_ID_KEY = 'communityUserId';
const USERNAME_KEY = 'communityUsername';
const USER_ROLE_KEY = 'communityUserRole';

const CommunitySessionContext = createContext(null);

function clearPersistedSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
}

function persistSession(token, user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, user.user_id);
  localStorage.setItem(USERNAME_KEY, user.username);
  localStorage.setItem(USER_ROLE_KEY, user.role || 'user');
}

function readPersistedSession() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY) || 'user';
  if (!token || !userId || !username) return null;
  return {
    token,
    user: {
      user_id: userId,
      username,
      role
    }
  };
}

export function CommunitySessionProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const clearSession = useCallback((message = '') => {
    clearPersistedSession();
    disconnectCommunitySocket();
    setToken(null);
    setUser(null);
    setSessionError(message);
  }, []);

  const applySession = useCallback((nextToken, nextUser) => {
    persistSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
    setSessionError('');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const persisted = readPersistedSession();
      if (!persisted) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const authState = await requestCommunity('/auth/me', { token: persisted.token });
        const validatedUser = authState?.user
          ? {
            ...persisted.user,
            ...authState.user
          }
          : persisted.user;
        if (!cancelled) {
          applySession(persisted.token, validatedUser);
        }
      } catch {
        if (!cancelled) {
          clearSession('Session expired. Please sign in again.');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const api = useMemo(() => createCommunityApiClient({
    getToken: () => token,
    onUnauthorized: () => clearSession('Session expired. Please sign in again.')
  }), [token, clearSession]);

  const login = useCallback(async (payload) => {
    const data = await api.login(payload);
    if (!data?.token || !data?.user?.user_id) {
      throw new Error('Invalid auth response');
    }
    applySession(data.token, data.user);
    return data.user;
  }, [api, applySession]);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    if (!data?.token || !data?.user?.user_id) {
      throw new Error('Invalid auth response');
    }
    applySession(data.token, data.user);
    return data.user;
  }, [api, applySession]);

  const logout = useCallback(() => {
    clearSession('');
  }, [clearSession]);

  const clearSessionError = useCallback(() => {
    setSessionError('');
  }, []);

  const value = useMemo(() => ({
    api,
    token,
    user,
    ready,
    isAuthenticated: Boolean(token && user?.user_id),
    sessionError,
    clearSessionError,
    login,
    register,
    logout
  }), [
    api,
    token,
    user,
    ready,
    sessionError,
    clearSessionError,
    login,
    register,
    logout
  ]);

  return (
    <CommunitySessionContext.Provider value={value}>
      {children}
    </CommunitySessionContext.Provider>
  );
}

export function useCommunitySession() {
  const context = useContext(CommunitySessionContext);
  if (!context) {
    throw new Error('useCommunitySession must be used within CommunitySessionProvider');
  }
  return context;
}
