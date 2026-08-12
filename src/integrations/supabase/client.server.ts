import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, makeOpaqueKeyFetch } from "./config";

/**
 * SERVER ONLY. The `.server.ts` filename blocks this module from every client
 * bundle. Secrets are read inside the factories (never at module scope), so
 * they are resolved per request on the edge runtime.
 */

/** Publishable-key client for public reads during SSR / server functions. */
export function getServerPublicClient(): SupabaseClient {
  const url = process.env['SUPABASE_URL'] ?? SUPABASE_URL;
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeOpaqueKeyFetch(key) },
  });
}

/** Service-role client. Bypasses RLS — only for verified privileged work. */
export function getServiceRoleClient(): SupabaseClient {
  const url = process.env['SUPABASE_URL'] ?? SUPABASE_URL;
  const key = process.env['FIVESOM_SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error("FIVESOM_SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      // PostgREST only resolves the service_role from the Authorization header,
      // so (unlike publishable keys) this one must keep the bearer token.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${key}`);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}

