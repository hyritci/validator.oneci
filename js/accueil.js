import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { EQUIPES, LIBELLES, SCENARIOS } from "./config.js";
import { exporterExcel } from "./export-excel.js";

const COLLECTION = "point du jour";          // même nom que dans VALIDATEC
const $ = id => document.getElementById(id);
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘`]/g, "'").toLowerCase();
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SC = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));

// Date du jour
const maintenant = new Date();
const dateFr = maintenant.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateISO = maintenant.toLocaleDateString("sv-SE");
$("date-jour").textContent = dateFr;

let docs = [], equipe = "TOUTES";
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
    </div>`).join("") : '<p class="vide">Aucun point reçu pour le moment.</p>';
}

$("equipe").onchange = () => { equipe = $("equipe").value; dessiner(); };
$("recherche").oninput = $("filtre").onchange = dessiner;
$("export").onclick = () => {
  const liste = dansEquipe();
  if (!liste.length) return alert("Aucun point à exporter pour cette équipe.");
  exporterExcel({ equipe, dateFr, dateISO, docs: liste });      // uniquement la page affichée
};

// Réception des points du jour en direct
function ecouter() {
  onSnapshot(query(collection(db, COLLECTION), where("dateISO", "==", dateISO)), snap => {
    docs = snap.docs.map(x => { const d = x.data(); return { ...d, t: d.envoyeLe?.toMillis?.() ?? Date.now() }; });
    $("etat").textContent = "En direct"; $("etat").className = "etat ok";
    dessiner();
  }, e => {
    $("etat").textContent = e.code === "permission-denied" ? "Accès refusé" : "Erreur de connexion"; $("etat").className = "etat ko";
  });
}

let demarre = false;
onAuthStateChanged(auth, async u => {
  if (!u) return (location.href = "connexion.html");
  const p = await getDoc(doc(db, "users", u.uid));
  if (!p.exists() || p.data().profil !== "validator" || !p.data().actif) { await signOut(auth); return (location.href = "connexion.html?attente=1"); }
  if (!demarre) { demarre = true; dessiner(); ecouter(); }
});
$("quitter").onclick = async () => { await signOut(auth); location.href = "connexion.html"; };