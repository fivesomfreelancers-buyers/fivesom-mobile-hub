import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export type AccountRole = "buyer" | "freelancer";

export type RoleState = {
  role: AccountRole;
  freelancerId: string | null;
  isFreelancer: boolean;
  loading: boolean;
};

/**
 * Detects the account type from the same data the website uses:
 * a `freelancers` row (authoritative) or `profiles.role` as a fallback.
 * Buyers and freelancers get intentionally different navigation and actions.
 */
export function useRole(): RoleState {
  const { user, loading: sessionLoading } = useSession();

  const q = useQuery({
    queryKey: ["account-role", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<{ role: AccountRole; freelancerId: string | null }> => {
      const [{ data: fl }, { data: profile }] = await Promise.all([
        supabase.from("freelancers").select("id").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle(),
      ]);
      const freelancerId = (fl?.id as string | undefined) ?? null;
      const profileRole = (profile?.role as string | null | undefined)?.toLowerCase();
      const isFreelancer = !!freelancerId || profileRole === "freelancer" || profileRole === "seller";
      return { role: isFreelancer ? "freelancer" : "buyer", freelancerId };
    },
  });

  const role = q.data?.role ?? "buyer";
  return {
    role,
    freelancerId: q.data?.freelancerId ?? null,
    isFreelancer: role === "freelancer",
    loading: sessionLoading || (!!user && q.isLoading),
  };
}
