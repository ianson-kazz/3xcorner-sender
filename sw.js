importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCDA0sviiCPs47UTKT8AZDKbOu7XfH_tRk",
  authDomain: "the3xcorner-notifications.firebaseapp.com",
  projectId: "the3xcorner-notifications",
  storageBucket: "the3xcorner-notifications.firebasestorage.app",
  messagingSenderId: "395418939416",
  appId: "1:395418939416:web:b1f46fa6ee20c468e2136d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: payload.notification.icon || "/icon.png",
    image: payload.notification.image,
    data: { click_action: payload.fcm_options?.link || payload.data?.link }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.click_action));
});