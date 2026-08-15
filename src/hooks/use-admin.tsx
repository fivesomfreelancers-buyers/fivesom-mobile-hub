import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin detection mirrors the website: `is_admin_user` / `is_founder_user`
 * security-definer functions over the `user_roles` table. Never trusted
 * client-side alone — every banner write is also gated by RLS.
 */
export function useIsAdmin() {
  const { user, loading } = useSession();
  const q = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [admin, founder] = await Promise.all([
        supabase.rpc("is_admin_user", { _user_id: user!.id }),
        supabase.rpc("is_founder_user", { _user_id: user!.id }),
      ]);
      return Boolean(admin.data) || Boolean(founder.data);
    },
  });
  return { isAdmin: q.data === true, loading: loading || (!!user && q.isLoading) };
}
