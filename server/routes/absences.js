const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  const { agent_id, mois } = req.query;
  let sql = 'SELECT ab.*, a.nom, a.prenom, a.poste FROM absences ab JOIN agents a ON ab.agent_id=a.id WHERE 1=1';
  const p = [];
  if (agent_id) { sql += ' AND ab.agent_id=?'; p.push(agent_id); }
  if (mois)     { sql += " AND strftime('%Y-%m',ab.date_debut)=?"; p.push(mois); }
  sql += ' ORDER BY ab.date_debut DESC';
  res.json(db.prepare(sql).all(...p));
});

router.post('/', (req, res) => {
  const { agent_id, date_debut, date_fin, type, justifie, motif } = req.body;
  if (!agent_id || !date_debut) return res.status(400).json({ error: 'agent_id et date_debut requis' });
  const id = uuidv4();
  db.prepare('INSERT INTO absences (id,agent_id,date_debut,date_fin,type,justifie,motif,approuve,approuve_par) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, agent_id, date_debut, date_fin||date_debut, type||'absence', justifie?1:0, motif||'', 1, req.user?.nom||'admin');
  res.json({ success: true, id });
});

router.put('/:id', (req, res) => {
  const { justifie, motif, type, approuve } = req.body;
  db.prepare('UPDATE absences SET justifie=?,motif=?,type=?,approuve=?,approuve_par=? WHERE id=?')
    .run(justifie?1:0, motif||'', type||'absence', approuve?1:0, req.user?.nom||'admin', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM absences WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
