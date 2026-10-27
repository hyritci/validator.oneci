// Menu latéral de Validator : une seule liste pour toutes les pages.
// Pour ajouter une page plus tard : ajoute une ligne dans PAGES (adresse, nom affiché au survol, icône).
const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
const svg = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
const PAGES = [
  { href: "index.html",        titre: "Accueil",                icone: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>') },
  { href: "points.html",       titre: "Points",                 icone: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5h6V6H9z"/><path d="M9 14l2 2 4-4"/>') },
  { href: "absents.html",      titre: "Absents",                icone: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M10 14l4 4M14 14l-4 4"/>') },
  { href: "justificatifs.html", titre: "Justificatifs",          icone: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9.5 15.5l2 2 3.5-3.5"/>') },
  { href: "permissions.html",  titre: "Demande de permission", icone: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.6-2 2.3-3 4-3s3.4 1 4 3"/>') }
];
const SORTIE = svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>');

const nav = document.getElementById("cote");
const page = location.pathname.split("/").pop() || "index.html";
nav.innerHTML = '<img src="img/logo-icone.png" alt="VALIDATOR">'
  + PAGES.map(p => `<a href="${p.href}" data-titre="${p.titre}" aria-label="${p.titre}"${p.href === page ? ' class="actif" aria-current="page"' : ""}>${p.icone}</a>`).join("")
  + `<button type="button" class="bas" id="quitter" data-titre="Se déconnecter" aria-label="Se déconnecter">${SORTIE}</button>`;

// Se déconnecter (en bas du menu)
document.getElementById("quitter").onclick = async () => {
  const [{ auth }, { signOut }] = await Promise.all([import("./firebase-config.js"), import(FB + "firebase-auth.js")]);
  await signOut(auth);
  location.href = "connexion.html";
};