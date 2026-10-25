// Export Excel de la page affichée, dans le format de la feuille papier (sans la partie « chef d'équipe »).
import { SCENARIOS, ORDRE_EXCEL } from './config.js';

const SC = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));
const fin = { style: 'thin', color: { argb: 'FF555555' } }, gros = { style: 'medium', color: { argb: 'FF000000' } };

export async function exporterExcel({ equipe, dateFr, dateISO, docs }) {
  const toutes = equipe === 'TOUTES';

  // 1. Une ligne par agent (et par lieu/heure pour « Toutes les équipes »)
  const map = new Map();
  docs.forEach(d => {
    const cle = toutes ? `${d.agentId}|${d.lieu}|${d.heure}` : d.agentId;
    const l = map.get(cle) || { nom: d.nom, lieu: `${d.lieu} · ${d.heure}`, sc: {} };
    Object.entries(d.scenarios || {}).forEach(([id, s]) => {
      const c = (l.sc[id] ||= {});
      Object.entries(s.champs || {}).forEach(([k, v]) => (c[k] = (c[k] || 0) + Number(v || 0)));
    });
    map.set(cle, l);
  });
  const lignes = [...map.values()].sort((a, b) =>
    (toutes ? a.lieu + a.nom : a.nom).localeCompare(toutes ? b.lieu + b.nom : b.nom, 'fr'));

  // 2. Colonnes : N°, NOM & PRENOMS, [LIEU & HEURE], puis les groupes de scénarios
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(toutes ? 'Toutes les équipes' : equipe,
    { pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const base = toutes ? 3 : 2;
  let col = base + 1;
  const groupes = ORDRE_EXCEL.map(id => {
    const s = SC[id], n = s.champs.length || 1, g = { s, a: col, b: col + n - 1 };
    col += n; return g;
  });
  const last = col - 1;

  // 3. En-tête : date + lieu, puis scénarios avec leurs points en dessous
  ws.mergeCells(1, 1, 1, base);
  ws.getCell(1, 1).value = `DATE : ${dateFr}`;
  ws.mergeCells(1, base + 1, 1, last);
  ws.getCell(1, base + 1).value = toutes ? 'TOUTES LES ÉQUIPES' : `LIEU : ${equipe}`;
  ['N°', 'NOM & PRENOMS', 'LIEU & HEURE'].slice(0, base).forEach((t, i) => {
    ws.mergeCells(2, i + 1, 3, i + 1); ws.getCell(2, i + 1).value = t;
  });
  groupes.forEach(g => {
    if (g.s.champs.length) {
      ws.mergeCells(2, g.a, 2, g.b); ws.getCell(2, g.a).value = g.s.excel;
      g.s.champs.forEach((k, i) => (ws.getCell(3, g.a + i).value = k.toUpperCase()));
    } else { ws.mergeCells(2, g.a, 3, g.a); ws.getCell(2, g.a).value = g.s.excel; }
  });

  // 4. Données
  lignes.forEach((l, i) => {
    const r = 4 + i;
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = l.nom;
    if (toutes) ws.getCell(r, 3).value = l.lieu;
    groupes.forEach(g => {
      const c = l.sc[g.s.id]; if (!c) return;
      if (g.s.champs.length) g.s.champs.forEach((k, j) => (ws.getCell(r, g.a + j).value = c[k] ?? 0));
      else ws.getCell(r, g.a).value = '✓';
    });
  });

  // 5. Mise en forme (bordures, fond des en-têtes, largeurs)
  const fr = Math.max(3, 3 + lignes.length);
  for (let r = 1; r <= fr; r++) for (let c = 1; c <= last; c++) {
    const cell = ws.getCell(r, c), debutGroupe = groupes.some(g => g.a === c);
    cell.font = { name: 'Calibri', size: r === 1 ? 12 : 11, bold: r <= 3 };
    cell.alignment = { vertical: 'middle', horizontal: r > 3 && (c === 2 || (toutes && c === 3)) ? 'left' : 'center' };
    cell.border = {
      top: r === 1 ? gros : fin, bottom: r === 3 || r === fr ? gros : fin,
      left: c === 1 || debutGroupe ? gros : fin, right: c === last ? gros : fin
    };
    if (r <= 3) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 1 ? 'FFFDE3BD' : 'FFE7E6E6' } };
  }
  ws.getRow(1).height = 24;
  ws.getColumn(1).width = 5; ws.getColumn(2).width = 40; if (toutes) ws.getColumn(3).width = 30;
  groupes.forEach(g => { for (let c = g.a; c <= g.b; c++) ws.getColumn(c).width = g.s.champs.length ? 6 : 14; });
  ws.views = [{ state: 'frozen', xSplit: base, ySplit: 3 }];

  // 6. Téléchargement
  const buf = await wb.xlsx.writeBuffer();
  const slug = (toutes ? 'Toutes-les-equipes' : equipe.replace(/\s+/g, '-')).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Points_${slug}_${dateISO}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}