import { listeRecherche } from "./liste-recherche.js";

const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
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
const texteErreur = e => ERREURS[e.code]
  || (/api-key|COLLE_ICI/i.test((e.code || "") + (e.message || "")) ? "Config Firebase non renseignée : ouvre js/firebase-config.js et colle ta config." : "Erreur : " + (e.code || e.message));

// Firebase est chargé à la demande : même si sa config pose problème, la liste des noms s'affiche
let _fb;
const firebase = () => (_fb ||= Promise.all([import("./firebase-config.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")])
  .then(([c, a, f]) => ({ auth: c.auth, db: c.db, ...a, ...f })));

function listeValide(liste) {
  const ok = Array.isArray(liste) && liste.length > 0 && liste.every(x => x && x.id && x.nom);
  if (!ok) dire("La liste des noms (data/chefs.js) est vide ou mal formée : chaque ligne doit avoir un id et un nom.");
  return ok;
}
const brancherAfficher = () => document.querySelectorAll("[data-voir]").forEach(b => b.onclick = () => {
  const i = $(b.dataset.voir), cache = i.type === "password";
  i.type = cache ? "text" : "password"; b.textContent = cache ? "Masquer" : "Afficher";
});

export function inscription(liste) {
  brancherAfficher();
  if (!listeValide(liste)) return;
  let choix = null;
  listeRecherche($("nom"), liste, x => (choix = x));
  firebase().catch(e => dire(texteErreur(e)));            // signale tout de suite un problème de config Firebase
  $("valider").onclick = async () => {
    const tel = chiffres($("tel").value), mdp = $("mdp").value;
    if (!choix) return dire("Choisis ton nom dans la liste.");
    if (tel.length !== 10) return dire("Numéro invalide (10 chiffres).");
    if (mdp.length < 8) return dire("Mot de passe : 8 caractères minimum.");
    if (mdp !== $("mdp2").value) return dire("Les mots de passe ne correspondent pas.");
    $("valider").disabled = true; dire("");
    let c, fb;
    try {
      fb = await firebase();
      c = await fb.createUserWithEmailAndPassword(fb.auth, email(choix.id), mdp);
      // Le compte est créé « inactif » : l'administrateur doit mettre actif = true dans Firestore (users)
      await fb.setDoc(fb.doc(fb.db, "users", c.user.uid), { nom: choix.nom, id: choix.id, fonction: choix.fonction || null, telephone: tel, profil: "validator", actif: false, creeLe: Date.now() });
      await fb.signOut(fb.auth);
      dire("Compte créé ✓ Il sera activé par l'administrateur, puis tu pourras te connecter.", true);
    } catch (e) {
      if (c) await c.user.delete().catch(() => {});
      dire(texteErreur(e)); $("valider").disabled = false;
    }
  };
}

export function connexion(liste) {
  brancherAfficher();
  const attente = "Ton compte n'est pas encore activé par l'administrateur.";
  $("oublie").onclick = e => { e.preventDefault(); dire("Contacte l'administrateur pour réinitialiser ton mot de passe."); };
  if (!listeValide(liste)) return;
  let choix = null;
  listeRecherche($("nom"), liste, x => (choix = x));
  if (new URLSearchParams(location.search).has("attente")) dire(attente);
  else firebase().catch(e => dire(texteErreur(e)));       // signale tout de suite un problème de config Firebase
  $("valider").onclick = async () => {
    if (!choix) return dire("Choisis ton nom dans la liste.");
    if (!$("mdp").value) return dire("Entre ton mot de passe.");
    $("valider").disabled = true; dire("");
    try {
      const fb = await firebase();
      const c = await fb.signInWithEmailAndPassword(fb.auth, email(choix.id), $("mdp").value);
      const p = await fb.getDoc(fb.doc(fb.db, "users", c.user.uid));
      if (!p.exists() || p.data().profil !== "validator") { await fb.signOut(fb.auth); throw { code: "auth/invalid-credential" }; }
      if (!p.data().actif) { await fb.signOut(fb.auth); dire(attente); $("valider").disabled = false; return; }
      location.href = "index.html";
    } catch (e) { dire(texteErreur(e)); $("valider").disabled = false; }
  };
}