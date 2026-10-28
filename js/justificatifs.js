import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, query, orderBy, limit, onSnapshot, getDocs, deleteDoc, updateDoc, deleteField, serverTimestamp, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Nom EXACT de la collection Firestore (comme dans VALIDATEC)
const COLLECTION = 'justificatif';
// Même durée que les absences : un justificatif disparaît tout seul quand ses absences sont supprimées (35 jours)
const JOURS_CONSERVES = 35;
const MAX = 500;

const $ = id => document.getElementById(id);
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").toLowerCase();
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const frIso = i => i.split('-').reverse().join('/');
const debut = new Date(); debut.setHours(12, 0, 0, 0); debut.setDate(debut.getDate() - (JOURS_CONSERVES - 1));
const debutISO = debut.toLocaleDateString('sv-SE');                                // 1er jour encore conservé

function toast(texte, ko) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = texte; t.className = 'toast ' + (ko ? 'ko' : 'ok'); t.hidden = false;
  clearTimeout(toast.minuteur); toast.minuteur = setTimeout(() => (t.hidden = true), 6000);
}

// ---------- Tableau : recherche par nom (sans liste à déplier) ----------
let liste = [], charge = false;
function dessiner() {
  const mots = norm($('recherche').value).split(/\s+/).filter(Boolean);
  const rows = liste.filter(d => !d.retire && mots.every(m => norm(d.nom || '').includes(m)));
  $('corps').innerHTML = rows.length ? rows.map(d => `<div class="ligne">
      <span class="nom">${esc(d.nom)}${d.saisiParNom ? `<small>saisi par ${esc(d.saisiParNom)}</small>` : ''}</span>
      <span class="dates-col">${[...(d.dates || [])].sort().map(i => `<span>${frIso(i)}</span>`).join('')}</span>
      <span>${esc(d.motif)}</span>
      <span class="actions"><button type="button" class="voir" data-id="${esc(d.id)}">voir justificatif</button>
        <button type="button" class="retirer" data-id="${esc(d.id)}">retirer de la liste</button></span></div>`).join('')
    : `<p class="vide">${charge ? 'Aucun justificatif pour le moment.' : 'Chargement…'}</p>`;
}
$('recherche').oninput = dessiner;
const trouver = id => liste.find(x => x.id === id);
$('corps').addEventListener('click', e => {
  const v = e.target.closest('.voir'), r = e.target.closest('.retirer');
  if (v && trouver(v.dataset.id)) ouvrir(trouver(v.dataset.id));
  if (r && trouver(r.dataset.id)) demanderRetrait(trouver(r.dataset.id));
});

