"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    signOut(auth).finally(() => {
      setTimeout(() => router.replace("/"), 1200);
    });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center glow-blue"
      >
        <BookOpen className="w-10 h-10 text-white" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white mb-2">Signing you out...</h2>
        <p className="text-dark-300">Thank you for using MySmartStudy</p>
      </motion.div>
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-accent-blue/20 border-t-accent-blue"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
