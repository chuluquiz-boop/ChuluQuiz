importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyADLihvXwvbX3lHOt2q4dACjO1jR9fZqek",
    authDomain: "chuluquiz-push.firebaseapp.com",
    projectId: "chuluquiz-push",
    storageBucket: "chuluquiz-push.firebasestorage.app",
    messagingSenderId: "703122403215",
    appId: "1:703122403215:web:670fbe4c3efd3dbb8d65fa",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

    self.registration.showNotification(
        payload.notification?.title || "ChuluQuiz",
        {
            body: payload.notification?.body || "",
            icon: "/pwa-192.png",

            // 👇 هنا نحفظ البيانات
            data: {
                url: payload.data?.url || "/"
            }
        }
    );
});
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification?.data?.url || "/";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true })
            .then((windowClients) => {
                for (let client of windowClients) {
                    if (client.url.includes(url) && "focus" in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});F