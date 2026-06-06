const scannedHostApiUrl = `${window.location.protocol}//${window.location.hostname}:8000/api`;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || scannedHostApiUrl;

export class HttpError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'HttpError';
    this.details = details;
  }
}

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(payload?.message ?? payload?.details ?? payload?.error ?? 'Une erreur est survenue', payload);
  }

  return payload;
}

export function assetUrl(path, fallback) {
  if (!path) return fallback;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return path;
  return `${API_BASE_URL.replace('/api', '')}/storage/${path}`;
}
