"use client";

import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import clsx from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  noPadding?: boolean;
}

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-md", noPadding }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={clsx(
              "relative w-full glass-card modal-content",
              maxWidth
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 modal-border">
                <h3 className="text-lg font-semibold text-white modal-heading">{title}</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <X className="w-5 h-5 text-dark-200 modal-icon" />
                </button>
              </div>
            )}
            <div className={noPadding ? "" : "px-6 py-4"}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
