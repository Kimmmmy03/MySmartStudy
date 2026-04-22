"use client";

import { useFCM } from "@/hooks/use-fcm";

export function FCMProvider({ children }: { children: React.ReactNode }) {
    useFCM(); // Requests permissions and sets up listener on mount
    return <>{children}</>;
}
