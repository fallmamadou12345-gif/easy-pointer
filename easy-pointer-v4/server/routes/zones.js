const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// GET public — app agent peut lire les zones
router.get('/', (req, res) => {
  const zones = db.prepare('SELECT id,nom,ville,adresse,lat,lon,rayon,couleur,actif FROM zones ORDER BY nom').all();
  const result = zones.map(z => ({
    ...z,
    agentCount: db.prepare('SELECT COUNT(*) as n FROM agent_zones WHERE zone_id=?').get(z.id)?.n||0
  }));
  res.json(result);
});

router.get('/:id', authMiddleware, (req, res) => {
  const z = db.prepare('SELECT * FROM zones WHERE id=?').get(req.params.id);
  if (!z) return res.status(404).json({ error: 'Zone introuvable' });
  const agents = db.prepare('SELECT a.id,a.nom,a.prenom,a.poste,az.est_defaut FROM agents a JOIN agent_zones az ON a.id=az.agent_id WHERE az.zone_id=?').all(req.params.id);
  res.json({ ...z, agents });
});

router.post('/', authMiddleware, (req, res) => {
  const { nom, ville, adresse, lat, lon, rayon, couleur, actif } = req.body;
  if (!nom || !lat || !lon) return res.status(400).json({ error: 'Nom, lat et lon requis' });
  const id = 'Z' + String(Date.now()).slice(-6);
  db.prepare('INSERT INTO zones (id,nom,ville,adresse,lat,lon,rayon,couleur,actif,cree_par) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, nom, ville||'Dakar', adresse||'', parseFloat(lat), parseFloat(lon), parseInt(rayon)||150, couleur||'#2563eb', actif??1, req.user?.nom||'admin');
  res.json({ success: true, id });
});

router.put('/:id', authMiddleware, (req, res) => {
  const { nom, ville, adresse, lat, lon, rayon, couleur, actif } = req.body;
  db.prepare('UPDATE zones SET nom=?,ville=?,adresse=?,lat=?,lon=?,rayon=?,couleur=?,actif=?,updated_at=? WHERE id=?')
    .run(nom, ville||'Dakar', adresse||'', parseFloat(lat), parseFloat(lon), parseInt(rayon)||150, couleur||'#2563eb', actif??1, new Date().toISOString(), req.params.id);
  res.json({ success: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as n FROM agent_zones WHERE zone_id=?').get(req.params.id);
  if (used?.n > 0) return res.status(409).json({ error: 'Zone assignée à des agents' });
  db.prepare('DELETE FROM zones WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.put('/:id/toggle', authMiddleware, (req, res) => {
  const z = db.prepare('SELECT actif FROM zones WHERE id=?').get(req.params.id);
  db.prepare('UPDATE zones SET actif=? WHERE id=?').run(z?.actif?0:1, req.params.id);
  res.json({ success: true });
});

module.exports = router;
