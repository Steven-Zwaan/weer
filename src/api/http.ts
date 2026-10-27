/** Fetch with a timeout and two error kinds the app can tell apart: offline vs. a bad answer. */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/** The request never got an answer: offline, DNS, CORS or a timeout. */
export class NetworkError extends Error {}

export async function get(url: string, { timeoutMs = 10_000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { signal: combined });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJson<T>(url: string, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<T> {
  return (await get(url, opts)).json() as Promise<T>;
}

export async function getText(url: string, opts?: { timeoutMs?: number; signal?: AbortSignal }): Promise<string> {
  return (await get(url, opts)).text();
}

export const isOffline = (e: unknown): boolean => e instanceof NetworkError;
