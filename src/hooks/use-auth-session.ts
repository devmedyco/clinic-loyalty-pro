import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase-ext/client";

type AuthState = {
  status: "loading" | "authenticated" | "anonymous";
  userId?: string;
};

export function useRequireSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);
  const protectedPathRef = useRef<string | null>(null);
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    protectedPathRef.current = window.location.pathname;

    function setAuthenticated(userId: string) {
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        queryClient.clear();
      }
      lastUserIdRef.current = userId;
      setState({ status: "authenticated", userId });
    }

    function setAnonymous() {
      lastUserIdRef.current = null;
      queryClient.clear();
      setState({ status: "anonymous" });
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setAuthenticated(data.session.user.id);
        return;
      }

      setAnonymous();
      navigate({
        to: "/login",
        search: {
          redirect: protectedPathRef.current ?? window.location.pathname,
          portal: getPortalFromPath(protectedPathRef.current ?? window.location.pathname),
        } as never,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setAuthenticated(session.user.id);
        return;
      }

      setAnonymous();
      navigate({
        to: "/login",
        search: {
          redirect: protectedPathRef.current ?? undefined,
          portal: getPortalFromPath(protectedPathRef.current ?? window.location.pathname),
        } as never,
      });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  return {
    isLoading: state.status === "loading",
    isAuthenticated: state.status === "authenticated",
    userId: state.userId,
  };
}

function getPortalFromPath(pathname: string) {
  if (pathname.startsWith("/patient")) return "patient";
  if (pathname.startsWith("/admin")) return "admin";
  return "clinic";
}
