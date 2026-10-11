import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { listeRecherche } from "./liste-recherche.js";

const $ = id => document.getElementById(id);
const dire = (t, ok) => { $("msg").textContent = t; $("msg").className = "msg" + (ok ? " ok" : ""); };
const email = id => `validator_${id}@validator.app`.toLowerCase();   // jamais affiché : sert seulement à Firebase
const chiffres = v => v.replace(/\D/g, "");
const ERREURS = {
  "auth/email-already-in-use": "Ce nom a déjà un compte. Connecte-toi.",
  "auth/invalid-credential": "Nom ou mot de passe incorrect.",
  "auth/network-request-failed": "Pas de connexion internet.",
  "auth/too-many-requests": "Trop d'essais. Réessaie plus tard."
};
const brancherAfficher = () => document.querySelectorAll("[data-voir]").forEach(b => b.onclick = () => {
  const i = $(b.dataset.voir), cache = i.type === "password";
  i.type = cache ? "text" : "password"; b.textContent = cache ? "Masquer" : "Afficher";
});

export function inscription(liste) {
  let choix = null;
  listeRecherche($("nom"), liste, x => (choix = x)); brancherAfficher();
  $("valider").onclick = async () => {
    const tel = chiffres($("tel").value), mdp = $("mdp").value;
    if (!choix) return dire("Choisis ton nom dans la liste.");
    if (tel.length !== 10) return dire("Numéro invalide (10 chiffres).");
    if (mdp.length < 8) return dire("Mot de passe : 8 caractères minimum.");
    if (mdp !== $("mdp2").value) return dire("Les mots de passe ne correspondent pas.");
    $("valider").disabled = true; dire("");
    let c;
    try {
      c = await createUserWithEmailAndPassword(auth, email(choix.id), mdp);
      // Le compte est créé « inactif » : l'administrateur doit mettre actif = true dans Firestore (users)
      await setDoc(doc(db, "users", c.user.uid), { nom: choix.nom, id: choix.id, fonction: choix.fonction || null, telephone: tel, profil: "validator", actif: false, creeLe: Date.now() });
      await signOut(auth);
      dire("Compte créé ✓ Il sera activé par l'administrateur, puis tu pourras te connecter.", true);
    } catch (e) {
      if (c) await c.user.delete().catch(() => {});
      dire(ERREURS[e.code] || "Erreur : " + (e.code || e.message)); $("valider").disabled = false;
    }
  };
}

export function connexion(liste) {
  let choix = null;
  listeRecherche($("nom"), liste, x => (choix = x)); brancherAfficher();
  const attente = "Ton compte n'est pas encore activé par l'administrateur.";
  if (new URLSearchParams(location.search).has("attente")) dire(attente);
  $("oublie").onclick = e => { e.preventDefault(); dire("Contacte l'administrateur pour réinitialiser ton mot de passe."); };
  $("valider").onclick = async () => {
    if (!choix) return dire("Choisis ton nom dans la liste.");
    if (!$("mdp").value) return dire("Entre ton mot de passe.");
    $("valider").disabled = true; dire("");
    try {
      const c = await signInWithEmailAndPassword(auth, email(choix.id), $("mdp").value);
      const p = await getDoc(doc(db, "users", c.user.uid));
      if (!p.exists() || p.data().profil !== "validator") { await signOut(auth); throw { code: "auth/invalid-credential" }; }
      if (!p.data().actif) { await signOut(auth); dire(attente); $("valider").disabled = false; return; }
      location.href = "index.html";
    } catch (e) { dire(ERREURS[e.code] || "Erreur : " + (e.code || e.message)); $("valider").disabled = false; }
  };
}