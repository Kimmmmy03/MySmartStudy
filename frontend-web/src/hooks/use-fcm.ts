"use client";

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { initMessaging } from "@/lib/firebase";

export function useFCM() {
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        const requestPermission = async () => {
            try {
                // Skip FCM if VAPID key is not configured
                const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
                if (!vapidKey) return;

                if (typeof Notification === "undefined") return;
                const permission = await Notification.requestPermission();
                if (permission !== "granted") return;

                const messaging = await initMessaging();
                if (!messaging) return;

                const token = await getToken(messaging, { vapidKey });
                if (token) {
                    setFcmToken(token);
                }
            } catch {
                // FCM not available — ignore silently (dev environment, no service worker, etc.)
            }
        };

        requestPermission();
    }, []);

    useEffect(() => {
        const listen = async () => {
            const messaging = await initMessaging();
            if (!messaging) return;

            const unsubscribe = onMessage(messaging, (payload) => {
                console.log("Message received in foreground. ", payload);
                // Show local toast/notification using standard browser Notification API or library
                if (Notification.permission === "granted" && payload.notification) {
                    new Notification(payload.notification.title || "MySmartStudy", {
                        body: payload.notification.body,
                    });
                }
            });
            return () => unsubscribe();
        };

        listen();
    }, []);

    return { fcmToken };
}
