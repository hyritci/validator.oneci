import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Noms EXACTS des collections Firestore (comme dans VALIDATEC)
const ABSENTS = 'absents';
const JUSTIFS = 'justificatif';
// On garde 35 jours d'absences : quand on les dépasse, le jour le plus ancien est supprimé automatiquement.
const JOURS_CONSERVES = 35;

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const iso = d => d.toLocaleDateString('sv-SE');                                   // AAAA-MM-JJ
const fr = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const frIso = i => i.split('-').reverse().join('/');
const jourFr = d => d.toLocaleDateString('fr-FR', { weekday: 'long' });

// ---------- Semaines : du lundi au dimanche. La plus ancienne peut être coupée (ex. du mardi au dimanche) ----------
function calculerSemaines(auj, jours) {
  const debutFenetre = new Date(auj); debutFenetre.setDate(auj.getDate() - (jours - 1));
  const lundiDe = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const semaines = [], plusAncien = lundiDe(debutFenetre);
  for (let l = lundiDe(auj); l >= plusAncien; l.setDate(l.getDate() - 7)) {         // de la plus récente à la plus ancienne
    const dimanche = new Date(l); dimanche.setDate(l.getDate() + 6);
    semaines.push({ debut: new Date(l < debutFenetre ? debutFenetre : l), fin: dimanche });
  }
  return { debutFenetre, semaines };
}
const auj = new Date(); auj.setHours(12, 0, 0, 0);
const { debutFenetre, semaines } = calculerSemaines(auj, JOURS_CONSERVES);
const debutISO = iso(debutFenetre);

let docs = [], justifs = new Map(), semaine = 'toutes', tri = 'date';

// Menu des semaines : toutes les semaines + chaque semaine couverte par les 35 jours
$('semaine').add(new Option('Toutes les semaines', 'toutes'));
semaines.forEach((s, i) => $('semaine').add(new Option(
  `Semaine du ${s.debut.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${fr(s.fin)}${i === 0 ? ' (en cours)' : ''}`, i)));

// Période affichée : du premier jour de la semaine (ou du premier jour conservé) jusqu'au dimanche
function periode() {
  const s = semaine === 'toutes' ? { debut: semaines[semaines.length - 1].debut, fin: semaines[0].fin } : semaines[semaine];
  return { debut: s.debut, fin: s.fin, debutISO: iso(s.debut), finISO: iso(s.fin),
    texte: `${jourFr(s.debut)} ${fr(s.debut)} au ${jourFr(s.fin)} ${fr(s.fin)}` };
}

// ---------- Lignes du tableau (semaine choisie + tri) ----------
const cmp = (a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' });
const parDate = (a, b) => b.iso.localeCompare(a.iso);                              // récent d'abord
const TRIS = {
  date:  (a, b) => parDate(a, b) || cmp(a.agent, b.agent),
  chef:  (a, b) => cmp(a.chef, b.chef) || parDate(a, b) || cmp(a.agent, b.agent),
  agent: (a, b) => cmp(a.agent, b.agent) || parDate(a, b),
  lieu:  (a, b) => cmp(a.lieu, b.lieu) || parDate(a, b) || cmp(a.agent, b.agent)
};
function lignes() {
  const p = periode(), vus = new Set(), rows = [];
  for (const d of docs) {
    const cle = d.agentId + '|' + d.dateISO;
    if (vus.has(cle) || d.dateISO < p.debutISO || d.dateISO > p.finISO) continue;      // une seule ligne par agent et par jour
    vus.add(cle);
    rows.push({ chef: d.chefNom || '—', fonction: d.fonction || '', lieu: d.lieu || '—', agent: d.nom || '—', iso: d.dateISO,
      justifie: justifs ? !!justifs.get(d.agentId)?.has(d.dateISO) : null });
  }
  return rows.sort(TRIS[tri]);
}
const texteJustifie = j => (j === null ? '—' : j ? 'Oui' : 'Non');

let charge = false;
function dessiner() {
  $('periode').textContent = periode().texte;
  const rows = lignes();
  $('corps').innerHTML = rows.length ? rows.map(r => `<div class="ligne">
      <span class="nom">${esc(r.chef)}${r.fonction ? `<small>${esc(r.fonction)}</small>` : ''}</span>
      <span>${esc(r.lieu)}</span><span class="nom">${esc(r.agent)}</span><span>${frIso(r.iso)}</span>
      <span><b class="pilule ${r.justifie === null ? 'nd' : r.justifie ? 'oui' : 'non'}">${texteJustifie(r.justifie)}</b></span></div>`).join('')
    : `<p class="vide">${charge ? 'Aucun absent sur cette période.' : 'Chargement…'}</p>`;
}
$('semaine').onchange = () => { semaine = $('semaine').value === 'toutes' ? 'toutes' : +$('semaine').value; dessiner(); };
$('tri').onchange = () => { tri = $('tri').value; dessiner(); };

// ---------- Message en bas de l'écran ----------
function toast(texte, ko) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = texte; t.className = 'toast ' + (ko ? 'ko' : 'ok'); t.hidden = false;
  clearTimeout(toast.minuteur); toast.minuteur = setTimeout(() => (t.hidden = true), 6000);
}

