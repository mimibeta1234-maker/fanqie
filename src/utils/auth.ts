const AUTH_STORAGE_KEY = 'studio_access_token_v1';
// One-way SHA-256 cryptographic digest of the access key
// Plaintext password is NEVER stored in source code
const SECURE_HASH = '89506301a08dfab0bdf70907dd805f6bdafa9cf25d6d445b0867bd7fffa93697';

export async function computeSha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isUserAuthenticated(): boolean {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    return saved === SECURE_HASH;
  } catch {
    return false;
  }
}

export async function verifyAndSavePassword(inputPassword: string): Promise<boolean> {
  try {
    const trimmed = inputPassword.trim();
    if (!trimmed) return false;

    // Try server verification first if available
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          localStorage.setItem(AUTH_STORAGE_KEY, SECURE_HASH);
          return true;
        }
      }
    } catch {
      // If offline or dev server fallback, use subtle crypto digest
    }

    // Client-side SHA-256 cryptographic check
    const clientHash = await computeSha256(trimmed);
    if (clientHash === SECURE_HASH) {
      localStorage.setItem(AUTH_STORAGE_KEY, SECURE_HASH);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Auth verification error:', err);
    return false;
  }
}

export function clearAuthentication(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore error
  }
}
