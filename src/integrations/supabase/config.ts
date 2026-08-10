// Public FIVESOM Supabase configuration.
// Only the project URL and the publishable (anon) key live here — both are
// safe to ship to the browser. Private keys (service role, DB password) are
// never referenced from client code; they exist only as server-side secrets.
export const SUPABASE_URL =
  (import.meta.env['VITE_SUPABASE_URL'] as string | undefined) ??
  "https://afjcjjelgppctsnmtbek.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ??
  "sb_publishable_icPI4NXE38hiaDKphmT2Xw_nbVEAxx2";

/**
 * New-format `sb_publishable_*` / `sb_secret_*` keys are opaque strings, not
 * JWTs. supabase-js still sends them as `Authorization: Bearer <key>`, which
 * PostgREST rejects with "Expected 3 parts in JWT; got 1". Strip that header
 * and send the key only via `apikey`.
 */
export function makeOpaqueKeyFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input as RequestInfo, { ...init, headers });
  };
}
