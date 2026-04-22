importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyAPlGp3a1mo5A-XHTF1wqwuq9rNkYevYMc",
    authDomain: "mysmartstudy-71f7c.firebaseapp.com",
    projectId: "mysmartstudy-71f7c",
    storageBucket: "mysmartstudy-71f7c.firebasestorage.app",
    messagingSenderId: "393385396386",
    appId: "1:393385396386:web:4b5aecf3353591585a2ffb",
    measurementId: "G-ZSH67R8YC5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    const notificationTitle = payload.notification?.title || "MySmartStudy Background Note";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/icon.png",
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
