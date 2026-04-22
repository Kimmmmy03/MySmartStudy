import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAPlGp3a1mo5A-XHTF1wqwuq9rNkYevYMc",
  authDomain: "mysmartstudy-71f7c.firebaseapp.com",
  projectId: "mysmartstudy-71f7c",
  storageBucket: "mysmartstudy-71f7c.firebasestorage.app",
  messagingSenderId: "393385396386",
  appId: "1:393385396386:web:4b5aecf3353591585a2ffb",
  measurementId: "G-ZSH67R8YC5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Messaging only if supported (browser environment)
export const initMessaging = async () => {
  if (typeof window !== "undefined") {
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
  }
  return null;
};
