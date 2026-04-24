"use client";

import Link from "next/link";
import { ReactNode } from "react";

/**
 * Wrap a name/avatar cluster so clicking it opens the owner's public profile.
 *
 * Intended for comment authors, feed cards, discussion messages, announcement
 * senders — anywhere we render a student's identity. If `uid` is missing the
 * children render as a plain <span> so the call site stays copy-safe.
 */
export default function PublicProfileLink({
  uid,
  children,
  className,
  onClick,
}: {
  uid?: string | null;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!uid) return <span className={className}>{children}</span>;
  return (
    <Link
      href={`/student/profile/${uid}`}
      className={className}
      onClick={onClick}
      // Profile links inside lists shouldn't steal clicks from parent handlers
      // like card navigation; parents can pass onClick to stop-propagate.
    >
      {children}
    </Link>
  );
}
