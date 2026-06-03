const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/planning?date_debut=&date_fin=&agent_id=
router.get('/', (req, res) => {
  const { date_debut, date_fin, agent_id } = req.query;
  let sql = 'SELECT * FROM planning WHERE 1=1';
  const p = [];
  if (agent_id)  { sql += ' AND agent_id = ?'; p.push(agent_id); }
  if (date_debut){ sql += ' AND date >= ?'; p.push(date_debut); }
  if (date_fin)  { sql += ' AND date <= ?'; p.push(date_fin); }
  res.json(db.prepare(sql).all(...p));
});

// POST /api/planning — créer ou mettre à jour un shift
router.post('/', (req, res) => {
  const { agent_id, date, shift_id, note } = req.body;
  if (!agent_id || !date) return res.status(400).json({ error: 'agent_id et date requis' });
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO planning (id,agent_id,date,shift_id,note,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(agent_id,date) DO UPDATE SET shift_id=excluded.shift_id,note=excluded.note,updated_at=excluded.updated_at`)
    .run(uuidv4(), agent_id, date, shift_id||'repos', note||null, now, now);
  res.json({ success: true });
});

// POST /api/planning/bulk — mise à jour en masse
router.post('/bulk', (req, res) => {
  const { updates } = req.body; // [{agent_id,date,shift_id}]
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates doit être un tableau' });
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO planning (id,agent_id,date,shift_id,updated_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(agent_id,date) DO UPDATE SET shift_id=excluded.shift_id,updated_at=excluded.updated_at`);
  const tx = db.transaction(() => updates.forEach(u => stmt.run(uuidv4(), u.agent_id, u.date, u.shift_id||'repos', now)));
  tx();
  res.json({ success: true, count: updates.length });
});

module.exports = router;
