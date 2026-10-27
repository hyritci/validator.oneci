// Protège les pages : retour à la connexion si personne n'est connecté ou si le compte n'est pas actif.
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
onAuthStateChanged(auth, async u => {
  if (!u) return (location.href = "connexion.html");
  const p = await getDoc(doc(db, "users", u.uid));
  if (!p.exists() || p.data().profil !== "validator" || !p.data().actif) { await signOut(auth); location.href = "connexion.html?attente=1"; }
});