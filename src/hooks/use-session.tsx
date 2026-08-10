import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

type SessionState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const SessionContext = createContext<SessionState>({
  session: null,
  user: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export type FivesomProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  profile_image_url: string | null;
  bio: string | null;
  professional_title: string | null;
  location: string | null;
  role: string | null;
  skills: string[] | null;
  languages: string[] | null;
  member_since: string | null;
};

/** Current user's own profile row (RLS: own row readable). */
export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<FivesomProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, email, profile_image_url, bio, professional_title, location, role, skills, languages, member_since",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as FivesomProfile | null;
    },
  });
}

/** Freelancer row for the current user, when they have one. */
export function useFreelancer() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["freelancer", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