// ---------- Fenêtre « voir justificatif » : images et PDF, téléchargeables ----------
let courant = null, fichiersOuverts = [];
const fermerViewer = () => { $('viewer').hidden = true; courant = null; };
$('viewer-fermer').onclick = fermerViewer;
$('viewer').addEventListener('click', e => { if (e.target === $('viewer')) fermerViewer(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { fermerViewer(); $('confirm').hidden = true; } });

async function ouvrir(d) {
  courant = d; fichiersOuverts = [];
  $('viewer-titre').textContent = d.nom || '';
  $('viewer-sous').textContent = `${d.motif || ''} · ${[...(d.dates || [])].sort().map(frIso).join(', ')}`;
  $('viewer-corps').innerHTML = '<p class="vide">Chargement des justificatifs…</p>';
  $('viewer').hidden = false;
  try {
    const snap = await getDocs(collection(db, COLLECTION, d.id, 'fichiers'));     // les fichiers sont découpés en morceaux
    const par = new Map();
    snap.docs.forEach(x => { const p = x.data(); if (!par.has(p.fichier)) par.set(p.fichier, []); par.get(p.fichier).push(p); });
    fichiersOuverts = [...par.entries()].sort((a, b) => a[0] - b[0]).map(([, ps]) => {
      ps.sort((a, b) => a.partie - b.partie);
      return { nom: ps[0].nom, type: ps[0].type, data: ps.map(p => p.data).join('') };
    });
    $('viewer-corps').innerHTML = fichiersOuverts.length ? fichiersOuverts.map((f, i) => `<div class="just-carte">
        <div class="just-apercu">${f.type === 'application/pdf'
          ? `<div class="just-pdf">PDF<small>${esc(f.nom)}</small></div>` : `<img src="${f.data}" alt="${esc(f.nom)}">`}</div>
        <button type="button" class="btn-tel" data-i="${i}">Télécharger</button></div>`).join('')
      : '<p class="vide">Aucun fichier enregistré pour ce justificatif.</p>';
  } catch (e) {
    console.error(e);
    $('viewer-corps').innerHTML = `<p class="vide">${e.code === 'permission-denied' ? 'Accès refusé : publie le dernier firestore.rules.' : 'Chargement impossible : ' + esc(e.code || e.message)}</p>`;
  }
}
$('viewer-corps').addEventListener('click', e => {
  const b = e.target.closest('.btn-tel'); if (!b) return;
  const f = fichiersOuverts[+b.dataset.i]; if (!f) return;
  const [tete, b64] = f.data.split(','), mime = (tete.match(/:(.*?);/) || [])[1] || f.type;
  const bin = atob(b64), octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([octets], { type: mime })); a.download = f.nom || 'justificatif';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('viewer-retirer').onclick = () => courant && demanderRetrait(courant);

// ---------- Retirer de la liste (avec confirmation) ----------
let aRetirer = null;
function demanderRetrait(d) {
  aRetirer = d;
  $('confirm-texte').textContent = `Ce justificatif (${d.nom}) a été vérifié et va donc être retiré définitivement de la liste.`;
  $('confirm').hidden = false;
}
$('confirm-non').onclick = () => { $('confirm').hidden = true; aRetirer = null; };
async function supprimerFichiers(id) {
  const f = await getDocs(collection(db, COLLECTION, id, 'fichiers'));
  const r = await Promise.allSettled(f.docs.map(x => deleteDoc(x.ref)));
  if (r.some(x => x.status === 'rejected')) throw new Error('Suppression des fichiers impossible.');
}
$('confirm-oui').onclick = async () => {
  const d = aRetirer; if (!d) return;
  $('confirm-oui').disabled = $('confirm-non').disabled = true;
  try {
    await supprimerFichiers(d.id);                                              // images / PDF effacés de la base
    // Le motif et la liste des fichiers sont effacés. Il reste seulement les dates « justifiées » : l'absence reste « Oui »
    // dans la page Absents et reste verte dans VALIDATEC. Cette trace disparaît avec l'absence (35 jours).
    await updateDoc(doc(db, COLLECTION, d.id), { retire: true, retireLe: serverTimestamp(), motif: deleteField(), fichiers: deleteField() });
    $('confirm').hidden = true; aRetirer = null; fermerViewer();
    toast('Justificatif retiré de la liste.');
  } catch (e) {
    console.error(e);
    toast(e.code === 'permission-denied' ? 'Retrait refusé : publie le dernier firestore.rules.' : 'Retrait impossible : ' + (e.code || e.message), true);
  }
  $('confirm-oui').disabled = $('confirm-non').disabled = false;
};

// ---------- Réception en direct + suppression automatique des justificatifs dont les absences ont expiré ----------
let nettoye = false;
async function nettoyer(rows) {
  const expires = rows.filter(d => (d.dates || []).length && [...d.dates].sort().pop() < debutISO);   // toutes les dates sont trop anciennes
  let n = 0;
  for (const d of expires) {
    try { await supprimerFichiers(d.id); await deleteDoc(doc(db, COLLECTION, d.id)); n++; }
    catch (e) { console.warn('Nettoyage impossible :', e.code || e.message); }
  }
  if (n) toast(`${n} ancien(s) justificatif(s) supprimé(s) avec leurs absences.`);
}
function ecouter() {
  onSnapshot(query(collection(db, COLLECTION), orderBy('envoyeLe', 'desc'), limit(MAX)), snap => {
    liste = snap.docs.map(x => ({ id: x.id, ...x.data() })); charge = true;
    $('etat').textContent = 'En direct'; $('etat').className = 'etat ok';
    dessiner();
    if (!nettoye) { nettoye = true; nettoyer(liste); }
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