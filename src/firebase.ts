import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB3T-imQa4vt9AthQMAP6gyP2eVajLU7wc",
  authDomain: "smart-kwh-meter-d9181.firebaseapp.com",
  databaseURL: "https://smart-kwh-meter-d9181-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-kwh-meter-d9181",
  storageBucket: "smart-kwh-meter-d9181.firebasestorage.app",
  messagingSenderId: "114292458200",
  appId: "1:114292458200:web:e4289892cfa764ed600dad",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);