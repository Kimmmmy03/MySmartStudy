"use client";

import { createContext, useEffect, useState, useCallback, ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authApi, type UserOut } from "@/lib/api";
import type { AuthUser, UserProfile } from "@/types";

function toProfile(u: UserOut): UserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    role: u.role as UserProfile["role"],
    className: u.class_name,
    createdAt: u.created_at,
    photoURL: u.photo_url || undefined,
    streak: u.streak,
    points: u.points,
    badges: u.badges,
    year: u.year ?? undefined,
    semester: u.semester ?? undefined,
    department: u.department ?? undefined,
    bio: u.bio || undefined,
    coverPhotoURL: u.cover_photo_url || undefined,
    followerCount: u.follower_count ?? 0,
    followingCount: u.following_count ?? 0,
    notificationPrefs: u.notification_prefs
      ? {
          newFollower: u.notification_prefs.new_follower,
          mapLike: u.notification_prefs.map_like,
          mapComment: u.notification_prefs.map_comment,
          followedUserPosts: u.notification_prefs.followed_user_posts,
        }
      : undefined,
  };
}

async function setSessionCookie(token: string | null, role: string | null) {
  try {
    await fetch("/api/auth/set-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, role }),
    });
  } catch {
    // Silently fail — middleware cookie is best-effort
  }
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => void;
  refreshProfile: () => Promise<UserProfile | null>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: () => {},
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const me = await authApi.me();
      const p = toProfile(me);
      await setSessionCookie(me.id, me.role);
      setProfile(p);
      setUser({ id: me.id, uid: me.id, email: me.email });
      return p;
    } catch {
      setUser(null);
      setProfile(null);
      return null;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await setSessionCookie(null, null);
    firebaseSignOut(auth);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Ensure token is fresh before calling backend
        await fbUser.getIdToken(true);

        // Retry up to 3 times — backend may not have the profile yet
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const me = await authApi.me();
            const p = toProfile(me);
            // Set cookie BEFORE updating state so middleware sees it before any redirect
            await setSessionCookie(me.id, me.role);
            setProfile(p);
            setUser({ id: me.id, uid: me.id, email: me.email });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
          }
        }
        if (lastErr) {
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        await setSessionCookie(null, null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
