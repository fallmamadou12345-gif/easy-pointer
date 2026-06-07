import { useState, useEffect } from 'react';

// ─── API robuste (sans auth requise pour les routes publiques) ────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  } catch (e) {
    console.warn('API error', path, e.message);
    throw e;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays = (ds, n) => { const d = new Date(ds); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const getMon = ds => { const d = new Date(ds), day = d.getDay(), diff = day === 0 ? -6 : 1-day; d.setDate(d.getDate()+diff); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const shortD = ds => { const d = new Date(ds); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`; };
const fmtDur = h => h ? `${Math.floor(h)}h${pad(Math.round((h%1)*60))}` : '—';
const moisOf = d => d ? d.slice(0,7) : '';

const SHIFTS = [
  { id:'matin',  label:'Matin',      heure:'06h–14h', color:'#d97706', bg:'#fef3c7' },
  { id:'jour',   label:'Journée',    heure:'08h–16h', color:'#2563eb', bg:'#dbeafe' },
  { id:'apm',    label:'Après-midi', heure:'10h–18h', color:'#7c3aed', bg:'#ede9fe' },
  { id:'soir',   label:'Soir',       heure:'14h–22h', color:'#ea580c', bg:'#ffedd5' },
  { id:'repos',  label:'Repos',      heure:'—',       color:'#64748b', bg:'#f1f5f9' },
  { id:'conge',  label:'Congé',      heure:'—',       color:'#059669', bg:'#d1fae5' },
];
const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS  = ['janv','févr','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];

function haversine(lat1,lon1,lat2,lon2) {
  const R=6371000, r=x=>x*Math.PI/180;
  const a=Math.sin(r(lat2-lat1)/2)**2+Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(r(lon2-lon1)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Av({ ag, size=44, border }) {
  const pal = ['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];
  const ci = ag?.id ? ag.id.charCodeAt(1) % pal.length : 0;
  const st = { width:size, height:size, borderRadius:'50%', flexShrink:0, ...(border ? {border:`3px solid ${border}`} : {}) };
  return ag?.photo_base64
    ? <img src={ag.photo_base64} alt="" style={{...st, objectFit:'cover'}}/>
    : <div style={{...st, background:pal[ci], display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:size*0.34, fontWeight:800}}>
        {(ag?.nom||'?')[0]}{(ag?.prenom||'')[0]}
      </div>;
}

// ─── QR CODE ─────────────────────────────────────────────────────────────────
function QR({ value, size=120 }) {
  const cells=21, cell=size/cells;
  const h=s=>{let x=0;for(let i=0;i<s.length;i++)x=(x*31+s.charCodeAt(i))%997;return x;};
  const dots=[];
  for(let r=0;r<cells;r++) for(let c=0;c<cells;c++) {
    const finder=(r<7&&c<7)||(r<7&&c>=cells-7)||(r>=cells-7&&c<7);
    const timing=(r===6||c===6)&&(r+c)%2===0;
    if(finder||timing||(!finder&&!timing&&h(value+r*100+c)%3!==0)) dots.push([r,c]);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx="6"/>
      {dots.map(([r,c])=><rect key={r+'-'+c} x={c*cell} y={r*cell} width={cell} height={cell} fill="#0f172a"/>)}
      <rect x={2.5*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
      <rect x={(cells-4.5)*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
      <rect x={2.5*cell} y={(cells-4.5)*cell} width={2*cell} height={2*cell} fill="white"/>
    </svg>
  );
}

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const I = {
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  scan:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  cal:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  shield:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  map:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  cam:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  check:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width:30,height:30}}><polyline points="20 6 9 17 4 12"/></svg>,
  alert:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:28,height:28}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  clock:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  edit:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  out:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  cl:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:17,height:17}}><polyline points="15 18 9 12 15 6"/></svg>,
  cr:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:17,height:17}}><polyline points="9 18 15 12 9 6"/></svg>,
  phone:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 4.69 12 19.79 19.79 0 0 1 1.09 3.6 2 2 0 0 1 3.1 1.09h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.4 6.4l.97-.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  mail:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════
// ÉCRAN LOGIN
// ═══════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [agents, setAgents]   = useState([]);
  const [status, setStatus]   = useState('loading'); // loading | list | pin | error
  const [sel, setSel]         = useState(null);
  const [pin, setPin]         = useState('');
  const [pinErr, setPinErr]   = useState(false);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    apiFetch('/agents/public')
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
          setStatus('list');
        } else {
          setErrMsg('Aucun agent trouvé dans la base de données.');
          setStatus('error');
        }
      })
      .catch(e => {
        setErrMsg('Impossible de contacter le serveur. Vérifiez votre connexion.');
        setStatus('error');
      });
  }, []);

  function selectAgent(ag) { setSel(ag); setPin(''); setPinErr(false); setStatus('pin'); }
  function backToList()    { setSel(null); setPin(''); setStatus('list'); }

  function handlePin(k) {
    if (k === 'del') { setPin(p => p.slice(0,-1)); return; }
    const np = pin + k;
    setPin(np);
    if (np.length === 4) {
      const expected = sel.id.replace(/\D/g,'').slice(-4).padStart(4,'0');
      if (np === '1234' || np === expected) {
        setTimeout(() => onLogin(sel), 250);
      } else {
        setPinErr(true);
        setTimeout(() => { setPin(''); setPinErr(false); }, 800);
      }
    }
  }

  const BG = 'linear-gradient(160deg,#0f172a 0%,#1a3a5c 55%,#1e4d8c 100%)';

  // ── Chargement ──
  if (status === 'loading') return (
    <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:BG, gap:16}}>
      <div style={{width:54, height:54, background:'#e85d04', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'#fff'}}>EP</div>
      <div style={{width:36, height:36, border:'3px solid rgba(255,255,255,0.15)', borderTopColor:'#e85d04', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
      <div style={{color:'rgba(255,255,255,0.5)', fontSize:13}}>Connexion au serveur…</div>
    </div>
  );

  // ── Erreur ──
  if (status === 'error') return (
    <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:BG, gap:16, padding:24}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{color:'#fff', fontWeight:700, fontSize:16, textAlign:'center'}}>Connexion impossible</div>
      <div style={{color:'rgba(255,255,255,0.5)', fontSize:12, textAlign:'center', lineHeight:1.6}}>{errMsg}</div>
      <button onClick={() => { setStatus('loading'); setErrMsg(''); apiFetch('/agents/public').then(d=>{setAgents(d);setStatus('list');}).catch(e=>{setErrMsg(e.message);setStatus('error');}); }}
        style={{background:'#e85d04', color:'#fff', border:'none', borderRadius:12, padding:'11px 24px', fontWeight:700, fontSize:14, cursor:'pointer'}}>
        Réessayer
      </button>
    </div>
  );

  // ── PIN ──
  if (status === 'pin' && sel) return (
    <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', background:BG, overflow:'auto'}}>
      <div style={{padding:'32px 24px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:'100%'}}>
        <Av ag={sel} size={72} border="rgba(255,255,255,0.35)"/>
        <div style={{color:'#fff', fontWeight:800, fontSize:18}}>{sel.nom} {sel.prenom}</div>
        <div style={{color:'rgba(255,255,255,0.45)', fontSize:11}}>{sel.poste}</div>
        <div style={{display:'flex', gap:14, marginTop:12, marginBottom:4}}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{width:14, height:14, borderRadius:'50%',
              background: i < pin.length ? (pinErr ? '#ef4444' : '#e85d04') : 'rgba(255,255,255,0.2)',
              border:'2px solid rgba(255,255,255,0.25)',
              transform: i < pin.length ? 'scale(1.25)' : 'scale(1)',
              transition:'all 0.15s'}}/>
          ))}
        </div>
        {pinErr && <div style={{color:'#f87171', fontSize:11, fontWeight:600, marginBottom:4}}>Code incorrect</div>}
        <div style={{background:'rgba(255,255,255,0.06)', borderRadius:10, padding:'7px 14px', fontSize:11, color:'rgba(255,255,255,0.35)', textAlign:'center'}}>
          Code : <b style={{color:'rgba(255,255,255,0.65)'}}>1234</b> ou les 4 derniers chiffres de votre ID
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, width:'100%', maxWidth:260, padding:'18px 0'}}>
        {['1','2','3','4','5','6','7','8','9','','0','del'].map(k => (
          <button key={k} onClick={() => k && handlePin(k)}
            style={{height:56, borderRadius:14, border:'none', cursor:k?'pointer':'default',
              background:k==='del'?'rgba(255,255,255,0.07)':k?'rgba(255,255,255,0.1)':'transparent',
              color:k==='del'?'#94a3b8':'#fff', fontSize:k==='del'?18:22, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center'}}>
            {k==='del'?'⌫':k}
          </button>
        ))}
      </div>
      <button onClick={backToList} style={{background:'transparent', border:'none', color:'rgba(255,255,255,0.35)', fontSize:12, cursor:'pointer', textDecoration:'underline', marginBottom:20}}>
        ← Changer de compte
      </button>
    </div>
  );

  // ── Liste des agents ──
  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', background:BG, overflow:'hidden'}}>
      <div style={{padding:'28px 22px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
        <div style={{width:50, height:50, background:'#e85d04', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff', boxShadow:'0 6px 20px rgba(232,93,4,0.5)'}}>EP</div>
        <div style={{color:'#fff', fontWeight:800, fontSize:19}}>Easy Pointer</div>
        <div style={{display:'flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:20, padding:'3px 11px'}}>
          {I.shield}<span style={{color:'#86efac', fontSize:9, fontWeight:700, letterSpacing:'0.08em'}}>APPLICATION AGENT</span>
        </div>
      </div>
      <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:600, textAlign:'center', marginBottom:10}}>
        Sélectionnez votre compte
      </div>
      <div style={{flex:1, overflow:'auto', padding:'0 16px 16px'}}>
        {agents.map(ag => (
          <div key={ag.id} onClick={() => selectAgent(ag)}
            style={{background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)', borderRadius:14, padding:'11px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', border:'1px solid rgba(255,255,255,0.09)', marginBottom:8, transition:'all 0.15s'}}>
            <Av ag={ag} size={44} border="rgba(255,255,255,0.2)"/>
            <div style={{flex:1}}>
              <div style={{color:'#fff', fontWeight:700, fontSize:14}}>{ag.nom} {ag.prenom}</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:1}}>{ag.poste}</div>
            </div>
            <span style={{color:'rgba(255,255,255,0.3)', fontSize:20}}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉCRAN ACCUEIL
// ═══════════════════════════════════════════════════════════════════
function HomeScreen({ agent, clock, setTab }) {
  const [pt, setPt]         = useState(null);   // pointage aujourd'hui
  const [plan, setPlan]     = useState({});      // planning semaine
  const [hist, setHist]     = useState([]);      // historique

  const todayStr = today();
  const d = new Date();

  useEffect(() => {
    // Pointage du jour
    apiFetch('/pointages/today')
      .then(data => { const p = data.pointages?.find(x => x.agent_id === agent.id) || null; setPt(p); })
      .catch(() => {});
    // Planning semaine
    const mon = getMon(todayStr);
    apiFetch(`/planning?agent_id=${agent.id}&date_debut=${mon}&date_fin=${addDays(mon,13)}`)
      .then(rows => { const m = {}; rows.forEach(r => m[r.date] = r.shift_id); setPlan(m); })
      .catch(() => {});
    // Historique
    apiFetch(`/pointages?agent_id=${agent.id}`)
      .then(rows => setHist(rows.slice(0,5)))
      .catch(() => {});
  }, [agent.id]);

  const status = !pt ? 'absent' : !pt.depart ? 'present' : 'sorti';
  const sc = {
    absent:  { label:'Pas encore pointé',   c:'#f59e0b', bg:'rgba(245,158,11,0.15)' },
    present: { label:'Présent · En cours',  c:'#22c55e', bg:'rgba(34,197,94,0.15)' },
    sorti:   { label:'Journée terminée',    c:'#60a5fa', bg:'rgba(96,165,250,0.15)' },
  }[status];

  const getShift = ds => SHIFTS.find(s => s.id === (plan[ds]||'repos')) || SHIFTS[4];
  const todayShift    = getShift(todayStr);
  const tomorrowShift = getShift(addDays(todayStr,1));

  const moisPts = hist.filter(p => moisOf(p.date) === moisOf(todayStr));
  const totalH  = moisPts.reduce((a,p) => a + (p.arrivee&&p.depart ? (new Date('2000-01-01T'+p.depart)-new Date('2000-01-01T'+p.arrivee))/3600000 : 0), 0);
  const joursP  = moisPts.filter(p => p.arrivee).length;

  return (
    <div style={{flex:1, overflow:'auto', background:'#f0f4f8'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 60%,#1e4d8c 100%)', padding:'20px 18px 56px', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.03)'}}/>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{color:'rgba(255,255,255,0.45)', fontSize:10, fontWeight:600, textTransform:'uppercase'}}>
              {JOURS[d.getDay()]} {d.getDate()} {MOIS[d.getMonth()]}
            </div>
            <div style={{color:'#fff', fontWeight:800, fontSize:20, marginTop:3}}>Bonjour {agent.nom} 👋</div>
            <div style={{color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:1}}>{agent.poste}</div>
          </div>
          <div style={{color:'rgba(255,255,255,0.85)', fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{clock}</div>
        </div>
        <div style={{marginTop:14, display:'inline-flex', alignItems:'center', gap:7, background:sc.bg, border:`1px solid ${sc.c}40`, borderRadius:28, padding:'6px 13px'}}>
          <div style={{width:7, height:7, borderRadius:'50%', background:sc.c, animation:status==='present'?'pulseB 2s infinite':'none'}}/>
          <span style={{color:sc.c, fontSize:11, fontWeight:700}}>{sc.label}</span>
          {pt?.arrivee && <span style={{color:'rgba(255,255,255,0.4)', fontSize:10}}>· {pt.arrivee.slice(0,5)}</span>}
        </div>
      </div>

      {/* Carte shift */}
      <div style={{margin:'-28px 14px 0', background:'#fff', borderRadius:16, padding:'14px 16px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:10}}>
        <div>
          <div style={{fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:4}}>Shift aujourd'hui</div>
          <div style={{display:'flex', alignItems:'center', gap:7}}>
            <span style={{background:todayShift.bg, color:todayShift.color, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700}}>{todayShift.label}</span>
            {todayShift.heure!=='—' && <span style={{fontSize:11, color:'#64748b'}}>{todayShift.heure}</span>}
          </div>
        </div>
        <button onClick={() => setTab('scan')}
          style={{background:'linear-gradient(135deg,#e85d04,#f97316)', border:'none', borderRadius:12, padding:'10px 16px', fontSize:12, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(232,93,4,0.4)'}}>
          {I.scan} Pointer
        </button>
      </div>

      <div style={{padding:'16px 14px', display:'flex', flexDirection:'column', gap:13}}>
        {/* KPIs */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9}}>
          {[
            {l:'Heures mois',    v:fmtDur(totalH), c:'#1a3a5c'},
            {l:'Jours présents', v:`${joursP}j`,   c:'#e85d04'},
            {l:'Demain',         v:tomorrowShift.label, c:tomorrowShift.color},
          ].map(({l,v,c}) => (
            <div key={l} style={{background:'#fff', borderRadius:12, padding:'12px 10px', boxShadow:'0 1px 5px rgba(0,0,0,0.05)', textAlign:'center'}}>
              <div style={{fontSize:16, fontWeight:800, color:c}}>{v}</div>
              <div style={{fontSize:9, color:'#94a3b8', marginTop:2, lineHeight:1.3}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Activité récente */}
        <div style={{background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)'}}>
          <div style={{fontWeight:700, fontSize:12, color:'#1e293b', marginBottom:12, display:'flex', alignItems:'center', gap:5}}>
            {I.clock} Activité récente
          </div>
          {hist.length === 0
            ? <div style={{color:'#94a3b8', fontSize:12, textAlign:'center', padding:'10px 0'}}>Aucun pointage enregistré</div>
            : hist.map((p, i) => {
                const dur = p.arrivee && p.depart ? (new Date('2000-01-01T'+p.depart)-new Date('2000-01-01T'+p.arrivee))/3600000 : null;
                return (
                  <div key={p.id||i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<hist.length-1?'1px solid #f1f5f9':'none'}}>
                    <div style={{width:8, height:8, borderRadius:'50%', background:p.date===todayStr?'#e85d04':dur>=8?'#22c55e':'#f59e0b', flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:'flex', justifyContent:'space-between'}}>
                        <span style={{fontSize:11, fontWeight:700, color:p.date===todayStr?'#e85d04':'#1e293b'}}>
                          {p.date===todayStr ? "Aujourd'hui" : shortD(p.date)}
                        </span>
                        <span style={{fontSize:12, fontWeight:800, color:dur>=8?'#06844b':'#f59e0b'}}>{fmtDur(dur)}</span>
                      </div>
                      <div style={{fontSize:10, color:'#94a3b8'}}>
                        ↑{p.arrivee?.slice(0,5)||'—'}{p.depart?' ↓'+p.depart.slice(0,5):''}
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Demain */}
        <div style={{background:tomorrowShift.bg, borderRadius:14, padding:'13px 16px', border:`1px solid ${tomorrowShift.color}25`, display:'flex', alignItems:'center', gap:12}}>
          {I.cal}
          <div>
            <div style={{fontSize:10, color:tomorrowShift.color, fontWeight:700, textTransform:'uppercase'}}>Demain</div>
            <div style={{fontSize:14, fontWeight:700, color:'#1e293b', marginTop:2}}>
              {tomorrowShift.label}{tomorrowShift.heure!=='—'?` · ${tomorrowShift.heure}`:''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉCRAN SCAN / POINTAGE
// ═══════════════════════════════════════════════════════════════════
function ScanScreen({ agent }) {
  const [step, setStep]   = useState('idle'); // idle|gps|gps_result|selfie|scanning|done
  const [gps, setGps]     = useState(null);   // {ok, dist, zone}
  const [result, setResult] = useState(null);

  const todayPt = null; // Sera rechargé si besoin

  async function startGPS() {
    setStep('gps');
    try {
      // Tenter le vrai GPS du navigateur
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) { rej(new Error('GPS non disponible')); return; }
        navigator.geolocation.getCurrentPosition(res, rej, { timeout:8000, maximumAge:30000 });
      });
      const { latitude: lat, longitude: lon } = pos.coords;
      // Récupérer les zones de l'agent
      const zones = await apiFetch('/zones').catch(() => []);
      const agentZones = zones.filter(z => (agent.zones||[]).includes(z.id) && z.actif);
      let nearestZone = null, minDist = Infinity;
      agentZones.forEach(z => { const d = haversine(lat,lon,z.lat,z.lon); if(d<minDist){minDist=d;nearestZone=z;} });
      const inZone = nearestZone && minDist <= nearestZone.rayon;
      setGps({ ok: inZone, dist: Math.round(minDist), zone: nearestZone, lat, lon, real:true });
    } catch (e) {
      // GPS non disponible ou refusé → mode démo/simulation
      const zones = await apiFetch('/zones').catch(() => []);
      const agentZones = zones.filter(z => (agent.zones||[]).includes(z.id) && z.actif);
      if (agentZones.length === 0) {
        // Aucune zone assignée → pointage libre
        setGps({ ok: true, dist: 0, zone: null, lat: null, lon: null, real:false });
      } else {
        // Simuler dans la zone principale
        const pz = agentZones[0];
        const demo = Math.random() > 0.2; // 80% dans zone
        const dist = demo ? Math.floor(Math.random()*pz.rayon*0.8) : pz.rayon + Math.floor(Math.random()*200);
        setGps({ ok: demo, dist, zone: pz, lat: pz.lat, lon: pz.lon, real:false });
      }
    }
    setStep('gps_result');
  }

  function startSelfie() {
    setStep('selfie');
    setTimeout(() => setStep('ready'), 1400);
  }

  async function doPointage() {
    setStep('scanning');
    try {
      const res = await apiFetch('/pointages/scan', {
        method: 'POST',
        body: { agent_id: agent.id, lat: gps?.lat, lon: gps?.lon, selfie: true }
      });
      setResult({ ok: true, action: res.action, pointage: res.pointage, agent: res.agent });
    } catch (e) {
      setResult({ ok: false, message: e.message });
    }
    setStep('done');
  }

  function reset() { setStep('idle'); setGps(null); setResult(null); }

  const C = { bg:'#0f172a' };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', background:C.bg}}>
      {/* Header */}
      <div style={{padding:'14px 18px 10px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{color:'#fff', fontWeight:700, fontSize:15}}>Pointage Sécurisé</div>
        <div style={{display:'flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:20, padding:'3px 10px'}}>
          {I.shield}<span style={{color:'#86efac', fontSize:9, fontWeight:700}}>GÉOFENCING</span>
        </div>
      </div>

      <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'0 18px 20px', gap:14, overflow:'auto'}}>

        {/* ── IDLE ── */}
        {step==='idle' && (
          <>
            <div style={{width:'100%', display:'flex', flexDirection:'column', gap:8}}>
              {[
                {ic:I.map,    l:'Vérification GPS',  s:'Position en temps réel', c:'#2563eb'},
                {ic:I.cam,    l:'Selfie de présence', s:'Photo horodatée',        c:'#7c3aed'},
                {ic:I.scan,   l:'Enregistrement',     s:'Arrivée / Départ',       c:'#e85d04'},
              ].map(({ic,l,s,c}) => (
                <div key={l} style={{background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'11px 13px', display:'flex', alignItems:'center', gap:12, border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{width:36, height:36, borderRadius:10, background:`${c}20`, border:`1px solid ${c}40`, display:'flex', alignItems:'center', justifyContent:'center', color:c, flexShrink:0}}>{ic}</div>
                  <div>
                    <div style={{color:'#fff', fontWeight:600, fontSize:12}}>{l}</div>
                    <div style={{color:'rgba(255,255,255,0.35)', fontSize:10}}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={startGPS}
              style={{width:'100%', background:'linear-gradient(135deg,#1a3a5c,#2563eb)', border:'none', borderRadius:16, padding:'16px', fontSize:15, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 8px 24px rgba(37,99,235,0.4)'}}>
              {I.map} Lancer la vérification
            </button>
          </>
        )}

        {/* ── GPS EN COURS ── */}
        {step==='gps' && (
          <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20}}>
            <div style={{width:80, height:80, borderRadius:'50%', border:'3px solid #2563eb', display:'flex', alignItems:'center', justifyContent:'center', animation:'spin 2s linear infinite', color:'#2563eb'}}>{I.map}</div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff', fontWeight:700, fontSize:16}}>Localisation GPS…</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:4}}>Détection de votre position</div>
            </div>
          </div>
        )}

        {/* ── RÉSULTAT GPS ── */}
        {step==='gps_result' && gps && (
          <div style={{width:'100%', display:'flex', flexDirection:'column', gap:12}}>
            <div style={{background:gps.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', borderRadius:14, padding:'14px 16px', border:`1.5px solid ${gps.ok?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'}`}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <div style={{width:12, height:12, borderRadius:'50%', background:gps.ok?'#22c55e':'#ef4444'}}/>
                <div style={{color:gps.ok?'#86efac':'#fca5a5', fontWeight:700, fontSize:14}}>
                  {gps.ok ? '✓ Position validée' : '✗ Hors zone autorisée'}
                </div>
                {!gps.real && <span style={{background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.4)', fontSize:9, padding:'2px 6px', borderRadius:10, fontWeight:600}}>DÉMO</span>}
              </div>
              {gps.zone && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  <div style={{background:'rgba(255,255,255,0.05)', borderRadius:9, padding:'8px 10px'}}>
                    <div style={{fontSize:9, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginBottom:2}}>Zone</div>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff'}}>{gps.zone.nom}</div>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.05)', borderRadius:9, padding:'8px 10px'}}>
                    <div style={{fontSize:9, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginBottom:2}}>Distance</div>
                    <div style={{fontSize:14, fontWeight:800, color:gps.ok?'#22c55e':'#ef4444'}}>{gps.dist}m <span style={{fontSize:9, color:'rgba(255,255,255,0.3)'}}>/ {gps.zone.rayon}m</span></div>
                  </div>
                </div>
              )}
              {!gps.zone && gps.ok && <div style={{fontSize:12, color:'rgba(255,255,255,0.5)'}}>Aucune zone assignée — pointage libre autorisé.</div>}
            </div>
            {gps.ok
              ? <button onClick={startSelfie} style={{width:'100%', background:'linear-gradient(135deg,#7c3aed,#a855f7)', border:'none', borderRadius:14, padding:'14px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9}}>
                  {I.cam} Étape suivante : Selfie
                </button>
              : <>
                  <div style={{background:'rgba(239,68,68,0.08)', borderRadius:12, padding:'12px 14px', border:'1px solid rgba(239,68,68,0.25)'}}>
                    <div style={{color:'#fca5a5', fontWeight:700, fontSize:12, marginBottom:3}}>⚠️ Pointage impossible</div>
                    <div style={{color:'rgba(255,255,255,0.5)', fontSize:11, lineHeight:1.6}}>
                      Vous êtes à <b style={{color:'#ef4444'}}>{gps.dist}m</b> de la zone autorisée {gps.zone?.nom}.<br/>
                      Rayon maximum : <b style={{color:'#fff'}}>{gps.zone?.rayon}m</b>
                    </div>
                  </div>
                  <button onClick={reset} style={{width:'100%', background:'rgba(255,255,255,0.07)', border:'none', borderRadius:12, padding:'11px', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.6)', cursor:'pointer'}}>
                    Réessayer
                  </button>
                </>
            }
          </div>
        )}

        {/* ── SELFIE ── */}
        {step==='selfie' && (
          <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18}}>
            <div style={{width:90, height:90, borderRadius:'50%', border:'3px solid #7c3aed', display:'flex', alignItems:'center', justifyContent:'center', animation:'pulseB 1.5s ease infinite', color:'#7c3aed'}}>{I.cam}</div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff', fontWeight:700, fontSize:15}}>Capture selfie…</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:3}}>Authentification visuelle</div>
            </div>
          </div>
        )}

        {/* ── PRÊT À SCANNER ── */}
        {step==='ready' && (
          <div style={{width:'100%', display:'flex', flexDirection:'column', gap:12}}>
            <div style={{background:'rgba(124,58,237,0.12)', borderRadius:14, padding:'14px 16px', border:'1.5px solid rgba(124,58,237,0.4)', display:'flex', gap:12, alignItems:'center'}}>
              <div style={{width:56, height:56, borderRadius:12, background:'rgba(124,58,237,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0}}>😊</div>
              <div>
                <div style={{color:'#c4b5fd', fontWeight:700, fontSize:13}}>✓ Selfie capturé</div>
                <div style={{color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:2}}>{agent.nom} · {new Date().toTimeString().slice(0,5)}</div>
              </div>
            </div>
            <button onClick={doPointage} style={{width:'100%', background:'linear-gradient(135deg,#e85d04,#f97316)', border:'none', borderRadius:14, padding:'15px', fontSize:15, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, boxShadow:'0 8px 24px rgba(232,93,4,0.4)'}}>
              {I.scan} Valider le pointage
            </button>
          </div>
        )}

        {/* ── SCAN EN COURS ── */}
        {step==='scanning' && (
          <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20}}>
            <div style={{position:'relative', width:160, height:160}}>
              {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i) => (
                <div key={i} style={{position:'absolute', width:24, height:24, ...pos, borderTop:i<2?'3px solid #e85d04':'none', borderBottom:i>=2?'3px solid #e85d04':'none', borderLeft:i%2===0?'3px solid #e85d04':'none', borderRight:i%2===1?'3px solid #e85d04':'none', borderRadius:i===0?'5px 0 0 0':i===1?'0 5px 0 0':i===2?'0 0 0 5px':'0 0 5px 0', animation:'cornerA 1s ease infinite'}}/>
              ))}
              <div style={{position:'absolute', left:12, right:12, height:2, background:'linear-gradient(90deg,transparent,#e85d04,transparent)', animation:'scanL 1.5s ease-in-out infinite'}}/>
              <div style={{position:'absolute', inset:'12px', opacity:0.6}}>
                <QR value="EASY_POINTER_BUREAU" size={134}/>
              </div>
            </div>
            <div style={{color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600, animation:'pulseB 1s ease infinite'}}>Enregistrement…</div>
          </div>
        )}

        {/* ── RÉSULTAT FINAL ── */}
        {step==='done' && result && (
          <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, animation:'fadeUp 0.4s ease'}}>
            <div style={{width:86, height:86, borderRadius:'50%',
              background:result.ok?'linear-gradient(135deg,#06844b,#22c55e)':'linear-gradient(135deg,#dc2626,#ef4444)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:result.ok?'0 0 0 16px rgba(34,197,94,0.15)':'0 0 0 16px rgba(239,68,68,0.15)'}}>
              {result.ok ? I.check : I.alert}
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff', fontWeight:800, fontSize:18, marginBottom:5}}>
                {result.ok
                  ? result.action==='arrivee' ? '✅ Arrivée enregistrée !'
                  : result.action==='depart'  ? '🏁 Départ enregistré !'
                  : 'ℹ️ Déjà pointé aujourd\'hui'
                  : '❌ Pointage refusé'}
              </div>
              <div style={{color:'rgba(255,255,255,0.5)', fontSize:13}}>{agent.nom} · {new Date().toTimeString().slice(0,5)}</div>
              {result.ok && result.action==='depart' && result.pointage?.arrivee && result.pointage?.depart && (() => {
                const dur = (new Date('2000-01-01T'+result.pointage.depart)-new Date('2000-01-01T'+result.pointage.arrivee))/3600000;
                return (
                  <div style={{marginTop:14, background:'rgba(255,255,255,0.07)', borderRadius:14, padding:'12px 28px', display:'inline-flex', flexDirection:'column', alignItems:'center', gap:4}}>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.35)', textTransform:'uppercase'}}>Temps passé</div>
                    <div style={{fontSize:30, fontWeight:800, color:dur>=8?'#22c55e':'#f59e0b'}}>{fmtDur(dur)}</div>
                    <div style={{fontSize:11, fontWeight:600, color:dur>=8?'#86efac':'#fde68a'}}>{dur>=8?'✓ Objectif atteint':`Déficit : ${fmtDur(8-dur)}`}</div>
                  </div>
                );
              })()}
              {!result.ok && <div style={{marginTop:10, background:'rgba(239,68,68,0.1)', borderRadius:10, padding:'10px 16px', border:'1px solid rgba(239,68,68,0.3)', fontSize:12, color:'#fca5a5'}}>{result.message}</div>}
            </div>
            <button onClick={reset} style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 32px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer'}}>
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLANNING
// ═══════════════════════════════════════════════════════════════════
function PlanningScreen({ agent }) {
  const [weekOff, setWeekOff] = useState(0);
  const [plan, setPlan]       = useState({});
  const todayStr = today();
  const mon = addDays(getMon(todayStr), weekOff*7);
  const week = Array.from({length:7}, (_,i) => addDays(mon,i));

  useEffect(() => {
    apiFetch(`/planning?agent_id=${agent.id}&date_debut=${addDays(mon,-1)}&date_fin=${addDays(mon,8)}`)
      .then(rows => { const m={}; rows.forEach(r=>m[r.date]=r.shift_id); setPlan(m); })
      .catch(() => {});
  }, [agent.id, weekOff]);

  const d = new Date();
  return (
    <div style={{flex:1, overflow:'auto', background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#1a3a5c,#2563eb)', padding:'20px 18px 24px'}}>
        <div style={{color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, textTransform:'uppercase'}}>Mon Planning</div>
        <div style={{color:'#fff', fontWeight:800, fontSize:18, marginTop:4}}>{MOIS[d.getMonth()]} {d.getFullYear()}</div>
      </div>
      <div style={{padding:'14px', display:'flex', flexDirection:'column', gap:12}}>
        {/* Nav semaine */}
        <div style={{background:'#fff', borderRadius:13, padding:'9px 13px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 1px 5px rgba(0,0,0,0.07)'}}>
          <button onClick={() => setWeekOff(p=>p-1)} style={{background:'#f1f5f9', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex'}}>{I.cl}</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700, fontSize:13, color:'#1e293b'}}>Sem. du {shortD(mon)}</div>
            <div style={{fontSize:10, color:'#64748b'}}>{weekOff===0?'Cette semaine':weekOff>0?`+${weekOff} sem.`:`${weekOff} sem.`}</div>
          </div>
          <div style={{display:'flex', gap:5, alignItems:'center'}}>
            {weekOff!==0 && <button onClick={()=>setWeekOff(0)} style={{background:'#e85d04', color:'#fff', border:'none', borderRadius:7, padding:'5px 8px', cursor:'pointer', fontSize:9, fontWeight:700}}>Auj.</button>}
            <button onClick={() => setWeekOff(p=>p+1)} style={{background:'#f1f5f9', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex'}}>{I.cr}</button>
          </div>
        </div>

        {week.map((dt, i) => {
          const sid = plan[dt] || 'repos';
          const s = SHIFTS.find(x => x.id===sid) || SHIFTS[4];
          const isT = dt===todayStr, isPast = dt<todayStr;
          const dn = new Date(dt);
          return (
            <div key={dt} style={{background:'#fff', borderRadius:14, padding:'13px 16px', display:'flex', alignItems:'center', gap:14, boxShadow:isT?'0 4px 16px rgba(232,93,4,0.15)':'0 1px 4px rgba(0,0,0,0.06)', border:isT?'2px solid #e85d04':'2px solid transparent', opacity:isPast&&!isT?0.6:1}}>
              <div style={{width:42, textAlign:'center', flexShrink:0}}>
                <div style={{fontSize:10, fontWeight:700, color:isT?'#e85d04':'#94a3b8', textTransform:'uppercase'}}>{JOURS[dn.getDay()]}</div>
                <div style={{fontSize:22, fontWeight:800, color:isT?'#e85d04':'#1e293b', lineHeight:1}}>{dn.getDate()}</div>
              </div>
              <div style={{width:3, height:40, borderRadius:2, background:s.color, flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'center', gap:7}}>
                  <span style={{background:s.bg, color:s.color, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700}}>{s.label}</span>
                  {isT && <span style={{fontSize:9, fontWeight:700, color:'#e85d04', background:'#fff7ed', padding:'2px 7px', borderRadius:20}}>Aujourd'hui</span>}
                </div>
                {s.heure!=='—' && <div style={{fontSize:11, color:'#94a3b8', marginTop:4}}>{s.heure}</div>}
              </div>
            </div>
          );
        })}

        {/* Légende */}
        <div style={{background:'#fff', borderRadius:13, padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:8}}>Légende</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
            {SHIFTS.map(s => (
              <div key={s.id} style={{display:'flex', alignItems:'center', gap:6, background:s.bg, borderRadius:8, padding:'6px 9px'}}>
                <div style={{width:6, height:6, borderRadius:'50%', background:s.color, flexShrink:0}}/>
                <div>
                  <div style={{fontSize:11, fontWeight:700, color:s.color}}>{s.label}</div>
                  {s.heure!=='—' && <div style={{fontSize:9, color:'#94a3b8'}}>{s.heure}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFIL
// ═══════════════════════════════════════════════════════════════════
function ProfilScreen({ agent, onUpdateAgent, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({...agent});
  const [saved, setSaved]     = useState(false);
  const [hist, setHist]       = useState([]);

  useEffect(() => {
    apiFetch(`/pointages?agent_id=${agent.id}`).then(rows=>setHist(rows.slice(0,8))).catch(()=>{});
  }, [agent.id]);

  async function save() {
    try {
      await apiFetch(`/agents/${agent.id}`, { method:'PUT', body: form });
      onUpdateAgent(form);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) { alert('Erreur : ' + e.message); }
  }

  function handlePhoto(e) {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = ev => setForm(p=>({...p, photo_base64:ev.target.result})); r.readAsDataURL(f);
  }

  const anc = ds => { if(!ds)return''; const m=Math.floor((new Date()-new Date(ds))/(30.44*86400000)); return m<12?`${m} mois`:`${Math.floor(m/12)} an${Math.floor(m/12)>1?'s':''}`; };

  return (
    <div style={{flex:1, overflow:'auto', background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1a3a5c)', padding:'0 0 24px', overflow:'hidden', position:'relative'}}>
        <div style={{position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(232,93,4,0.1)'}}/>
        <div style={{padding:'16px 18px 0', display:'flex', justifyContent:'flex-end'}}>
          <button onClick={() => setEditing(!editing)} style={{background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:'5px 13px', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4}}>
            {I.edit} {editing?'Annuler':'Modifier'}
          </button>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'6px 18px 0'}}>
          <div style={{position:'relative'}}>
            <Av ag={editing?form:agent} size={78} border="rgba(255,255,255,0.3)"/>
            {editing && (
              <label htmlFor="pp" style={{position:'absolute', bottom:0, right:0, background:'#e85d04', borderRadius:'50%', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'2px solid #fff'}}>
                {I.cam}
                <input id="pp" type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto}/>
              </label>
            )}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'#fff', fontWeight:800, fontSize:18}}>{agent.nom} {agent.prenom}</div>
            <div style={{color:'rgba(255,255,255,0.5)', fontSize:12}}>{agent.poste}</div>
            <div style={{display:'flex', gap:6, justifyContent:'center', marginTop:7, flexWrap:'wrap'}}>
              <span style={{background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.75)', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700}}>{agent.contrat}</span>
              {(agent.date_embauche||agent.dateEmbauche) && <span style={{background:'rgba(232,93,4,0.25)', color:'#fb923c', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700}}>{anc(agent.date_embauche||agent.dateEmbauche)}</span>}
            </div>
          </div>
        </div>
      </div>

      {saved && <div style={{margin:'10px 14px 0', background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:11, padding:'9px 13px', fontSize:12, fontWeight:600, color:'#065f46'}}>✅ Profil mis à jour !</div>}

      <div style={{padding:'12px 14px', display:'flex', flexDirection:'column', gap:12}}>
        {editing ? (
          <div style={{background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 8px rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', gap:11}}>
            <div style={{fontWeight:700, fontSize:14, color:'#1e293b', marginBottom:4}}>Modifier mes informations</div>
            {[['Nom','nom'],['Prénom','prenom'],['Téléphone','tel'],['Email','email']].map(([label,key]) => (
              <div key={key}>
                <label style={{fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', display:'block', marginBottom:4}}>{label}</label>
                <input value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:9, border:'1.5px solid #e2e8f0', fontSize:13, outline:'none'}}/>
              </div>
            ))}
            <div style={{display:'flex', gap:9, marginTop:4}}>
              <button onClick={()=>setEditing(false)} style={{flex:1, padding:11, background:'#f1f5f9', border:'none', borderRadius:11, fontSize:13, fontWeight:600, cursor:'pointer', color:'#64748b'}}>Annuler</button>
              <button onClick={save} style={{flex:2, padding:11, background:'linear-gradient(135deg,#1a3a5c,#2563eb)', color:'#fff', border:'none', borderRadius:11, fontSize:14, fontWeight:700, cursor:'pointer'}}>Enregistrer</button>
            </div>
          </div>
        ) : (
          <div style={{background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
            {agent.tel  && <div style={{display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #f1f5f9'}}><div style={{width:32, height:32, background:'#f1f5f9', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{I.phone}</div><span style={{fontSize:13, color:'#1e293b'}}>{agent.tel}</span></div>}
            {agent.email && <div style={{display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #f1f5f9'}}><div style={{width:32, height:32, background:'#f1f5f9', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{I.mail}</div><span style={{fontSize:13, color:'#1e293b'}}>{agent.email}</span></div>}
            {[['ID',agent.id],['Contrat',agent.contrat],['Horaire',agent.horaire]].map(([k,v]) => v && (
              <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9', fontSize:12}}>
                <span style={{color:'#94a3b8'}}>{k}</span>
                <span style={{fontWeight:700, color:'#1e293b'}}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* QR */}
        <div style={{background:'#fff', borderRadius:14, padding:'14px 16px', textAlign:'center', boxShadow:'0 1px 5px rgba(0,0,0,0.05)'}}>
          <div style={{fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:9}}>Ma carte QR personnelle</div>
          <div style={{display:'inline-block', padding:10, background:'#f8fafc', borderRadius:12, border:'1.5px solid #e2e8f0'}}>
            <QR value={`EP_${agent.id}_${agent.nom.toUpperCase()}`} size={110}/>
          </div>
          <div style={{fontSize:10, color:'#94a3b8', marginTop:7}}>Présentez au terminal fixe à l'entrée</div>
        </div>

        {/* Historique */}
        <div style={{background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 1px 5px rgba(0,0,0,0.05)'}}>
          <div style={{fontWeight:700, fontSize:12, color:'#1e293b', marginBottom:10}}>Historique récent</div>
          {hist.length===0 ? <div style={{color:'#94a3b8', fontSize:12, textAlign:'center', padding:'10px 0'}}>Aucun pointage</div>
          : hist.map((p,i) => {
              const dur = p.arrivee&&p.depart ? (new Date('2000-01-01T'+p.depart)-new Date('2000-01-01T'+p.arrivee))/3600000 : null;
              return (
                <div key={p.id||i} style={{display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:i<hist.length-1?'1px solid #f1f5f9':'none', fontSize:12}}>
                  <span style={{fontWeight:600, color:'#1e293b'}}>{shortD(p.date)}</span>
                  <span style={{color:'#64748b'}}>{p.arrivee?.slice(0,5)||'—'} → {p.depart?.slice(0,5)||'—'}</span>
                  <span style={{fontWeight:700, color:dur>=8?'#06844b':'#f59e0b'}}>{fmtDur(dur)}</span>
                </div>
              );
            })
          }
        </div>

        {/* Déconnexion */}
        <div onClick={onLogout} style={{background:'#fff', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
          <div style={{width:36, height:36, background:'#fee2e2', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center'}}>{I.out}</div>
          <div>
            <div style={{fontSize:12, fontWeight:700, color:'#dc2626'}}>Se déconnecter</div>
            <div style={{fontSize:10, color:'#94a3b8'}}>Retour à la sélection</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
export default function AgentApp() {
  const [agent, setAgent]   = useState(null);
  const [tab, setTab]       = useState('home');
  const [clock, setClock]   = useState('');

  // Restaurer la session
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ep_agent');
      if (saved) { const ag = JSON.parse(saved); if(ag?.id && ag?.nom) setAgent(ag); }
    } catch(e) { localStorage.removeItem('ep_agent'); }
  }, []);

  // Horloge
  useEffect(() => {
    const tick = () => { const d=new Date(); setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  function handleLogin(ag) {
    setAgent(ag);
    localStorage.setItem('ep_agent', JSON.stringify(ag));
    setTab('home');
  }

  function handleLogout() {
    localStorage.removeItem('ep_agent');
    setAgent(null);
    setTab('home');
  }

  function handleUpdateAgent(ag) {
    setAgent(ag);
    localStorage.setItem('ep_agent', JSON.stringify(ag));
  }

  const TABS = [
    { id:'home',   label:'Accueil',  icon:I.home },
    { id:'scan',   label:'Pointer',  icon:I.scan },
    { id:'plan',   label:'Planning', icon:I.cal  },
    { id:'profil', label:'Profil',   icon:I.user },
  ];

  return (
    <div style={{display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 50%,#1e4d8c 100%)', padding:'8px', fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {/* Shell téléphone */}
      <div style={{width:'min(390px,100vw)', height:'min(820px,96vh)', borderRadius:'min(44px,6vw)', background:'#1e293b', boxShadow:'0 40px 120px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(255,255,255,0.1)', display:'flex', flexDirection:'column', overflow:'hidden'}}>

        {/* Status bar */}
        <div style={{height:44, background:agent?'#0f172a':'transparent', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', flexShrink:0, zIndex:20, position:'relative'}}>
          <span style={{color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:700, fontVariantNumeric:'tabular-nums'}}>{clock}</span>
          <div style={{width:110, height:24, background:'#000', borderRadius:18, position:'absolute', left:'50%', transform:'translateX(-50%)', top:10}}/>
          <span style={{color:'rgba(255,255,255,0.6)', fontSize:11}}>▊▊▊</span>
        </div>

        {/* Écran principal */}
        <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
          {!agent
            ? <LoginScreen onLogin={handleLogin}/>
            : <>
                {tab==='home'  && <HomeScreen   agent={agent} clock={clock} setTab={setTab}/>}
                {tab==='scan'  && <ScanScreen   agent={agent}/>}
                {tab==='plan'  && <PlanningScreen agent={agent}/>}
                {tab==='profil'&& <ProfilScreen  agent={agent} onUpdateAgent={handleUpdateAgent} onLogout={handleLogout}/>}
              </>
          }
        </div>

        {/* Barre de navigation */}
        {agent && (
          <div style={{height:68, background:'rgba(10,18,32,0.98)', backdropFilter:'blur(20px)', display:'flex', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0}}>
            {TABS.map(({ id, label, icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)}
                  style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'none', cursor:'pointer', color:active?'#e85d04':'rgba(255,255,255,0.3)', padding:'7px 0', transition:'all 0.15s', position:'relative'}}>
                  {active && <div style={{position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:22, height:2.5, background:'#e85d04', borderRadius:'0 0 3px 3px'}}/>}
                  {icon}
                  <span style={{fontSize:9, fontWeight:active?700:500, letterSpacing:'0.03em'}}>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Indicateur home */}
        <div style={{height:22, background:'rgba(10,18,32,0.98)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
          <div style={{width:90, height:3.5, background:'rgba(255,255,255,0.18)', borderRadius:2}}/>
        </div>
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulseB  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanL   { 0%{top:12px;opacity:1} 50%{top:140px;opacity:0.8} 100%{top:12px;opacity:1} }
        @keyframes cornerA { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        button:active { opacity: 0.8; }
      `}</style>
    </div>
  );
}
