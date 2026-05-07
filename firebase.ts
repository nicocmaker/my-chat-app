import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// あなたが送ってくれた設定をそのまま反映しました
const firebaseConfig = {
  apiKey: "AIzaSyD368v2kiAXRCyVIszZHhfkf4nZ-ZQ0rSc",
  authDomain: "chatsite-f2c12.firebaseapp.com",
  projectId: "chatsite-f2c12",
  storageBucket: "chatsite-f2c12.firebasestorage.app",
  messagingSenderId: "761792719318",
  appId: "1:761792719318:web:91fd66fb29ed347bf71c77",
  measurementId: "G-SW32NQ6QVS"
};

// サーバーサイドでのエラーを防ぐ初期化方法
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);