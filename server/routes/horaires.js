const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── CRUD Modèles horaires ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const types = db.prepare('SELECT * FROM horaires_types ORDER BY nom').all();
  // Pour chaque type, compter les agents assignés
  const result = types.map(t => ({
    ...t,
    nbAgents: db.prepare('SELECT COUNT(*) as n FROM agents WHERE horaire_type_id=? AND actif=1').get(t.id)?.n || 0
  }));
  res.json(result);
});

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM horaires_types WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Modèle introuvable' });
  const agents = db.prepare('SELECT id,nom,prenom,poste FROM agents WHERE horaire_type_id=? AND actif=1').all(req.params.id);
  res.json({ ...t, agents });
});

router.post('/', (req, res) => {
  const { nom, heure_debut, heure_fin, tolerance_retard, pause_midi, jours_travail, couleur } = req.body;
  if (!nom || !heure_debut || !heure_fin) return res.status(400).json({ error: 'nom, heure_debut, heure_fin requis' });
  const id = 'HT' + String(Date.now()).slice(-8);
  db.prepare(`INSERT INTO horaires_types (id,nom,heure_debut,heure_fin,tolerance_retard,pause_midi,jours_travail,couleur,created_by,updated_at) 
              VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(id, nom, heure_debut, heure_fin, tolerance_retard||15, pause_midi||0, jours_travail||'1,2,3,4,5', couleur||'#2563eb', req.user?.nom||'admin');
  res.json({ success: true, id });
});

router.put('/:id', (req, res) => {
  const { nom, heure_debut, heure_fin, tolerance_retard, pause_midi, jours_travail, couleur, actif } = req.body;
  db.prepare(`UPDATE horaires_types SET nom=?,heure_debut=?,heure_fin=?,tolerance_retard=?,pause_midi=?,jours_travail=?,couleur=?,actif=?,updated_at=datetime('now') WHERE id=?`)
    .run(nom, heure_debut, heure_fin, tolerance_retard||15, pause_midi||0, jours_travail||'1,2,3,4,5', couleur||'#2563eb', actif??1, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as n FROM agents WHERE horaire_type_id=?').get(req.params.id);
  if (used?.n > 0) return res.status(409).json({ error: `Ce modèle est utilisé par ${used.n} agent(s). Réassignez-les d'abord.` });
  db.prepare('DELETE FROM horaires_types WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Appliquer un modèle à plusieurs agents ────────────────────────────────────
router.post('/appliquer', (req, res) => {
  const { horaire_type_id, agent_ids } = req.body;
  if (!horaire_type_id || !Array.isArray(agent_ids) || !agent_ids.length)
    return res.status(400).json({ error: 'horaire_type_id et agent_ids requis' });

  const ht = db.prepare('SELECT * FROM horaires_types WHERE id=?').get(horaire_type_id);
  if (!ht) return res.status(404).json({ error: 'Modèle introuvable' });

  let count = 0;
  agent_ids.forEach(id => {
    db.prepare(`UPDATE agents SET horaire_type_id=?,heure_debut=?,heure_fin=?,tolerance_retard=?,jours_travail=?,updated_at=datetime('now') WHERE id=?`)
      .run(horaire_type_id, ht.heure_debut, ht.heure_fin, ht.tolerance_retard, ht.jours_travail, id);
    count++;
  });

  res.json({ success: true, count });
});

// ── Appliquer horaire individuel (sans modèle) ────────────────────────────────
router.put('/agent/:agent_id', (req, res) => {
  const { heure_debut, heure_fin, tolerance_retard, jours_travail, horaire_type_id } = req.body;
  db.prepare(`UPDATE agents SET heure_debut=?,heure_fin=?,tolerance_retard=?,jours_travail=?,horaire_type_id=?,updated_at=datetime('now') WHERE id=?`)
    .run(heure_debut, heure_fin, tolerance_retard||15, jours_travail||'1,2,3,4,5', horaire_type_id||null, req.params.agent_id);
  res.json({ success: true });
});

module.exports = router;
