import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: REMOVED_GOOGLE_API_KEY,
  authDomain: "agronova-bd.firebaseapp.com",
  projectId: "agronova-bd",
  storageBucket: "agronova-bd.firebasestorage.app",
  messagingSenderId: "427537473864",
  appId: "1:427537473864:web:998eabeff6fdce1724d37d",
};

const app = initializeApp(firebaseConfig);

export default app;
