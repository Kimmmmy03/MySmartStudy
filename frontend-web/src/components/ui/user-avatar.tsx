"use client";
import Image from "next/image";
import { useState } from "react";
import { resolveBackendUrl } from "@/lib/utils";
import clsx from "clsx";

interface UserAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  role?: "lecturer" | "student" | "admin";
}

/** Circular avatar that prefers the uploaded photo, falling back to initials. */
export function UserAvatar({ name, photoUrl, size = 36, className, role }: UserAvatarProps) {
  const [errored, setErrored] = useState(false);
  const resolved = resolveBackendUrl(photoUrl);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const roleRing =
    role === "lecturer" ? "ring-accent-purple/40" : role === "admin" ? "ring-accent-amber/40" : "ring-accent-blue/40";

  if (resolved && !errored) {
    return (
      <Image
        src={resolved}
        alt={name || ""}
        width={size}
        height={size}
        unoptimized
        onError={() => setErrored(true)}
        className={clsx("rounded-full object-cover ring-1", roleRing, className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={clsx(
        "rounded-full flex items-center justify-center font-semibold text-white",
        "bg-gradient-to-br from-accent-blue to-accent-purple ring-1",
        roleRing,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initial}
    </div>
  );
}
