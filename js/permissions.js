import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { genererPDF } from './permission-pdf.js';

// Nom EXACT de la collection Firestore (comme dans VALIDATEC)
const COLLECTION = 'demande de permission';
const MAX = 300;                                  // nombre de demandes affichées (les plus récentes)

const $ = id => document.getElementById(id);
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").toLowerCase();
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(texte, ko) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = texte; t.className = 'toast ' + (ko ? 'ko' : 'ok'); t.hidden = false;
  clearTimeout(toast.minuteur); toast.minuteur = setTimeout(() => (t.hidden = true), 6000);
}

// ---------- Tableau : recherche par nom (sans liste à déplier) ----------
let demandes = [], charge = false;
function dessiner() {
  const mots = norm($('recherche').value).split(/\s+/).filter(Boolean);
  const rows = demandes.filter(d => mots.every(m => norm(d.nom || '').includes(m)));
  $('corps').innerHTML = rows.length ? rows.map(d => `<div class="ligne">
      <span class="nom">${esc(d.nom)}${d.saisiParNom ? `<small>saisi par ${esc(d.saisiParNom)}</small>` : ''}</span>
      <span>${esc(d.date)}</span>
      <span>Du ${esc(d.periodeDu)} au ${esc(d.periodeAu)}</span>
      <span>${esc(d.motif)}</span>
      <span><button type="button" class="telecharger" data-id="${esc(d.id)}">télécharger</button></span></div>`).join('')
    : `<p class="vide">${charge ? 'Aucune demande de permission.' : 'Chargement…'}</p>`;
}
$('recherche').oninput = dessiner;

// « télécharger » : la demande au format de la fiche ONECI, avec les informations et la signature
$('corps').addEventListener('click', async e => {
  const b = e.target.closest('.telecharger'); if (!b) return;
  const d = demandes.find(x => x.id === b.dataset.id); if (!d) return;
  if (!window.jspdf) return toast("La bibliothèque PDF ne s'est pas chargée. Vérifie ta connexion internet puis recharge la page.", true);
  b.disabled = true;
  try { await genererPDF(d); }
  catch (err) { console.error(err); toast('Le PDF n\'a pas pu être créé : ' + (err.message || err), true); }
  b.disabled = false;
});

// ---------- Réception en direct (les plus récentes d'abord) ----------
function ecouter() {
  onSnapshot(query(collection(db, COLLECTION), orderBy('envoyeLe', 'desc'), limit(MAX)), snap => {
    demandes = snap.docs.map(x => ({ id: x.id, ...x.data() })); charge = true;
    $('etat').textContent = 'En direct'; $('etat').className = 'etat ok';
    dessiner();
  }, e => {
    charge = true; $('etat').textContent = e.code === 'permission-denied' ? 'Accès refusé' : 'Erreur de connexion'; $('etat').className = 'etat ko';
    dessiner();
  });
}

dessiner();
let demarre = false;
onAuthStateChanged(auth, async u => {
  if (!u) return (location.href = 'connexion.html');
  const p = await getDoc(doc(db, 'users', u.uid));
  if (!p.exists() || p.data().profil !== 'validator' || !p.data().actif) { await signOut(auth); return (location.href = 'connexion.html?attente=1'); }
  if (!demarre) { demarre = true; ecouter(); }
});