const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Public GET for Server Components — no cookies / auth. */
export async function fetchPublicJson<T>(
  path: string,
  init?: { revalidate?: number | false },
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: init?.revalidate ?? 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
