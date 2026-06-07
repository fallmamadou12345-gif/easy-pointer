const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ── Calcul durée en minutes ──────────────────────────────────────────────────
function toMin(t) {
  if (!t) return null;
  const [h,m] = t.slice(0,5).split(':').map(Number);
  return h*60 + m;
}
function fmtH(min) {
  if (min===null||min===undefined) return '—';
  const neg=min<0, abs=Math.abs(min);
  return `${neg?'-':''}${String(Math.floor(abs/60)).padStart(2,'0')}h${String(abs%60).padStart(2,'0')}`;
}
function joursOuvres(debut, fin, joursTravail) {
  const jours = (joursTravail||'1,2,3,4,5').split(',').map(Number);
  let count=0, d=new Date(debut);
  while (d <= new Date(fin)) {
    if (jours.includes(d.getDay()===0?7:d.getDay())) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

// ── GET /rapports — données RH complètes ─────────────────────────────────────
router.get('/', (req, res) => {
  const { mois, annee, agent_id } = req.query;

  const agents = db.prepare(
    'SELECT * FROM agents WHERE actif=1' + (agent_id ? ' AND id=?' : '') + ' ORDER BY nom'
  ).all(...(agent_id ? [agent_id] : []));

  const result = agents.map(agent => {
    // Période
    let dateDebut, dateFin;
    if (mois) {
      const [y,m] = mois.split('-');
      dateDebut = `${y}-${m}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      dateFin = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;
    } else if (annee) {
      dateDebut = `${annee}-01-01`;
      dateFin   = `${annee}-12-31`;
    } else {
      const now = new Date();
      const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
      dateDebut = `${y}-${m}-01`;
      dateFin   = `${y}-${m}-${String(new Date(y,now.getMonth()+1,0).getDate()).padStart(2,'0')}`;
    }

    const pts = db.prepare(
      "SELECT * FROM pointages WHERE agent_id=? AND date>=? AND date<=? ORDER BY date"
    ).all(agent.id, dateDebut, dateFin);

    const hDebut = toMin(agent.heure_debut||'08:00');
    const hFin   = toMin(agent.heure_fin||'16:00');
    const refMin = hFin - hDebut;       // minutes de travail attendues / jour
    const tol    = agent.tolerance_retard || 15;
    const jours  = agent.jours_travail || '1,2,3,4,5';

    // Jours ouvrés dans la période
    const joursOuv = joursOuvres(dateDebut, dateFin, jours);

    // Pointages analysés
    let totalMin=0, retardMin=0, supMin=0, defMin=0, depAntMin=0;
    let nbRetards=0, nbDepAnticipe=0, joursPresents=0;
    const details = [];

    pts.forEach(p => {
      if (!p.arrivee) return;
      joursPresents++;
      const arrMin  = toMin(p.arrivee);
      const depMinV = p.depart ? toMin(p.depart) : null;
      const dur     = depMinV !== null ? depMinV - arrMin : 0;
      totalMin     += dur;

      // Retard
      const retard = Math.max(0, arrMin - hDebut - tol);
      if (retard > 0) { nbRetards++; retardMin += retard; }

      // Départ anticipé
      const depAnticipe = depMinV !== null ? Math.max(0, hFin - depMinV) : 0;
      if (depAnticipe > 5) { nbDepAnticipe++; depAntMin += depAnticipe; }

      // Heures sup
      const sup = Math.max(0, dur - refMin);
      supMin += sup;

      details.push({
        date: p.date, arrivee: p.arrivee, depart: p.depart||null,
        dureeMin: dur, retardMin: retard, depAnticipeMin: depAnticipe, supMin: sup,
        statut: p.statut
      });

      // Persister retard/sup dans pointages
      db.prepare('UPDATE pointages SET retard_minutes=?,depart_anticipe_minutes=?,heures_sup_minutes=? WHERE id=?')
        .run(retard, depAnticipe, sup, p.id);
    });

    // Absences = jours ouvrés sans pointage
    const pointesDates = new Set(pts.filter(p=>p.arrivee).map(p=>p.date));
    const absenceJours = [];
    let d = new Date(dateDebut);
    const joursT = jours.split(',').map(Number);
    while (d <= new Date(dateFin) && d <= new Date()) {
      const dow = d.getDay()===0?7:d.getDay();
      if (joursT.includes(dow)) {
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!pointesDates.has(ds)) {
          absenceJours.push(ds);
          // Enregistrer dans table absences
          db.prepare('INSERT OR IGNORE INTO absences (id,agent_id,date,type) VALUES (?,?,?,?)').run(uuidId(),agent.id,ds,'absence');
        }
      }
      d.setDate(d.getDate()+1);
    }

    defMin = Math.max(0, joursPresents * refMin - totalMin);
    const balance = totalMin - joursPresents * refMin;
    const taux = joursOuv > 0 ? Math.round(joursPresents/joursOuv*100) : 0;

    return {
      agent: { id:agent.id, nom:agent.nom, prenom:agent.prenom, poste:agent.poste, contrat:agent.contrat,
               heure_debut:agent.heure_debut, heure_fin:agent.heure_fin, photo_base64:agent.photo_base64 },
      periode: { debut:dateDebut, fin:dateFin },
      joursOuvres: joursOuv,
      joursPresents,
      joursAbsents: absenceJours.length,
      nbRetards,
      nbDepAnticipe,
      totalMin,    totalFmt:  fmtH(totalMin),
      refMin:      joursPresents*refMin, refFmt: fmtH(joursPresents*refMin),
      supMin,      supFmt:    fmtH(supMin),
      defMin,      defFmt:    fmtH(defMin),
      retardMin,   retardFmt: fmtH(retardMin),
      depAntMin,   depAntFmt: fmtH(depAntMin),
      balance,     balanceFmt:fmtH(balance),
      taux,
      // Alias pour compatibilité frontend
      totalH:    Math.round(totalMin/60*100)/100,
      totalHFmt: fmtH(totalMin),
      supH:      Math.round(supMin/60*100)/100,
      supHFmt:   fmtH(supMin),
      defH:      Math.round(defMin/60*100)/100,
      defHFmt:   fmtH(defMin),
      balanceFmt,
      details,
    };
  });

  res.json(result);
});

// ── GET /rapports/retardataires — retardataires du jour ─────────────────────
router.get('/retardataires', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const pts = db.prepare(`
    SELECT p.*,a.nom,a.prenom,a.poste,a.heure_debut,a.tolerance_retard
    FROM pointages p JOIN agents a ON p.agent_id=a.id
    WHERE p.date=? AND p.arrivee IS NOT NULL AND p.retard_minutes>0
    ORDER BY p.retard_minutes DESC
  `).all(today);
  res.json(pts);
});

// ── GET /rapports/absences — absences ────────────────────────────────────────
router.get('/absences', (req, res) => {
  const { mois, agent_id } = req.query;
  let sql = `SELECT ab.*,a.nom,a.prenom,a.poste FROM absences ab JOIN agents a ON ab.agent_id=a.id WHERE 1=1`;
  const p = [];
  if (mois)     { sql += " AND strftime('%Y-%m',ab.date)=?"; p.push(mois); }
  if (agent_id) { sql += ' AND ab.agent_id=?'; p.push(agent_id); }
  sql += ' ORDER BY ab.date DESC';
  res.json(db.prepare(sql).all(...p));
});

// ── GET /rapports/dashboard — stats dashboard temps réel ────────────────────
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const mois  = today.slice(0,7);

  const todayPts = db.prepare(`
    SELECT p.*,a.nom,a.prenom,a.poste,a.heure_debut,a.tolerance_retard,z.nom as zone_nom
    FROM pointages p JOIN agents a ON p.agent_id=a.id LEFT JOIN zones z ON p.zone_id=z.id
    WHERE p.date=?
  `).all(today);

  const allActifs = db.prepare('SELECT COUNT(*) as n FROM agents WHERE actif=1').get()?.n || 0;
  const presents  = todayPts.filter(p=>p.arrivee&&!p.depart).length;
  const sortis    = todayPts.filter(p=>p.depart).length;
  const absents   = allActifs - todayPts.length;
  const retardataires = todayPts.filter(p=>p.retard_minutes>0);

  // Stats mois
  const moisStats = db.prepare(`
    SELECT COUNT(*) as n,
           SUM(retard_minutes) as totalRetard,
           SUM(heures_sup_minutes) as totalSup,
           SUM(depart_anticipe_minutes) as totalDepAnticipe
    FROM pointages WHERE strftime('%Y-%m',date)=?
  `).get(mois);

  // Top retardataires mois
  const topRetard = db.prepare(`
    SELECT a.nom,a.prenom,a.poste,COUNT(*) as nbRetards,SUM(p.retard_minutes) as totalMin
    FROM pointages p JOIN agents a ON p.agent_id=a.id
    WHERE strftime('%Y-%m',p.date)=? AND p.retard_minutes>0
    GROUP BY p.agent_id ORDER BY nbRetards DESC LIMIT 5
  `).all(mois);

  // Absences mois
  const absencesMois = db.prepare(`
    SELECT COUNT(*) as n FROM absences WHERE strftime('%Y-%m',date)=?
  `).get(mois)?.n || 0;

  res.json({
    today: { presents, sortis, absents: Math.max(0,absents), retardataires, total: allActifs },
    mois: {
      ...moisStats,
      absences: absencesMois,
      topRetard,
    },
    pointages: todayPts,
  });
});

// ── GET /rapports/excel — export Excel ───────────────────────────────────────
router.get('/excel', async (req, res) => {
  const { mois } = req.query;
  // Récupérer les données de rapport
  const moisVal = mois || new Date().toISOString().slice(0,7);
  const [y,m] = moisVal.split('-');
  const dateDebut = `${y}-${m}-01`;
  const lastDay   = new Date(y, m, 0).getDate();
  const dateFin   = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;

  const agents = db.prepare('SELECT * FROM agents WHERE actif=1 ORDER BY nom').all();

  // Construire CSV étendu (compatible Excel via BOM UTF-8)
  const rows = [
    ['NOM','PRENOM','POSTE','CONTRAT','H.DEBUT','H.FIN','JOURS OUVRES','JOURS PRESENTS','ABSENCES','NB RETARDS','TOTAL RETARD(min)','TOTAL HEURES','HEURES SUP','DEFICIT','TAUX %']
  ];

  const fmtHMin = min => {
    if(!min) return '0h00';
    return `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;
  };

  agents.forEach(agent => {
    const pts = db.prepare("SELECT * FROM pointages WHERE agent_id=? AND date>=? AND date<=?").all(agent.id, dateDebut, dateFin);
    const hDebut = toMin(agent.heure_debut||'08:00');
    const hFin   = toMin(agent.heure_fin||'16:00');
    const refMin = hFin - hDebut;
    const tol    = agent.tolerance_retard || 15;
    let totalMin=0, retardMin=0, supMin=0, nbRetards=0, joursPresents=0;
    pts.forEach(p => {
      if (!p.arrivee) return;
      joursPresents++;
      const arrMin = toMin(p.arrivee);
      const depMin = p.depart ? toMin(p.depart) : null;
      const dur = depMin !== null ? depMin - arrMin : 0;
      totalMin += dur;
      const retard = Math.max(0, arrMin - hDebut - tol);
      if (retard > 0) { nbRetards++; retardMin += retard; }
      const sup = Math.max(0, dur - refMin);
      supMin += sup;
    });
    const joursOuv = joursOuvres(dateDebut, dateFin, agent.jours_travail||'1,2,3,4,5');
    const absences = joursOuv - joursPresents;
    const defMin   = Math.max(0, joursPresents * refMin - totalMin);
    const taux     = joursOuv > 0 ? Math.round(joursPresents/joursOuv*100) : 0;
    rows.push([
      agent.nom, agent.prenom||'', agent.poste||'', agent.contrat||'',
      agent.heure_debut||'08:00', agent.heure_fin||'16:00',
      joursOuv, joursPresents, absences, nbRetards, retardMin,
      fmtHMin(totalMin), fmtHMin(supMin), fmtHMin(defMin), taux+'%'
    ]);
  });

  // Pointages détaillés
  const ptsDet = [['NOM','PRENOM','DATE','ARRIVEE','DEPART','RETARD(min)','H.SUP(min)','ZONE','STATUT']];
  db.prepare(`
    SELECT a.nom,a.prenom,p.date,p.arrivee,p.depart,p.retard_minutes,p.heures_sup_minutes,z.nom as zone_nom,p.statut
    FROM pointages p JOIN agents a ON p.agent_id=a.id LEFT JOIN zones z ON p.zone_id=z.id
    WHERE p.date>=? AND p.date<=? ORDER BY a.nom,p.date
  `).all(dateDebut, dateFin).forEach(r => {
    ptsDet.push([r.nom,r.prenom||'',r.date,r.arrivee||'',r.depart||'',r.retard_minutes||0,r.heures_sup_minutes||0,r.zone_nom||'',r.statut||'']);
  });

  // Absences
  const absRows = [['NOM','PRENOM','DATE','TYPE','JUSTIFIE','MOTIF']];
  db.prepare(`
    SELECT a.nom,a.prenom,ab.date,ab.type,ab.justifie,ab.motif
    FROM absences ab JOIN agents a ON ab.agent_id=a.id
    WHERE strftime('%Y-%m',ab.date)=? ORDER BY a.nom,ab.date
  `).all(moisVal).forEach(r => {
    absRows.push([r.nom,r.prenom||'',r.date,r.type||'absence',r.justifie?'Oui':'Non',r.motif||'']);
  });

  // Construire fichier CSV multi-section
  const sep = '\n\n';
  const toCSV = rows => rows.map(r => r.map(v=>String(v).includes(',')?`"${v}"`:v).join(',')).join('\n');
  const content = [
    `=== RAPPORT RH · ${moisVal} ===`,
    toCSV(rows),
    `=== POINTAGES DÉTAILLÉS · ${moisVal} ===`,
    toCSV(ptsDet),
    `=== ABSENCES · ${moisVal} ===`,
    toCSV(absRows),
  ].join(sep);

  res.setHeader('Content-Type', 'text/csv;charset=utf-8');
  res.setHeader('Content-Disposition', `attachment;filename=rapport_RH_${moisVal}.csv`);
  res.send('\uFEFF' + content);
});

// ── GET /rapports/csv ────────────────────────────────────────────────────────
router.get('/csv', (req, res) => {
  const { mois } = req.query;
  let sql = `SELECT a.nom,a.prenom,a.poste,a.contrat,p.date,p.arrivee,p.depart,p.retard_minutes,p.heures_sup_minutes,z.nom as zone_nom,p.statut
    FROM agents a LEFT JOIN pointages p ON a.id=p.agent_id LEFT JOIN zones z ON p.zone_id=z.id WHERE a.actif=1`;
  const p = [];
  if (mois) { sql += " AND strftime('%Y-%m',p.date)=?"; p.push(mois); }
  sql += ' ORDER BY a.nom,p.date';
  const rows = db.prepare(sql).all(...p);
  const csv = ['Nom,Prenom,Poste,Contrat,Date,Arrivee,Depart,Retard(min),H.Sup(min),Zone,Statut']
    .concat(rows.map(r=>`${r.nom||''},${r.prenom||''},${r.poste||''},${r.contrat||''},${r.date||''},${r.arrivee||''},${r.depart||''},${r.retard_minutes||0},${r.heures_sup_minutes||0},${r.zone_nom||''},${r.statut||''}`))
    .join('\n');
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition',`attachment;filename=rapport_${mois||'all'}.csv`);
  res.send('\uFEFF'+csv);
});

// ── PUT /rapports/absences/:id — justifier une absence ──────────────────────
router.put('/absences/:id', (req, res) => {
  const { justifie, motif } = req.body;
  db.prepare('UPDATE absences SET justifie=?,motif=? WHERE id=?').run(justifie?1:0, motif||null, req.params.id);
  res.json({ success: true });
});

function uuidId() {
  return 'AB' + String(Date.now()).slice(-8) + Math.random().toString(36).slice(2,6);
}

module.exports = router;
