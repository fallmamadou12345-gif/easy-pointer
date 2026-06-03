const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// ── Route PUBLIQUE pour l'app agent (liste sans auth, sans photos) ──
router.get('/public', (req, res) => {
  const agents = db.prepare('SELECT id,nom,prenom,poste,contrat,horaire,tel,email,date_embauche,actif,zone_defaut FROM agents WHERE actif=1 ORDER BY nom').all();
  const result = agents.map(ag => {
    const zones = db.prepare('SELECT zone_id FROM agent_zones WHERE agent_id = ?').all(ag.id);
    return { ...ag, zones: zones.map(z => z.zone_id) };
  });
  res.json(result);
});

// ── Routes protégées ──
router.use(authMiddleware);

router.get('/', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY nom').all();
  const result = agents.map(ag => {
    const zones = db.prepare('SELECT zone_id FROM agent_zones WHERE agent_id = ?').all(ag.id);
    return { ...ag, zones: zones.map(z => z.zone_id) };
  });
  res.json(result);
});

router.get('/:id', (req, res) => {
  const ag = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!ag) return res.status(404).json({ error: 'Agent introuvable' });
  const zones = db.prepare('SELECT zone_id FROM agent_zones WHERE agent_id = ?').all(ag.id);
  res.json({ ...ag, zones: zones.map(z => z.zone_id) });
});

router.post('/', (req, res) => {
  const { nom, prenom, poste, role, contrat, horaire, tel, email, date_embauche, zones, zone_defaut } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });
  const id = req.body.id || ('A' + String(Date.now()).slice(-6));
  db.prepare('INSERT INTO agents (id,nom,prenom,poste,role,contrat,horaire,tel,email,date_embauche,zone_defaut) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, nom, prenom||'', poste||'', role||'Agent', contrat||'CDI', horaire||'08:00-16:00', tel||'', email||'', date_embauche||'', zone_defaut||'');
  if (zones?.length) zones.forEach(z => db.prepare('INSERT OR IGNORE INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,?)')
    .run(id, z, z === zone_defaut ? 1 : 0));
  res.json({ success: true, id });
});

router.put('/:id', (req, res) => {
  const { nom, prenom, poste, role, contrat, horaire, tel, email, date_embauche, actif, photo_base64, zones, zone_defaut } = req.body;
  db.prepare('UPDATE agents SET nom=?,prenom=?,poste=?,role=?,contrat=?,horaire=?,tel=?,email=?,date_embauche=?,actif=?,photo_base64=?,zone_defaut=?,updated_at=? WHERE id=?')
    .run(nom, prenom||'', poste||'', role||'Agent', contrat||'CDI', horaire||'08:00-16:00', tel||'', email||'', date_embauche||'', actif??1, photo_base64||null, zone_defaut||'', new Date().toISOString(), req.params.id);
  if (zones !== undefined) {
    db.prepare('DELETE FROM agent_zones WHERE agent_id = ?').run(req.params.id);
    if (zones.length) zones.forEach(z => db.prepare('INSERT INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,?)')
      .run(req.params.id, z, z === zone_defaut ? 1 : 0));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM agent_zones WHERE agent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
