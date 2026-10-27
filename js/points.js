import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { EQUIPES, LIBELLES, SCENARIOS } from "./config.js";
import { exporterExcel } from "./export-excel.js";

const COLLECTION = "point du jour";          // même nom que dans VALIDATEC
const $ = id => document.getElementById(id);
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘`]/g, "'").toLowerCase();
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SC = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

// Jours disponibles : aujourd'hui + les jours précédents. Change JOURS_ARRIERE pour allonger ou raccourcir.
const JOURS_ARRIERE = 7;
const fmtFr = d => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const JOURS = Array.from({ length: JOURS_ARRIERE + 1 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - i);
  const note = i === 0 ? "aujourd'hui" : i === 1 ? "hier" : d.toLocaleDateString("fr-FR", { weekday: "long" });
  return { fr: fmtFr(d), iso: d.toLocaleDateString("sv-SE"), label: `${fmtFr(d)} (${note})`, aujourdhui: i === 0 };
});
let jour = JOURS[0], dateFr = jour.fr, dateISO = jour.iso;       // jour affiché (sert aussi à l'export Excel)
JOURS.forEach((j, i) => $("jour").add(new Option(j.label, i)));

let docs = [], equipe = "TOUTES", arreter = null, chargement = true;
EQUIPES.forEach(e => $("equipe").add(new Option(e.label, e.valeur)));
$("filtre").add(new Option("Tous les scénarios", ""));
SCENARIOS.forEach(s => $("filtre").add(new Option(s.nom, s.id)));

const dansEquipe = () => (equipe === "TOUTES" ? docs : docs.filter(d => d.lieu === equipe));

function dessiner() {
  const liste = dansEquipe();
  $("heures").textContent = EQUIPES.find(e => e.valeur === equipe).heures;

  // Cartes : total (Dt) et détail de chaque scénario
  const t = {};
  SCENARIOS.forEach(s => (t[s.id] = { n: 0, somme: {} }));
  liste.forEach(d => Object.entries(d.scenarios || {}).forEach(([id, sc]) => {
    const x = t[id]; if (!x) return;
    x.n++;
    Object.entries(sc.champs || {}).forEach(([k, v]) => (x.somme[k] = (x.somme[k] || 0) + Number(v || 0)));
  }));
  $("cartes").innerHTML = SCENARIOS.map((s, i) => {
    const x = t[s.id], titre = equipe === "TOUTES" ? `Total ${s.nom}` : `${equipe} ${s.nom}`;
    const lignes = s.champs.filter(k => k !== "Dt").map(k => `<div><dt>${LIBELLES[k]}</dt><dd>${x.somme[k] || 0}</dd></div>`).join("");
    return `<article class="carte ${i % 2 ? "orange" : "vert"}"><h3>${esc(titre)}</h3><div class="carte-corps">
      <div class="gros">${s.champs.length ? x.somme.Dt || 0 : x.n}</div>
      ${lignes ? `<dl>${lignes}</dl>` : '<p class="note">envoi(s) reçu(s)</p>'}</div></article>`;
  }).join("");

  // Tableau : recherche par nom + tri par scénario
  const mots = norm($("recherche").value).split(/\s+/).filter(Boolean), f = $("filtre").value, toutes = equipe === "TOUTES";
  const lignes = liste.filter(d => mots.every(m => norm(d.nom).includes(m)))
    .flatMap(d => Object.entries(d.scenarios || {}).filter(([id]) => SC[id] && (!f || id === f)).map(([id, sc]) => ({ d, id, sc })))
    .sort((a, b) => b.d.t - a.d.t);
  $("tableau").className = "tableau" + (toutes ? "" : " sans-lieu");
  $("corps").innerHTML = lignes.length ? lignes.map(({ d, id, sc }) => `<div class="ligne">
      <span class="nom">${esc(d.nom)}${d.saisiParNom ? `<small>saisi par ${esc(d.saisiParNom)}</small>` : ""}</span>
      ${toutes ? `<span>${esc(d.lieu)} · ${esc(d.heure)}</span>` : ""}
      <span><i class="pastille"></i>${esc(SC[id].nom)}</span>
      <span class="pts">${SC[id].champs.length ? SC[id].champs.map(k => `<em><b>${k}</b>${esc(sc.champs?.[k] ?? 0)}</em>`).join("") : "<em>✓ Effectuée</em>"}</span>
    </div>`).join("") : `<p class="vide">${chargement ? "Chargement…" : jour.aujourdhui ? "Aucun point reçu pour le moment." : "Aucun point reçu ce jour-là."}</p>`;
}

$("equipe").onchange = () => { equipe = $("equipe").value; dessiner(); };
$("jour").onchange = () => { jour = JOURS[$("jour").value]; dateFr = jour.fr; dateISO = jour.iso; ecouter(); };
$("recherche").oninput = $("filtre").onchange = dessiner;
// Petit message affiché en bas de l'écran (visible partout, contrairement à alert())
function toast(texte, ko) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.append(t); }
  t.textContent = texte; t.className = "toast " + (ko ? "ko" : "ok"); t.hidden = false;
  clearTimeout(toast.minuteur); toast.minuteur = setTimeout(() => (t.hidden = true), 6000);
}

$("export").onclick = async () => {
  const liste = dansEquipe();
  if (!liste.length) return toast("Aucun point à exporter pour cette équipe ce jour-là.", true);
  if (typeof ExcelJS === "undefined") return toast("La bibliothèque Excel ne s'est pas chargée. Vérifie ta connexion internet puis recharge la page.", true);
  $("export").disabled = true;
  try {
    await exporterExcel({ equipe, dateFr, dateISO, docs: liste });      // uniquement la page affichée
    toast("Fichier Excel créé ✓ Regarde dans tes téléchargements.");
  } catch (e) {
    console.error(e);
    toast("Export impossible : " + (e.message || e), true);
  }
  $("export").disabled = false;
};

// Nettoyage automatique : supprime les points des jours qui ne sont plus dans la liste (plus vieux que le dernier jour proposé)
async function nettoyer() {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where("dateISO", "<", JOURS[JOURS.length - 1].iso)));
    let supprimes = 0;
    for (let i = 0; i < snap.docs.length; i += 50) {
      const r = await Promise.allSettled(snap.docs.slice(i, i + 50).map(d => deleteDoc(d.ref)));
      supprimes += r.filter(x => x.status === "fulfilled").length;
    }
    if (supprimes) toast(`${supprimes} ancien(s) point(s) supprimé(s).`);
  } catch (e) { console.warn("Nettoyage impossible :", e.code || e.message); }
}

// Réception des points du jour en direct
function ecouter() {
  if (arreter) arreter();                       // on quitte le jour précédent
  docs = []; chargement = true;
  $("etat").textContent = "Chargement…"; $("etat").className = "etat";
  dessiner();
  arreter = onSnapshot(query(collection(db, COLLECTION), where("dateISO", "==", dateISO)), snap => {
    docs = snap.docs.map(x => { const d = x.data(); return { ...d, t: d.envoyeLe?.toMillis?.() ?? Date.now() }; });
    chargement = false;
    $("etat").textContent = jour.aujourdhui ? "En direct" : "Historique"; $("etat").className = "etat ok";
    dessiner();
  }, e => {
    chargement = false; dessiner();
    $("etat").textContent = e.code === "permission-denied" ? "Accès refusé" : "Erreur de connexion"; $("etat").className = "etat ko";
  });
}

let demarre = false;
onAuthStateChanged(auth, async u => {
  if (!u) return (location.href = "connexion.html");
  const p = await getDoc(doc(db, "users", u.uid));
  if (!p.exists() || p.data().profil !== "validator" || !p.data().actif) { await signOut(auth); return (location.href = "connexion.html?attente=1"); }
  if (!demarre) { demarre = true; dessiner(); ecouter(); nettoyer(); }
});