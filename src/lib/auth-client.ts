import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  fetchOptions: {
    // Better Auth Bearer plugin returns the session token in the
    // `set-auth-token` response header. Persist it so every app API
    // request can authenticate independently of a stale browser cookie.
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get('set-auth-token');
      if (authToken) {
        localStorage.setItem('rextflex_auth_token', authToken);
      }
    },
    auth: {
      type: 'Bearer',
      token: () => localStorage.getItem('rextflex_auth_token') || '',
    },
  },
});
