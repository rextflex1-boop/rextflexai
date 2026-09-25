export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rextflex_auth_token') : null;
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { credentials: 'include', ...init, headers });
  const data = await response.json().catch(() => ({}));

  // A 401 means the stored session is no longer usable. Remove the
  // local bearer token so the next app load cleanly returns to login
  // instead of repeatedly sending a dead credential.
  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('rextflex_auth_token');
  }

  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data as T;
}
