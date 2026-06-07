const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
const HEURES_REF = 8;

function calcDuree(a, b) {
  if (!a || !b) return null;
  const [ah,am]=a.slice(0,5).split(':').map(Number),[bh,bm]=b.slice(0,5).split(':').map(Number);
  return ((bh*60+bm)-(ah*60+am))/60;
}
function fmtH(h) {
  if (h===null||h===undefined) return '—';
  const neg=h<0,abs=Math.abs(h),hh=Math.floor(abs),mm=Math.round((abs-hh)*60);
  return `${neg?'-':''}${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}`;
}

router.get('/', (req, res) => {
  const { mois, annee, agent_id, period } = req.query;
  const agents = db.prepare('SELECT * FROM agents WHERE actif=1' + (agent_id?' AND id=?':'')).all(...(agent_id?[agent_id]:[]));
  
  const result = agents.map(agent => {
    let sql = 'SELECT * FROM pointages WHERE agent_id=?';
    const params = [agent.id];
    if (mois) { sql += " AND strftime('%Y-%m',date)=?"; params.push(mois); }
    else if (annee) { sql += " AND strftime('%Y',date)=?"; params.push(annee); }
    const pts = db.prepare(sql).all(...params);
    
    const joursPresents = pts.filter(p=>p.arrivee).length;
    const totalH = pts.reduce((s,p)=>s+(calcDuree(p.arrivee,p.depart)||0),0);
    const refH = joursPresents * HEURES_REF;
    const supH = Math.max(0, totalH-refH);
    const defH = Math.max(0, refH-totalH);
    return {
      agent, joursPresents,
      totalH: Math.round(totalH*100)/100, totalHFmt: fmtH(totalH),
      supH: Math.round(supH*100)/100,   supHFmt: fmtH(supH),
      defH: Math.round(defH*100)/100,   defHFmt: fmtH(defH),
      balance: Math.round((totalH-refH)*100)/100, balanceFmt: fmtH(totalH-refH),
    };
  });
  res.json(result);
});

router.get('/csv', (req, res) => {
  const { mois } = req.query;
  let sql = 'SELECT a.nom,a.prenom,a.poste,a.contrat,p.date,p.arrivee,p.depart,p.statut,z.nom as zone_nom FROM agents a LEFT JOIN pointages p ON a.id=p.agent_id LEFT JOIN zones z ON p.zone_id=z.id WHERE a.actif=1';
  const params = [];
  if (mois) { sql += " AND strftime('%Y-%m',p.date)=?"; params.push(mois); }
  sql += ' ORDER BY a.nom,p.date';
  const rows = db.prepare(sql).all(...params);
  const csv = ['Nom,Prenom,Poste,Contrat,Date,Arrivee,Depart,Zone,Statut']
    .concat(rows.map(r=>`${r.nom||''},${r.prenom||''},${r.poste||''},${r.contrat||''},${r.date||''},${r.arrivee||''},${r.depart||''},${r.zone_nom||''},${r.statut||''}`))
    .join('\n');
  res.setHeader('Content-Type','text/csv;charset=utf-8');
  res.setHeader('Content-Disposition',`attachment;filename=rapport_${mois||'all'}.csv`);
  res.send('\uFEFF'+csv);
});

module.exports = router;