// ---------- Export Excel : ce qui est affiché (semaine choisie, dans l'ordre du tri) ----------
async function exporter(rows) {
  const p = periode();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Absents', { pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.mergeCells('A1:E1'); ws.getCell('A1').value = `ABSENTS DU ${p.texte}`.toUpperCase();
  ['CHEF/SOUS-CHEF DE L\'AGENT', 'LIEU DE SERVICE', 'NOM & PRENOMS AGENT', 'JOUR D\'ABSENCE', 'JUSTIFIER'].forEach((t, i) => (ws.getCell(2, i + 1).value = t));
  rows.forEach((r, i) => {
    [`${r.chef}${r.fonction ? ' (' + r.fonction + ')' : ''}`, r.lieu, r.agent, frIso(r.iso), texteJustifie(r.justifie)]
      .forEach((v, c) => (ws.getCell(3 + i, c + 1).value = v));
  });
  const fin = { style: 'thin', color: { argb: 'FF555555' } }, dernier = 2 + rows.length;
  for (let r = 1; r <= dernier; r++) for (let c = 1; c <= 5; c++) {
    const cell = ws.getCell(r, c);
    cell.font = { name: 'Calibri', size: r === 1 ? 13 : 11, bold: r <= 2 };
    cell.alignment = { vertical: 'middle', horizontal: r <= 2 || c >= 4 ? 'center' : 'left' };
    cell.border = { top: fin, bottom: fin, left: fin, right: fin };
    if (r <= 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 1 ? 'FFFDE3BD' : 'FFE7E6E6' } };
  }
  ws.getRow(1).height = 26;
  [36, 22, 40, 16, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Absents_${semaine === 'toutes' ? 'toutes-les-semaines' : 'semaine-' + p.debutISO}_${iso(auj)}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('export').onclick = async () => {
  const rows = lignes();
  if (!rows.length) return toast('Aucun absent à exporter pour cette période.', true);
  if (typeof ExcelJS === 'undefined') return toast("La bibliothèque Excel ne s'est pas chargée. Vérifie ta connexion internet puis recharge la page.", true);
  $('export').disabled = true;
  try { await exporter(rows); toast('Fichier Excel créé ✓ Regarde dans tes téléchargements.'); }
  catch (e) { console.error(e); toast('Export impossible : ' + (e.message || e), true); }
  $('export').disabled = false;
};

// ---------- Réception en direct, nettoyage automatique ----------
function ecouter() {
  onSnapshot(query(collection(db, ABSENTS), where('dateISO', '>=', debutISO)), snap => {
    docs = snap.docs.map(x => x.data()); charge = true;
    $('etat').textContent = 'En direct'; $('etat').className = 'etat ok';
    dessiner();
  }, e => {
    charge = true; $('etat').textContent = e.code === 'permission-denied' ? 'Accès refusé' : 'Erreur de connexion'; $('etat').className = 'etat ko';
    dessiner();
  });
  // Justificatifs envoyés depuis le début de la période (une justification est toujours envoyée après l'absence)
  onSnapshot(query(collection(db, JUSTIFS), where('dateISO', '>=', debutISO)), snap => {
    justifs = new Map();
    snap.docs.forEach(x => { const d = x.data(), s = justifs.get(d.agentId) || new Set(); (d.dates || []).forEach(i => s.add(i)); justifs.set(d.agentId, s); });
    dessiner();
  }, e => { console.warn('Justificatifs illisibles :', e.code || e.message); justifs = null; dessiner(); });
}
async function nettoyer() {                                                          // supprime les absences de plus de 35 jours
  try {
    const snap = await getDocs(query(collection(db, ABSENTS), where('dateISO', '<', debutISO)));
    let supprimes = 0;
    for (let i = 0; i < snap.docs.length; i += 50) {
      const r = await Promise.allSettled(snap.docs.slice(i, i + 50).map(d => deleteDoc(d.ref)));
      supprimes += r.filter(x => x.status === 'fulfilled').length;
    }
    if (supprimes) toast(`${supprimes} ancienne(s) absence(s) supprimée(s).`);
  } catch (e) { console.warn('Nettoyage impossible :', e.code || e.message); }
}

dessiner();
let demarre = false;
onAuthStateChanged(auth, async u => {
  if (!u) return (location.href = 'connexion.html');
  const p = await getDoc(doc(db, 'users', u.uid));
  if (!p.exists() || p.data().profil !== 'validator' || !p.data().actif) { await signOut(auth); return (location.href = 'connexion.html?attente=1'); }
  if (!demarre) { demarre = true; ecouter(); nettoyer(); }
});