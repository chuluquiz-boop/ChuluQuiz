import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase.js";
import { apiFetch } from "./api.js";


export async function initPushForUser() {
    if (!("Notification" in window)) return { ok: false, reason: "no-notification-api" };
    if (!("serviceWorker" in navigator)) return { ok: false, reason: "no-sw" };

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "permission-denied" };

    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const vapidKey = import.meta.env.VITE_FB_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });

    if (!token) return { ok: false, reason: "no-token" };

    const user_id = Number(localStorage.getItem("user_id") || 0) || null;

    await apiFetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, user_id }),
    });

    onMessage(messaging, (payload) => {
        

        const t = payload?.notification?.title || "ChuluQuiz";
        const b = payload?.notification?.body || "";
        new Notification(t, { body: b, icon: "/pwa-192.png" });
    });

    return { ok: true, token };
}