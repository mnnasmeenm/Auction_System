import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

export type UserRole = "admin" | "manager" | null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  teamId: string | null;
  fullName: string | null;
  managerPhotoPath: string | null;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isManager: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface UserProfile {
  role: UserRole;
  team_id: string | null;
  full_name: string | null;
  manager_photo_path: string | null;
  must_change_password: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [managerPhotoPath, setManagerPhotoPath] =
    useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  function clearProfile() {
    setRole(null);
    setTeamId(null);
    setFullName(null);
    setManagerPhotoPath(null);
    setMustChangePassword(false);
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(`
        role,
        team_id,
        full_name,
        manager_photo_path,
        must_change_password
      `)
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile loading error:", error);
      clearProfile();
      return;
    }

    const profile = data as UserProfile;
    setRole(profile.role);
    setTeamId(profile.team_id ?? null);
    setFullName(profile.full_name ?? null);
    setManagerPhotoPath(profile.manager_photo_path ?? null);
    setMustChangePassword(profile.must_change_password ?? false);
  }

  async function refreshProfile() {
    if (!user) {
      clearProfile();
      return;
    }

    await loadProfile(user.id);
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);

        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        } else {
          clearProfile();
        }
      } catch (error) {
        console.error("Authentication error:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
          clearProfile();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setLoading(true);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          clearProfile();
          setLoading(false);
          return;
        }

        window.setTimeout(async () => {
          try {
            await loadProfile(newSession.user.id);
          } finally {
            if (mounted) setLoading(false);
          }
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setSession(null);
    clearProfile();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        teamId,
        fullName,
        managerPhotoPath,
        mustChangePassword,
        isAdmin: role === "admin",
        isManager: role === "manager",
        refreshProfile,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}