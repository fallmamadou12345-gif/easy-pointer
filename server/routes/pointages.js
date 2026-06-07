const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

function haversine(la1,lo1,la2,lo2){const R=6371000,r=x=>x*Math.PI/180;const a=Math.sin(r(la2-la1)/2)**2+Math.cos(r(la1))*Math.cos(r(la2))*Math.sin(r(lo2-lo1)/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

function calcRetard(agent, arriveeStr) {
  if (!agent || !arriveeStr || !agent.heure_debut) return 0;
  const [ah,am] = agent.heure_debut.split(':').map(Number);
  const [bh,bm] = arriveeStr.slice(0,5).split(':').map(Number);
  const tol = agent.tolerance_retard || 15;
  const diffMin = (bh*60+bm) - (ah*60+am);
  return diffMin > tol ? diffMin : 0;
}

// ── ROUTES PUBLIQUES ──────────────────────────────────────────────────────────
router.get('/today', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const pointages = db.prepare(`SELECT p.*,a.nom,a.prenom,a.poste,a.photo_base64,z.nom as zone_nom,z.couleur as zone_couleur FROM pointages p JOIN agents a ON p.agent_id=a.id LEFT JOIN zones z ON p.zone_id=z.id WHERE p.date=? ORDER BY p.arrivee ASC`).all(today);
  const allAgents = db.prepare('SELECT * FROM agents WHERE actif=1').all();
  const presentIds = new Set(pointages.map(p=>p.agent_id));
  const d = new Date(today); const dayOfWeek = d.getDay();
  const absents = allAgents.filter(a => {
    const jours = (a.jours_travail||'1,2,3,4,5').split(',').map(Number);
    return jours.includes(dayOfWeek) && !presentIds.has(a.id);
  });
  res.json({pointages, absents, date:today});
});

router.post('/scan', (req, res) => {
  const {agent_id, lat, lon, selfie} = req.body;
  if (!agent_id) return res.status(400).json({error:'agent_id requis'});
  const agent = db.prepare('SELECT * FROM agents WHERE id=? AND actif=1').get(agent_id);
  if (!agent) return res.status(404).json({error:'Agent introuvable'});

  const agentZones = db.prepare('SELECT z.* FROM zones z JOIN agent_zones az ON z.id=az.zone_id WHERE az.agent_id=? AND z.actif=1').all(agent_id);
  let zoneValidee=null, distanceMin=Infinity;
  if (lat&&lon&&agentZones.length>0) {
    for(const z of agentZones){const d=haversine(lat,lon,z.lat,z.lon);if(d<distanceMin)distanceMin=d;if(d<=z.rayon){zoneValidee={...z,distance:d};break;}}
    if (!zoneValidee) {
      db.prepare('INSERT INTO journal_securite (id,agent_id,timestamp,lat,lon,zone_id,distance,raison) VALUES (?,?,?,?,?,?,?,?)').run(uuidv4(),agent_id,new Date().toISOString(),lat,lon,agentZones[0]?.id,Math.round(distanceMin),'Hors zone');
      return res.status(403).json({error:'HORS_ZONE',message:`Vous êtes à ${Math.round(distanceMin)}m (max:${agentZones[0]?.rayon}m)`,distance:Math.round(distanceMin),rayon:agentZones[0]?.rayon});
    }
  }

  const today = new Date().toISOString().slice(0,10);
  const time = new Date().toTimeString().slice(0,8);
  const existing = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agent_id, today);
  let action;
  if (!existing) {
    const retardMin = calcRetard(agent, time);
    db.prepare('INSERT INTO pointages (id,agent_id,date,arrivee,zone_id,lat,lon,distance,selfie,statut,retard_minutes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(uuidv4(),agent_id,today,time,zoneValidee?.id||null,lat||null,lon||null,distanceMin<Infinity?Math.round(distanceMin):null,selfie?1:0,'valide',retardMin);
    action='arrivee';
    if(retardMin>0) {
      db.prepare("INSERT INTO alertes (id,agent_id,type,message,date) VALUES (?,?,?,?,?)").run(uuidv4(),agent_id,'retard',`Retard de ${retardMin} minutes`,today);
    }
  } else if (!existing.depart) {
    // Calculer départ anticipé
    const [dh,dm] = (agent.heure_fin||'16:00').split(':').map(Number);
    const [ah,am] = time.slice(0,5).split(':').map(Number);
    const departAnticipeMin = Math.max(0,(dh*60+dm)-(ah*60+am));
    db.prepare('UPDATE pointages SET depart=?,depart_anticipe_minutes=? WHERE agent_id=? AND date=?').run(time,departAnticipeMin,agent_id,today);
    action='depart';
  } else { action='already'; }

  const updated = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agent_id, today);
  res.json({action, agent:{nom:agent.nom,prenom:agent.prenom}, pointage:updated, zone:zoneValidee});
});

// ── ROUTES PROTÉGÉES ──────────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const {agent_id,date_debut,date_fin,date} = req.query;
  let sql='SELECT p.*,a.nom,a.prenom FROM pointages p JOIN agents a ON p.agent_id=a.id WHERE 1=1';
  const p=[];
  if(agent_id){sql+=' AND p.agent_id=?';p.push(agent_id);}
  if(date){sql+=' AND p.date=?';p.push(date);}
  if(date_debut){sql+=' AND p.date>=?';p.push(date_debut);}
  if(date_fin){sql+=' AND p.date<=?';p.push(date_fin);}
  sql+=' ORDER BY p.date DESC LIMIT 200';
  res.json(db.prepare(sql).all(...p));
});

router.put('/:id', authMiddleware, (req, res) => {
  const {arrivee,depart,note} = req.body;
  const pt = db.prepare('SELECT p.*,a.tolerance_retard,a.heure_debut FROM pointages p JOIN agents a ON p.agent_id=a.id WHERE p.id=?').get(req.params.id);
  const retardMin = arrivee ? calcRetard({tolerance_retard:pt?.tolerance_retard,heure_debut:pt?.heure_debut},arrivee) : 0;
  db.prepare('UPDATE pointages SET arrivee=?,depart=?,note=?,statut="manuel",retard_minutes=? WHERE id=?').run(arrivee||null,depart||null,note||null,retardMin,req.params.id);
  res.json({success:true});
});

router.get('/journal', authMiddleware, (req, res) => {
  const {agent_id,limit} = req.query;
  let sql='SELECT j.*,a.nom,a.prenom,z.nom as zone_nom FROM journal_securite j JOIN agents a ON j.agent_id=a.id LEFT JOIN zones z ON j.zone_id=z.id WHERE 1=1';
  const p=[]; if(agent_id){sql+=' AND j.agent_id=?';p.push(agent_id);}
  sql+=' ORDER BY j.timestamp DESC';
  if(limit){sql+=' LIMIT ?';p.push(parseInt(limit));}
  res.json(db.prepare(sql).all(...p));
});

// Alertes
router.get('/alertes', authMiddleware, (req, res) => {
  const alertes = db.prepare('SELECT al.*,a.nom,a.prenom FROM alertes al JOIN agents a ON al.agent_id=a.id ORDER BY al.created_at DESC LIMIT 50').all();
  res.json(alertes);
});

module.exports = router;

// GET pointages d'un agent spécifique (public pour app agent)
router.get('/agent/:agent_id', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,z.nom as zone_nom FROM pointages p LEFT JOIN zones z ON p.zone_id=z.id
    WHERE p.agent_id=? ORDER BY p.date DESC LIMIT 60
  `).all(req.params.agent_id);
  res.json(rows);
});
