// Génère la « Demande d'autorisation d'absence » ONECI en PDF (A4), avec les mêmes champs que la fiche papier
// (y compris la partie réservée à la hiérarchie, laissée vide). Nécessite jsPDF (chargé dans la page).
const sur = s => String(s ?? '').replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\xFF]/g, '?');
const charger = url => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });

export async function genererPDF(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const BLEU = [15, 35, 120];                                     // couleur du texte rempli
  const pointilles = (x1, x2, y) => { doc.setDrawColor(40); doc.setLineWidth(0.25); doc.setLineDashPattern([0.25, 1.1], 0); doc.line(x1, y, x2, y); doc.setLineDashPattern([], 0); };

  // Un champ : libellé imprimé + pointillés + valeur remplie (réduite si elle est trop longue)
  const champ = (libelle, x, y, xFin, valeur = '', deuxLignes = false) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(0);
    if (libelle) doc.text(sur(libelle), x, y);
    const x0 = x + doc.getTextWidth(sur(libelle)) + 1;
    pointilles(x0, xFin, y + 0.8);
    let t = sur(valeur), taille = 10;
    if (!t) return;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLEU); doc.setFontSize(taille);
    const larg = xFin - x0 - 2;
    if (deuxLignes && doc.getTextWidth(t) > larg) {                 // nom long : écrit sur deux lignes
      doc.setFontSize(8);
      const lignes = doc.splitTextToSize(t, larg);
      if (lignes.length <= 2) { lignes.forEach((l, i) => doc.text(l, x0 + 1, y - 3.4 + i * 3.1)); doc.setTextColor(0); return; }
    }
    while (taille > 6.5 && doc.getTextWidth(t) > larg) doc.setFontSize((taille -= 0.5));
    while (t.length > 1 && doc.getTextWidth(t) > larg) t = t.slice(0, -1);
    doc.text(t, x0 + 1, y - 0.3);
    doc.setTextColor(0);
  };

  // En-tête
  try {
    const logo = await charger(new URL('../img/logo-oneci.png', import.meta.url).href);
    const w = 26, h = (w * logo.naturalHeight) / logo.naturalWidth;
    doc.addImage(logo, 'PNG', 15, 21.5 - h / 2, w, h);
  } catch { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('ONECI', 15, 22); }
  doc.setDrawColor(60); doc.setLineWidth(0.3); doc.line(41, 11, 41, 31);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(0);
  doc.text("DEMANDE D'AUTORISATION D'ABSENCE", 55, 24);
  doc.setLineWidth(0.4); doc.line(14, 35, 199, 35);
  doc.setFontSize(12);
  doc.text('N°', 27, 46); pointilles(33, 60, 46.8); doc.text('/ONECI/DG/DLRH', 60.5, 46);
  doc.text('Madame/Mademoiselle/Monsieur', 27, 57.5);

  // Cadre et séparations
  doc.setDrawColor(40); doc.setLineWidth(0.35);
  doc.rect(19, 60.7, 179.5, 205.7);
  [103, 147.8, 185.8].forEach(y => doc.line(19, y, 198.5, y));

  // Identité (la liste ne sépare pas nom et prénoms : tout est écrit sur la ligne NOM)
  const tel = String(d.telephone || '').replace(/(\d{2})(?=\d)/g, '$1 ');
  champ('NOM :', 21.5, 75, 80.5, d.nom, true);
  champ('PRENOMS', 82.4, 75, 196);
  champ('MATRICULE :', 21.5, 83, 80.5, d.matricule);
  champ('FONCTION', 81.6, 83, 196, d.fonction);
  champ('TELEPHONE', 21.5, 91.3, 84, tel);
  champ('ADRESSE ELECTRONIQUE', 85, 91.3, 196, d.email);
  champ('SERVICE', 21.5, 99.3, 82.5, d.service);
  champ('LIEU DE SERVICE', 83.7, 99.3, 196, d.lieuService);

  // Absence
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.text("Est autorisé(e) à s'absenter du service :", 22.5, 111.8);
  doc.setFontSize(10);
  const x0m = 22.6 + doc.getTextWidth("MOTIF DE L'ABSENCE") + 2;
  doc.setFont('helvetica', 'bold');
  const motif = sur(d.motif), l1 = doc.splitTextToSize(motif, 196 - x0m - 2)[0] || '';
  champ("MOTIF DE L'ABSENCE", 22.6, 120, 196, l1);
  champ('', 22.6, 127.4, 196, motif.slice(l1.length).trim());
  champ('DESTINATION', 22.8, 135.7, 97, d.destination);
  champ("PERIODE D'ABSENCE : DU", 98.5, 135.7, 169, d.periodeDu);
  champ('AU', 171.6, 135.7, 196, d.periodeAu);
  champ('DUREE :', 23, 143.8, 92, d.duree);
  champ('DATE DE REPRISE', 93.4, 143.8, 196, d.dateReprise);

  // Partie réservée à la DLRH (laissée vide)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0);
  doc.text('Partie réservée à la Direction de la Logistique et des Ressources Humaines', 23, 154);
  doc.setFont('times', 'normal'); doc.setFontSize(11);
  doc.text('A déduire des congés', 24, 171.7); doc.rect(65.5, 166.5, 15, 8.5);
  doc.text('A déduire du salaire', 85, 171.7); doc.rect(122.8, 165.8, 13.6, 8.4);
  doc.text('Absence légale', 145.5, 171.2); doc.rect(180.4, 164.5, 13.3, 8.6);

  // Signatures
  doc.setFontSize(10); doc.text('Abidjan le', 110.5, 203.6); pointilles(128, 196, 204.4);
  if (d.date) {                                                   // date de la demande, écrite sur « Abidjan le … »
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...BLEU);
    doc.text(sur(d.date), 131, 203.3); doc.setTextColor(0);
  }
  if (d.date) {                                                  // date de la demande, à côté de « Abidjan le »
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...BLEU);
    doc.text(sur(d.date), 131, 203.3); doc.setTextColor(0);
  }
  doc.setFontSize(11); doc.setFont('times', 'bold'); doc.text('Bénéficiaire', 25, 227);
  doc.setFont('times', 'normal'); const wa = doc.getTextWidth('Avis du '); doc.text('Avis du ', 73.3, 223.5);
  doc.setFont('times', 'bold'); doc.text('Supérieur', 73.3 + wa, 223.5); doc.text('Hiérarchique', 77.5, 228);
  doc.text('La Directrice de la Logistique', 131, 222.5); doc.text('et des Ressources Humaines', 133.3, 227);
  doc.text('Assétou NIMAGA épouse DIABY', 128.5, 254.7);
  if (d.signature) {                                              // signature du bénéficiaire
    const p = doc.getImageProperties(d.signature), h = Math.min(22, (44 * p.height) / p.width);
    doc.addImage(d.signature, 'PNG', 24, 231, (h * p.width) / p.height, h);
  }

  // Pied de page
  doc.setDrawColor(120); doc.setLineWidth(0.2); doc.line(30, 272, 194, 272);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
  doc.text('19, Boulevard Botreau Roussel | BP V 168 Abidjan Site Web : www.oneci.ci', 105, 277, { align: 'center' });
  doc.text('Tél : (225) 27 20 39 79 00 | Fax : (225) 27 20 24 29 13 | Call Center : (225) 27 20 23 96 60/ 1340', 105, 281.5, { align: 'center' });

  // Téléchargement
  const slug = String(d.nom || 'agent').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(doc.output('blob'));
  a.download = `Demande-permission_${slug}_${d.dateISO}.pdf`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}