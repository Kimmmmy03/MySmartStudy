"use client";

import { motion } from "framer-motion";

export default function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <motion.div
        className="w-10 h-10 rounded-full border-2 border-accent-blue/20 border-t-accent-blue"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      {message && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-dark-200"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
