"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { SignInDialog } from "@/components/SignInDialog";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  dialogOpen: boolean;
  passwordRecovery: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!client) return;
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        setDialogOpen(true);
      } else if (session?.user) {
        setDialogOpen(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const requireClient = useCallback(() => {
    if (!client) throw new Error("Sign in is temporarily unavailable. Kelus authentication is not configured.");
    return client;
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: Boolean(client),
    dialogOpen,
    passwordRecovery,
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
    resetPassword: async (email) => {
      const { error } = await requireClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await requireClient().auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecovery(false);
      setDialogOpen(false);
    },
    signOut: async () => {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
    },
  }), [client, dialogOpen, loading, passwordRecovery, requireClient, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInDialog />
    </AuthContext.Provider>
  );
}
