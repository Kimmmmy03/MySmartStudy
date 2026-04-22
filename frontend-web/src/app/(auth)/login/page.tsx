"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { authApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import TransitionLoader from "@/components/ui/transition-loader";

export default function LoginPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (user && profile) {
      setNavigating(true);
      router.replace(profile.role === "lecturer" ? "/lecturer/dashboard" : profile.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      const p = await refreshProfile();
      if (p) {
        setNavigating(true);
        router.replace(p.role === "lecturer" ? "/lecturer/dashboard" : p.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError((err as Error)?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);

      // Retry profile fetch to handle timing delays after first-time Google auth sync
      let profileFound = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const p = await refreshProfile();
          if (p) {
            setNavigating(true);
            router.replace(p.role === "lecturer" ? "/lecturer/dashboard" : p.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
            profileFound = true;
            break;
          }
        } catch {
          // Profile not found yet, wait and retry
          if (attempt < 2) await new Promise(r => setTimeout(r, 800));
        }
      }

      if (!profileFound) {
        // Truly new Google user — redirect to register to complete profile
        router.push("/register?google=1");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/popup-closed-by-user") {
        // User closed popup, no error needed
      } else {
        setError((err as Error)?.message || "Google sign-in failed.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (navigating) {
    return <TransitionLoader />;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <video
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      >
        <source src="/assets/Login1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 auth-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-4xl mx-4 overflow-hidden flex rounded-2xl auth-card"
      >
        {/* Left brand panel */}
        <div className="hidden md:flex w-2/5 flex-col items-center justify-center p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/20 to-accent-purple/20" />
          <div className="relative z-10">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center glow-blue">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">MySmartStudy</h1>
            <p className="text-dark-200 text-sm">IPG Kampus Perempuan Melayu Melaka</p>
            <p className="text-dark-400 text-xs mt-2">Collaborative Learning Platform</p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 p-8 md:p-10">
          <h2 className="text-2xl font-bold text-white auth-heading mb-1">Welcome Back</h2>
          <p className="text-dark-300 auth-subtext text-sm mb-6">Sign in to continue learning</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input w-full px-4 py-3"
                placeholder="example@moe-dl.edu.my"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="glass-input w-full px-4 py-3 pr-11"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-accent-blue hover:text-accent-blue/80 transition-colors">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="relative z-10">Signing in...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Sign In</span>
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px auth-divider" />
            <span className="text-dark-400 auth-subtext text-xs uppercase">or</span>
            <div className="flex-1 h-px auth-divider" />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl auth-google-btn transition-colors font-medium disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>{googleLoading ? "Signing in..." : "Sign in with Google"}</span>
          </button>

          <p className="text-center text-sm text-dark-300 auth-subtext mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-accent-blue font-medium hover:text-accent-blue/80 transition-colors auth-link">
              Register
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
