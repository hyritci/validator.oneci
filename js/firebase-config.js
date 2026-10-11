// Mets ici la MÊME config Firebase que VALIDATEC (même projet, car Validator lit les points envoyés par VALIDATEC)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyAm2J6bLL-EUTAfqOU0EpK7MKX5NSD2Uxc",
  authDomain: "validatec-f9acf.firebaseapp.com",
  projectId: "validatec-f9acf",
  storageBucket: "validatec-f9acf.firebasestorage.app",
  messagingSenderId: "520250159806",
  appId: "1:520250159806:web:4cccaca5f8db2a529264ef"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);