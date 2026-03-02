// src/lib/firebasePush.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { apiFetch } from "./api.js"; // موجود عندك :contentReference[oaicite:1]{index=1}

const firebaseConfig = {
  apiKey: "AIzaSyADLihvXwvbX3lHOt2q4dACjO1jR9fZqek",
  authDomain: "chuluquiz-push.firebaseapp.com",
  projectId: "chuluquiz-push",
  storageBucket: "chuluquiz-push.firebasestorage.app",
  messagingSenderId: "703122403215",
  appId: "1:703122403215:web:670fbe4c3efd3dbb8d65fa",
};

const VAPID_KEY = "3uZ2o5W4RkiQi-wOoen9rV6d_EPrY5xZ2-z2h1ff8gI";

const app = initializeApp(firebaseConfig);

export async function enablePushNotifications() {
  const supported = await isSupported().catch(() => false);
  if (!supported) return { ok: false, reason: "unsupported" };

  // اطلب الإذن
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  // ✅ استعمل نفس Service Worker تاع الـ PWA (راح نجهزوه في الخطوة الجاية)
  const reg = await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  });

  if (!token) return { ok: false, reason: "no-token" };

  // اربط التوكن بالمستخدم (عندك user_id في localStorage)
  const user_id = Number(localStorage.getItem("user_id"));

  await apiFetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, token }),
  });

  return { ok: true, token };
}

// إشعارات والـ app مفتوح (Foreground)
export function onForegroundMessage(cb) {
  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => cb?.(payload));
}