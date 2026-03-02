/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// ضروري لـ workbox
precacheAndRoute(self.__WB_MANIFEST);

// Firebase config (نفس اللي عندك)
const firebaseConfig = {
  apiKey: "AIzaSyADLihvXwvbX3lHOt2q4dACjO1jR9fZqek",
  authDomain: "chuluquiz-push.firebaseapp.com",
  projectId: "chuluquiz-push",
  storageBucket: "chuluquiz-push.firebasestorage.app",
  messagingSenderId: "703122403215",
  appId: "1:703122403215:web:670fbe4c3efd3dbb8d65fa",
};

initializeApp(firebaseConfig);

const messaging = getMessaging();

// ✅ إشعار والـ app مغلق (Background)
onBackgroundMessage(messaging, (payload) => {
  const title = payload?.notification?.title || "ChuluQuiz";
  const body = payload?.notification?.body || "عندك إشعار جديد";
  const icon = "/pwa-192.png";

  self.registration.showNotification(title, {
    body,
    icon,
    data: payload?.data || {},
  });
});