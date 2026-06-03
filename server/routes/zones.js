const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/zones
router.get('/', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones ORDER BY nom').all();
  const result = zones.map(z => {
    const agentCount = db.prepare('SELECT COUNT(*) as n FROM agent_zones WHERE zone_id = ?').get(z.id);
    return { ...z, agentCount: agentCount.n };
  });
  res.json(result);
});

// GET /api/zones/:id
router.get('/:id', (req, res) => {
  const z = db.prepare('SELECT * FROM zones WHERE id = ?').get(req.params.id);
  if (!z) return res.status(404).json({ error: 'Zone introuvable' });
  const agents = db.prepare(`
    SELECT a.id, a.nom, a.prenom, a.poste, az.est_defaut
    FROM agents a JOIN agent_zones az ON a.id = az.agent_id
    WHERE az.zone_id = ?
  `).all(req.params.id);
  res.json({ ...z, agents });
});

// POST /api/zones
router.post('/', (req, res) => {
  const { nom, ville, adresse, lat, lon, rayon, couleur, actif } = req.body;
  if (!nom || !lat || !lon) return res.status(400).json({ error: 'Nom, lat et lon sont requis' });
  const id = 'Z' + String(Date.now()).slice(-6);
  db.prepare(`INSERT INTO zones (id,nom,ville,adresse,lat,lon,rayon,couleur,actif,cree_par)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, nom, ville||'Dakar', adresse||'', parseFloat(lat), parseFloat(lon),
         parseInt(rayon)||150, couleur||'#2563eb', actif??1, req.user.nom||req.user.username);
  res.json({ success: true, id });
});

// PUT /api/zones/:id
router.put('/:id', (req, res) => {
  const { nom, ville, adresse, lat, lon, rayon, couleur, actif } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE zones SET nom=?,ville=?,adresse=?,lat=?,lon=?,rayon=?,couleur=?,actif=?,updated_at=?
    WHERE id=?`)
    .run(nom, ville||'Dakar', adresse||'', parseFloat(lat), parseFloat(lon),
         parseInt(rayon)||150, couleur||'#2563eb', actif??1, now, req.params.id);
  res.json({ success: true });
});

// DELETE /api/zones/:id
router.delete('/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as n FROM agent_zones WHERE zone_id = ?').get(req.params.id);
  if (used.n > 0) {
    return res.status(409).json({ error: 'Zone assignée à des agents — retirez les agents d\'abord' });
  }
  db.prepare('DELETE FROM zones WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/zones/:id/toggle — activer/désactiver
router.put('/:id/toggle', (req, res) => {
  db.prepare('UPDATE zones SET actif = NOT actif WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
