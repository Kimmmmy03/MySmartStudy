"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { authApi } from "@/lib/api";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Eye, EyeOff, Loader2, GraduationCap, Briefcase, ArrowRight, Check, X, UserCheck } from "lucide-react";
import clsx from "clsx";
import SelectWithOther from "@/components/ui/select-with-other";
import { DEPARTMENTS, CLASS_UNITS } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";

function getPasswordStrength(pw: string) {
  const checks = {
    minLength: pw.length >= 6,
    lowercase: /[a-z]/.test(pw),
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const level = passed <= 1 ? 0 : passed <= 2 ? 1 : passed <= 3 ? 2 : passed <= 4 ? 3 : 4;
  const labels = ["Too Weak", "Weak", "Medium", "Strong", "Very Strong"] as const;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-400", "bg-emerald-500"];
  return { checks, level, label: labels[level], color: colors[level] };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { checks, level, label, color } = getPasswordStrength(password);
  const reqs = [
    { key: "minLength", text: "At least 6 characters" },
    { key: "lowercase", text: "Lowercase letter (a-z)" },
    { key: "uppercase", text: "Uppercase letter (A-Z)" },
    { key: "number", text: "Number (0-9)" },
    { key: "symbol", text: "Special character (!@#...)" },
  ] as const;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= level - 1 ? color : "bg-white/10"}`} />
          ))}
        </div>
        <span className={`text-xs font-medium ${level <= 1 ? "text-red-400" : level <= 2 ? "text-yellow-400" : "text-emerald-400"}`}>
          {label}
        </span>
      </div>
      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {reqs.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5">
            {checks[r.key] ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-dark-400" />
            )}
            <span className={`text-[11px] ${checks[r.key] ? "text-emerald-400" : "text-dark-400 auth-subtext"}`}>
              {r.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGoogleMode = searchParams.get("google") === "1";
  const { refreshProfile } = useAuth();

  const [role, setRole] = useState<"student" | "lecturer">("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [year, setYear] = useState("1");
  const [semester, setSemester] = useState("1");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"form" | "google" | null>(null);

  // Pre-fill display name from Google profile when redirected from login
  useEffect(() => {
    if (isGoogleMode && auth.currentUser) {
      setDisplayName(auth.currentUser.displayName || "");
    }
  }, [isGoogleMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isGoogleMode) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setConfirmMode("form");
  };

  const performRegister = async () => {
    setConfirmMode(null);
    setLoading(true);
    try {
      let idToken: string;

      if (isGoogleMode && auth.currentUser) {
        // User already signed in with Google (redirected from login)
        idToken = await auth.currentUser.getIdToken();
      } else {
        // Standard email/password registration
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        idToken = await cred.user.getIdToken();
      }

      // Sync profile to backend
      const u = await authApi.sync({
        id_token: idToken,
        display_name: displayName,
        role,
        class_name: role === "student" ? className : "",
        year: role === "student" ? parseInt(year) : null,
        semester: role === "student" ? parseInt(semester) : null,
        department: role === "lecturer" ? department : null,
      });

      const p = await refreshProfile();

      // Send welcome email (best-effort, don't block registration)
      authApi.sendWelcomeEmail();

      router.push((p?.role || u.role) === "lecturer" ? "/lecturer/dashboard" : (p?.role || u.role) === "admin" ? "/admin/dashboard" : "/student/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      const msg = (err as Error)?.message || "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Please use at least 6 characters.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    setError("");
    setConfirmMode("google");
  };

  const performGoogleRegister = async () => {
    setConfirmMode(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      // Sync profile to backend
      const u = await authApi.sync({
        id_token: idToken,
        display_name: result.user.displayName || displayName || "",
        role,
        class_name: role === "student" ? className : "",
        year: role === "student" ? parseInt(year) : null,
        semester: role === "student" ? parseInt(semester) : null,
        department: role === "lecturer" ? department : null,
      });

      const p = await refreshProfile();

      // Send welcome email (best-effort)
      authApi.sendWelcomeEmail();

      router.push((p?.role || u.role) === "lecturer" ? "/lecturer/dashboard" : (p?.role || u.role) === "admin" ? "/admin/dashboard" : "/student/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/popup-closed-by-user") {
        // User closed popup, no error needed
      } else {
        setError((err as Error)?.message || "Google sign-up failed.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center py-8">
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
          <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/20 to-accent-blue/20" />
          <div className="relative z-10">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center glow-purple">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">MySmartStudy</h1>
            <p className="text-dark-200 text-sm">IPG Kampus Perempuan Melayu Melaka</p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 p-8 md:p-10 max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-white auth-heading mb-1">
            {isGoogleMode ? "Complete Your Profile" : "Create Account"}
          </h2>
          <p className="text-dark-300 auth-subtext text-sm mb-6">
            {isGoogleMode
              ? "You're signed in with Google. Choose your role and fill in your details."
              : "Choose your role and fill in your details"}
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4"
            >
              {error}
            </motion.div>
          )}

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={clsx(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                role === "student"
                  ? "border-accent-blue bg-accent-blue/10 glow-blue"
                  : "auth-role-btn"
              )}
            >
              <GraduationCap className={clsx("w-8 h-8", role === "student" ? "text-accent-blue" : "text-dark-300 auth-subtext")} />
              <span className={clsx("text-sm font-medium", role === "student" ? "text-accent-blue" : "text-dark-200 auth-label")}>Student</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("lecturer")}
              className={clsx(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                role === "lecturer"
                  ? "border-accent-purple bg-accent-purple/10 glow-purple"
                  : "auth-role-btn"
              )}
            >
              <Briefcase className={clsx("w-8 h-8", role === "lecturer" ? "text-accent-purple" : "text-dark-300 auth-subtext")} />
              <span className={clsx("text-sm font-medium", role === "lecturer" ? "text-accent-purple" : "text-dark-200 auth-label")}>Lecturer</span>
            </button>
          </div>

          {/* Google Sign-Up button (only when NOT in google redirect mode) */}
          {!isGoogleMode && (
            <>
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl auth-google-btn transition-colors font-medium disabled:opacity-50 mb-4"
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
                <span>{googleLoading ? "Signing up..." : "Sign up with Google"}</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px auth-divider" />
                <span className="text-dark-400 auth-subtext text-xs uppercase">or</span>
                <div className="flex-1 h-px auth-divider" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Full Name</label>
              <input
                type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="glass-input w-full px-4 py-3"
                placeholder="Enter your full name"
              />
            </div>

            {/* Hide email & password fields in Google mode */}
            {!isGoogleMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Email</label>
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="glass-input w-full px-4 py-3"
                    placeholder="example@moe-dl.edu.my"
                  />
                </div>
              </>
            )}

            {role === "student" ? (
              <>
                <SelectWithOther
                  label="Class / Unit"
                  value={className}
                  onChange={setClassName}
                  options={CLASS_UNITS}
                  placeholder="Select your class / unit"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <SelectWithOther
                    label="Year"
                    value={year}
                    onChange={setYear}
                    options={["1", "2", "3", "4"]}
                    placeholder="Select year"
                    required
                    allowOther={false}
                  />
                  <SelectWithOther
                    label="Semester"
                    value={semester}
                    onChange={setSemester}
                    options={["1", "2"]}
                    placeholder="Select semester"
                    required
                    allowOther={false}
                  />
                </div>
              </>
            ) : (
              <SelectWithOther
                label="Department"
                value={department}
                onChange={setDepartment}
                options={DEPARTMENTS}
                placeholder="Select your department"
                required
              />
            )}

            {/* Hide password fields in Google mode */}
            {!isGoogleMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                      className="glass-input w-full px-4 py-3 pr-11"
                      placeholder="Min. 6 characters"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 auth-label mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="glass-input w-full px-4 py-3 pr-11"
                      placeholder="Repeat password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit" disabled={loading}
              className="btn-gradient w-full text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                  <span className="relative z-10">Creating Account...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">{isGoogleMode ? "Complete Registration" : "Create Account"}</span>
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-dark-300 auth-subtext mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-blue font-medium hover:text-accent-blue/80 transition-colors auth-link">Sign In</Link>
          </p>
        </div>
      </motion.div>

      {/* Registration summary confirmation */}
      <AnimatePresence>
        {confirmMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmMode(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              className="auth-card rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  role === "student" ? "bg-accent-blue/10" : "bg-accent-purple/10"
                )}>
                  <UserCheck className={clsx("w-5 h-5", role === "student" ? "text-accent-blue" : "text-accent-purple")} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white auth-heading">Confirm registration</h3>
                  <p className="text-sm text-dark-300 auth-subtext mt-2">
                    This account will be registered for{" "}
                    <span className={clsx("font-semibold", role === "student" ? "text-accent-blue" : "text-accent-purple")}>
                      {role === "student" ? "student" : "lecturers"}
                    </span>
                    , Proceed?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmMode(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-dark-200 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirmMode === "form") performRegister(); else performGoogleRegister(); }}
                  className="btn-gradient px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md"
                >
                  Proceed
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
