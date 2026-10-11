// Équipes (= lieux) et scénarios. Les identifiants (CA, MOD, AR…) sont ceux enregistrés par VALIDATEC.
export const EQUIPES = [
  { valeur: 'TOUTES',       label: 'Toutes les équipes', heures: '' },
  { valeur: 'BASSAM 1',     label: 'BASSAM 1',     heures: '7h30 - 16h30' },
  { valeur: 'BASSAM 2',     label: 'BASSAM 2',     heures: '7h30 - 16h30' },
  { valeur: 'COCODY MATIN', label: 'COCODY MATIN', heures: '07h00 - 12h00' },
  { valeur: 'COCODY MIDI',  label: 'COCODY MIDI',  heures: '12h15 - 16h15' },
  { valeur: 'COCODY SOIR',  label: 'COCODY SOIR',  heures: '16h30 - 20h30' },
  { valeur: 'COCODY FIXE',  label: 'COCODY FIXE',  heures: '8h00 - 17h00' }
];

// Noms affichés dans les cartes pour chaque champ
export const LIBELLES = { Pr: 'Productions', Pm: 'Pause Modif', Pca: 'Pause Contrôle Auth', Fr: 'Fraude', Fu: 'Fusion', Nv: 'Nouveau', Fnt: 'Fill non trouvée' };

// Ordre = ordre des cartes. « excel » = titre du groupe dans le fichier Excel.
export const SCENARIOS = [
  { id: 'CA',    nom: 'Contrôle Auth',        excel: 'CA',           champs: ['Dt', 'Pr', 'Pm', 'Pca', 'Fr'] },
  { id: 'MOD',   nom: 'Modification',         excel: 'MODIFICATION', champs: ['Dt', 'Pr', 'Pm', 'Pca', 'Fr'] },
  { id: 'AR',    nom: 'Adj Renouvellement',   excel: 'AR',           champs: ['Dt', 'Pr', 'Pm', 'Fr'] },
  { id: 'APD',   nom: 'Adj Première Demande', excel: 'APD',          champs: ['Dt', 'Fr', 'Fu', 'Nv'] },
  { id: 'PCA',   nom: 'Pause Contrôle Auth',  excel: 'PCA',          champs: ['Dt', 'Pr', 'Pm', 'Fnt', 'Fr'] },
  { id: 'AUTRE', nom: 'Autre Tâche',          excel: 'AUTRE TÂCHE',  champs: [] }
];

// Ordre des groupes dans le fichier Excel (comme sur la feuille papier)
export const ORDRE_EXCEL = ['CA', 'MOD', 'AR', 'PCA', 'APD', 'AUTRE'];