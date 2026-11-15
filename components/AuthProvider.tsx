"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import posthog from "posthog-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { SignInDialog } from "@/components/SignInDialog";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [dialogOpen, setDialogOpen] = useState(false);
  const identifiedUserId = useRef<string | null>(null);

  const syncAnalyticsIdentity = useCallback((nextUser: User | null) => {
    if (!posthogConfigured) return;

    if (!nextUser) {
      if (identifiedUserId.current) posthog.reset();
      identifiedUserId.current = null;
      return;
    }

    if (identifiedUserId.current === nextUser.id) return;
    if (identifiedUserId.current) posthog.reset();

    const properties: { email?: string; name?: string } = {};
    if (nextUser.email) properties.email = nextUser.email;
    const fullName = nextUser.user_metadata.full_name;
    if (typeof fullName === "string" && fullName.trim()) properties.name = fullName.trim();

    posthog.identify(nextUser.id, properties);
    identifiedUserId.current = nextUser.id;
  }, []);

  useEffect(() => {
    if (!client) return;
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const nextUser = data.session?.user ?? null;
      syncAnalyticsIdentity(nextUser);
      setUser(nextUser);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      syncAnalyticsIdentity(nextUser);
      setUser(nextUser);
      setLoading(false);
      if (nextUser) setDialogOpen(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, syncAnalyticsIdentity]);

  const requireClient = useCallback(() => {
    if (!client) throw new Error("Sign in is temporarily unavailable. Kelus authentication is not configured.");
    return client;
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: Boolean(client),
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    signIn: async (email, password) => {
      const { error } = await requireClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (name, email, password) => {
      const { data, error } = await requireClient().auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/today/`,
        },
      });
      if (error) throw error;
      return !data.session;
    },
    signInWithGoogle: async () => {
      const { error } = await requireClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/today/` },
      });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
      syncAnalyticsIdentity(null);
    },
  }), [client, dialogOpen, loading, requireClient, syncAnalyticsIdentity, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInDialog />
    </AuthContext.Provider>
  );
}
