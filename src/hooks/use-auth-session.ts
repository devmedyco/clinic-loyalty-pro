import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";

export function useRequireSession() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "authenticated" | "anonymous">("loading");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setState("authenticated");
        return;
      }

      setState("anonymous");
      navigate({ to: "/login", search: { redirect: window.location.pathname } as never });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setState("authenticated");
        return;
      }

      setState("anonymous");
      navigate({ to: "/login" });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  return {
    isLoading: state === "loading",
    isAuthenticated: state === "authenticated",
  };
}
