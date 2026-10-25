// Liste déroulante avec recherche automatique (insensible aux accents, majuscules et apostrophes).
// Tape n'importe quelles lettres : tous les noms qui les contiennent s'affichent.
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").toLowerCase();
export function listeRecherche(zone, items, onChoix) {
  zone.classList.add('lr');
  zone.innerHTML = `<button type="button" class="lr-btn"><span>Sélectionnez un élément</span><i></i></button>
    <div class="lr-panel" hidden><input class="lr-q" placeholder="Tapez pour rechercher..." autocomplete="off"><ul></ul></div>`;
  const btn = zone.querySelector('.lr-btn'), panel = zone.querySelector('.lr-panel');
  const q = zone.querySelector('.lr-q'), ul = zone.querySelector('ul');
  const index = items.map(x => ({ ...x, k: norm(x.nom) }));
  let actif = null;
  const fermer = () => { panel.hidden = true; zone.classList.remove('ouvert'); };
  const afficher = () => {
    const mots = norm(q.value).split(/\s+/).filter(Boolean);
    const res = index.filter(x => mots.every(m => x.k.includes(m)));
    ul.innerHTML = res.length ? '' : '<li class="vide">Aucun résultat</li>';
    res.forEach(x => {
      const li = document.createElement('li');
      li.textContent = x.nom;
      if (actif && actif.id === x.id) li.className = 'sel';
      li.onclick = () => { actif = x; btn.querySelector('span').textContent = x.nom; btn.classList.add('plein'); fermer(); onChoix(x); };
      ul.append(li);
    });
  };
  btn.onclick = () => {
    if (!panel.hidden) return fermer();
    panel.hidden = false; zone.classList.add('ouvert'); q.value = ''; afficher(); q.focus();
  };
  q.oninput = afficher;
  document.addEventListener('click', e => { if (!zone.contains(e.target)) fermer(); });
}