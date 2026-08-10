import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, makeOpaqueKeyFetch } from "./config";

/**
 * Browser Supabase client for the FIVESOM mobile app.
 * Uses the publishable (anon) key only — RLS applies. Never import server
 * secrets into this module.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    storageKey: "fivesom-auth",
  },
  global: { fetch: makeOpaqueKeyFetch(SUPABASE_PUBLISHABLE_KEY) },
});
