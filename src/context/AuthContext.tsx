import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

import type {
  Session,
  User
} from "@supabase/supabase-js";

import {
  supabase
} from "../services/supabase";

export type UserRole =
  | "admin"
  | "manager"
  | null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  teamId: string | null;
  isAdmin: boolean;
  isManager: boolean;
  signOut: () => Promise<void>;
}

interface UserProfile {
  role: UserRole;
  team_id: string | null;
}

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null);

  const [session, setSession] =
    useState<Session | null>(null);

  const [role, setRole] =
    useState<UserRole>(null);

  const [teamId, setTeamId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  async function loadProfile(
    userId: string
  ) {
    const { data, error } =
      await supabase
        .from("user_profiles")
        .select(`
          role,
          team_id
        `)
        .eq("id", userId)
        .single();

    if (error) {
      console.error(
        "Profile loading error:",
        error
      );

      setRole(null);
      setTeamId(null);

      return;
    }

    const profile =
      data as UserProfile;

    setRole(profile.role);
    setTeamId(
      profile.team_id ?? null
    );
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data: {
            session: currentSession
          },
          error
        } =
          await supabase.auth
            .getSession();

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        setSession(currentSession);
        setUser(
          currentSession?.user ?? null
        );

        if (currentSession?.user) {
          await loadProfile(
            currentSession.user.id
          );
        }
      } catch (error) {
        console.error(
          "Authentication error:",
          error
        );

        if (mounted) {
          setSession(null);
          setUser(null);
          setRole(null);
          setTeamId(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: {
        subscription
      }
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            newSession
          ) => {
            setLoading(true);
            setSession(newSession);
            setUser(
              newSession?.user ?? null
            );

            if (!newSession?.user) {
              setRole(null);
              setTeamId(null);
              setLoading(false);

              return;
            }

            window.setTimeout(
              async () => {
                try {
                  await loadProfile(
                    newSession.user.id
                  );
                } finally {
                  if (mounted) {
                    setLoading(false);
                  }
                }
              },
              0
            );
          }
        );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setUser(null);
    setSession(null);
    setRole(null);
    setTeamId(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        teamId,
        isAdmin:
          role === "admin",
        isManager:
          role === "manager",
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}