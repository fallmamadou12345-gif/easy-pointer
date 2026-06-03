import { useState, useEffect, useRef } from 'react';

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE = '/api';
function getToken() { return localStorage.getItem('ep_agent_token'); }
async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { localStorage.removeItem('ep_agent_token'); window.location.reload(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}
const api = {
  login: (u,p) => req('POST','/auth/login',{username:u,password:p}),
  me: () => req('GET','/auth/me'),
  agents: () => req('GET','/agents'),
  agent: (id) => req('GET',`/agents/${id}`),
  updateAgent: (id,d) => req('PUT',`/agents/${id}`,d),
  todayPointages: () => req('GET','/pointages/today'),
  scan: (d) => req('POST','/pointages/scan',d),
  pointages: (q) => req('GET',`/pointages?${new URLSearchParams(q)}`),
  planning: (q) => req('GET',`/planning?${new URLSearchParams(q)}`),
  journal: (q) => req('GET',`/pointages/journal?${new URLSearchParams(q||{})}`),
  zones: () => req('GET','/zones'),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2,'0');
const nowStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const getMon = ds => { const d=new Date(ds),day=d.getDay(),diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays = (ds,n) => { const d=new Date(ds); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const shortDate = ds => { const d=new Date(ds); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`; };
const moisStr = d => d.slice(0,7);
const JOURS_SEM = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MOIS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const SHIFTS = [
  { id:'matin',  label:'Matin',       heure:'06:00–14:00', color:'#d97706', bg:'#fef3c7' },
  { id:'jour',   label:'Journée',     heure:'08:00–16:00', color:'#2563eb', bg:'#dbeafe' },
  { id:'apm',    label:'Après-midi',  heure:'10:00–18:00', color:'#7c3aed', bg:'#ede9fe' },
  { id:'soir',   label:'Soir',        heure:'14:00–22:00', color:'#ea580c', bg:'#ffedd5' },
  { id:'repos',  label:'Repos',       heure:'—',           color:'#64748b', bg:'#f1f5f9' },
  { id:'conge',  label:'Congé',       heure:'—',           color:'#059669', bg:'#d1fae5' },
];

function haversine(lat1,lon1,lat2,lon2){
  const R=6371000,toRad=x=>x*Math.PI/180;
  const a=Math.sin(toRad(lat2-lat1)/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(toRad(lon2-lon1)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const Ic = {
  Home:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Scan:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  Cal:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Shield: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:20,height:20}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Check:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width:28,height:28}}><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:24,height:24}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Cam:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Clock:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Map:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  CL:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18}}><polyline points="15 18 9 12 15 6"/></svg>,
  CR:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18}}><polyline points="9 18 15 12 9 6"/></svg>,
  Edit:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Out:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Phone:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 4.69 12 19.79 19.79 0 0 1 1.09 3.6 2 2 0 0 1 3.1 1.09h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.4 6.4l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Mail:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Spin:   ()=><div style={{width:18,height:18,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>,
};

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Av({ag,size=44,border}) {
  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];
  const ci=(ag?.id||'A').charCodeAt(1)%pal.length||0;
  const s={width:size,height:size,borderRadius:'50%',flexShrink:0,...(border?{border:`3px solid ${border}`}:{})};
  return ag?.photo_base64
    ?<img src={ag.photo_base64} alt={ag.nom} style={{...s,objectFit:'cover'}}/>
    :<div style={{...s,background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size*0.34,fontWeight:800}}>
      {(ag?.nom||'?').charAt(0)}{(ag?.prenom||'').charAt(0)}
    </div>;
}

// ─── QR CODE VISUEL ───────────────────────────────────────────────────────────
function QRVis({value,size=140}) {
  const cells=21,cell=size/cells;
  const h=s=>{let x=0;for(let i=0;i<s.length;i++)x=(x*31+s.charCodeAt(i))%997;return x;};
  const dots=[];
  for(let r=0;r<cells;r++) for(let c=0;c<cells;c++){
    const finder=(r<7&&c<7)||(r<7&&c>=cells-7)||(r>=cells-7&&c<7);
    const timing=(r===6||c===6)&&(r+c)%2===0;
    if(finder||timing||(!finder&&!timing&&h(value+r*100+c)%3!==0)) dots.push([r,c]);
  }
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block'}}>
      <rect width={size} height={size} fill="white" rx="8"/>
      {dots.map(([r,c])=><rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill="#0f172a"/>)}
      <rect x={2.5*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
      <rect x={(cells-4.5)*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
      <rect x={2.5*cell} y={(cells-4.5)*cell} width={2*cell} height={2*cell} fill="white"/>
    </svg>
  );
}

// ─── ÉCRAN LOGIN AGENT ────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [agents,setAgents]=useState([]);
  const [sel,setSel]=useState(null);
  const [pin,setPin]=useState('');
  const [err,setErr]=useState(false);
  const [step,setStep]=useState('select');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    // Charger la liste des agents depuis l'API publique
    fetch('/api/agents/public')
      .then(r=>r.json()).then(data=>{
        if(Array.isArray(data)) setAgents(data.filter(a=>a.actif));
        else setAgents([]);
        setLoading(false);
      }).catch(()=>{ setLoading(false); });
  },[]);

  function handlePin(d) {
    if(d==='del'){ setPin(p=>p.slice(0,-1)); return; }
    const np=pin+d; setPin(np);
    if(np.length===4) {
      // PIN = 4 derniers chiffres de l'ID agent ou 1234 par défaut
      const agentPin = sel.id.replace(/\D/g,'').slice(-4).padStart(4,'0') || '1234';
      const valid = np==='1234' || np===agentPin;
      if(valid) {
        setTimeout(()=>onLogin(sel),300);
      } else {
        setErr(true);
        setTimeout(()=>{setPin('');setErr(false);},900);
      }
    }
  }

  if(loading) return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(160deg,#0f172a,#1a3a5c,#1e4d8c)',flexDirection:'column',gap:16}}>
      <div style={{width:54,height:54,background:'#e85d04',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,color:'#fff'}}>EP</div>
      <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>Chargement…</div>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#0f172a 0%,#1a3a5c 55%,#1e4d8c 100%)',overflow:'hidden'}}>
      <div style={{padding:'36px 24px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
        <div style={{width:54,height:54,background:'#e85d04',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff',boxShadow:'0 8px 24px rgba(232,93,4,0.5)'}}>EP</div>
        <div style={{color:'#fff',fontWeight:800,fontSize:20}}>Easy Pointer</div>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:20,padding:'3px 12px'}}>
          <Ic.Shield/><span style={{color:'#86efac',fontSize:10,fontWeight:700,letterSpacing:'0.08em'}}>APPLICATION AGENT</span>
        </div>
      </div>

      {step==='select'&&(
        <div style={{flex:1,padding:'20px 18px',overflow:'auto'}}>
          <div style={{color:'rgba(255,255,255,0.55)',fontSize:12,fontWeight:600,marginBottom:12,textAlign:'center'}}>Sélectionnez votre compte</div>
          {agents.length===0&&(
            <div style={{textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:40}}>
              <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
              Aucun agent trouvé.<br/>
              <span style={{fontSize:11}}>Vérifiez la connexion au serveur.</span>
            </div>
          )}
          {agents.map(ag=>(
            <div key={ag.id} onClick={()=>{setSel(ag);setStep('pin');}}
              style={{background:'rgba(255,255,255,0.07)',backdropFilter:'blur(10px)',borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',marginBottom:8,transition:'all 0.15s'}}>
              <Av ag={ag} size={44} border="rgba(255,255,255,0.25)"/>
              <div style={{flex:1}}>
                <div style={{color:'#fff',fontWeight:700,fontSize:14}}>{ag.nom} {ag.prenom}</div>
                <div style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginTop:1}}>{ag.poste}</div>
              </div>
              <span style={{color:'rgba(255,255,255,0.3)',fontSize:18}}>›</span>
            </div>
          ))}
        </div>
      )}

      {step==='pin'&&sel&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'20px',gap:0}}>
          <Av ag={sel} size={68} border="rgba(255,255,255,0.4)"/>
          <div style={{color:'#fff',fontWeight:800,fontSize:18,marginTop:10}}>{sel.nom} {sel.prenom}</div>
          <div style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginBottom:24}}>{sel.poste}</div>
          <div style={{display:'flex',gap:14,marginBottom:28}}>
            {[0,1,2,3].map(i=><div key={i} style={{width:13,height:13,borderRadius:'50%',background:i<pin.length?(err?'#ef4444':'#e85d04'):'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.25)',transform:i<pin.length?'scale(1.25)':'scale(1)',transition:'all 0.15s'}}/>)}
          </div>
          {err&&<div style={{color:'#f87171',fontSize:11,marginBottom:10,fontWeight:600}}>Code incorrect</div>}
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'8px 14px',marginBottom:16,fontSize:11,color:'rgba(255,255,255,0.35)',textAlign:'center'}}>
            Code : <b style={{color:'rgba(255,255,255,0.6)'}}>1234</b> ou les 4 derniers chiffres de votre ID
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,width:'100%',maxWidth:250}}>
            {['1','2','3','4','5','6','7','8','9','','0','del'].map(k=>(
              <button key={k} onClick={()=>k&&handlePin(k)} style={{height:56,borderRadius:14,border:'none',cursor:k?'pointer':'default',background:k==='del'?'rgba(255,255,255,0.07)':k?'rgba(255,255,255,0.09)':'transparent',color:k==='del'?'#94a3b8':'#fff',fontSize:k==='del'?17:22,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {k==='del'?'⌫':k}
              </button>
            ))}
          </div>
          <button onClick={()=>{setSel(null);setPin('');setStep('select');}} style={{marginTop:20,background:'transparent',border:'none',color:'rgba(255,255,255,0.35)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
            Changer de compte
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function HomeScreen({agent,clockStr,setTab}) {
  const [todayData,setTodayData]=useState(null);
  const [planData,setPlanData]=useState({});
  const [historique,setHistorique]=useState([]);

  const today=nowStr();
  const d=new Date();

  useEffect(()=>{
    api.todayPointages().then(setTodayData).catch(()=>{});
    const mon=getMon(today);
    api.planning({date_debut:mon,date_fin:addDays(mon,13)}).then(rows=>{
      const map={};
      rows.forEach(x=>map[`${x.agent_id}-${x.date}`]=x.shift_id);
      setPlanData(map);
    }).catch(()=>{});
    api.pointages({agent_id:agent.id}).then(rows=>setHistorique(rows.slice(0,10))).catch(()=>{});
  },[]);

  const todayPt=todayData?.pointages?.find(p=>p.agent_id===agent.id);
  const status=!todayPt?'absent':!todayPt.depart?'present':'sorti';
  const sCfg={
    absent:  {label:'Pas encore pointé',  c:'#f59e0b',bg:'rgba(245,158,11,0.15)',dot:'#f59e0b'},
    present: {label:'Présent · En cours', c:'#22c55e',bg:'rgba(34,197,94,0.15)',dot:'#22c55e'},
    sorti:   {label:'Journée terminée',   c:'#60a5fa',bg:'rgba(96,165,250,0.15)',dot:'#60a5fa'},
  }[status];

  const todayShiftId=planData[`${agent.id}-${today}`]||'repos';
  const todayShift=SHIFTS.find(s=>s.id===todayShiftId)||SHIFTS[4];
  const tomorrowShiftId=planData[`${agent.id}-${addDays(today,1)}`]||'repos';
  const tomorrowShift=SHIFTS.find(s=>s.id===tomorrowShiftId)||SHIFTS[4];

  const moisPts=historique.filter(p=>moisStr(p.date)===moisStr(today));
  const totalH=moisPts.reduce((a,p)=>a+(p.arrivee&&p.depart?((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))/3600000):0),0);
  const joursP=moisPts.filter(p=>p.arrivee).length;
  const derniers=historique.slice(0,4);

  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 60%,#1e4d8c 100%)',padding:'20px 18px 56px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.03)'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{color:'rgba(255,255,255,0.45)',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()]} {d.getDate()} {MOIS_FR[d.getMonth()]}</div>
            <div style={{color:'#fff',fontWeight:800,fontSize:20,marginTop:3}}>Bonjour, {agent.nom} 👋</div>
            <div style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginTop:1}}>{agent.poste}</div>
          </div>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:22,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{clockStr}</div>
        </div>
        <div style={{marginTop:14,display:'inline-flex',alignItems:'center',gap:7,background:sCfg.bg,border:`1px solid ${sCfg.c}40`,borderRadius:28,padding:'6px 13px'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:sCfg.dot,animation:status==='present'?'pulseAnim 2s infinite':'none'}}/>
          <span style={{color:sCfg.c,fontSize:11,fontWeight:700}}>{sCfg.label}</span>
          {todayPt?.arrivee&&<span style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>· {todayPt.arrivee.slice(0,5)}</span>}
        </div>
      </div>

      {/* Carte shift overlap */}
      <div style={{margin:'-28px 14px 0',background:'#fff',borderRadius:16,padding:'14px 16px',boxShadow:'0 4px 20px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',zIndex:10}}>
        <div>
          <div style={{fontSize:9,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:4}}>Shift aujourd'hui</div>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <span style={{background:todayShift.bg,color:todayShift.color,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,border:`1px solid ${todayShift.color}30`}}>{todayShift.label}</span>
            {todayShift.heure!=='—'&&<span style={{fontSize:11,color:'#64748b'}}>{todayShift.heure}</span>}
          </div>
        </div>
        <button onClick={()=>setTab('scan')} style={{background:'linear-gradient(135deg,#e85d04,#f97316)',border:'none',borderRadius:12,padding:'10px 16px',fontSize:12,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 14px rgba(232,93,4,0.4)'}}>
          <Ic.Scan/>Pointer
        </button>
      </div>

      <div style={{padding:'16px 14px',display:'flex',flexDirection:'column',gap:14}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:9}}>
          {[
            {l:'Heures mois', v:`${Math.floor(totalH)}h${pad(Math.round((totalH%1)*60))}`,c:'#1a3a5c'},
            {l:'Jours présents',v:`${joursP}j`,c:'#e85d04'},
            {l:'Demain',v:tomorrowShift.label,c:tomorrowShift.color},
          ].map(({l,v,c})=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'12px 10px',boxShadow:'0 1px 5px rgba(0,0,0,0.05)',textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:9,color:'#94a3b8',marginTop:2,lineHeight:1.3}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Activité récente */}
        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',boxShadow:'0 1px 6px rgba(0,0,0,0.06)'}}>
          <div style={{fontWeight:700,fontSize:12,color:'#1e293b',marginBottom:12,display:'flex',alignItems:'center',gap:5}}><Ic.Clock/>Activité récente</div>
          {derniers.length===0&&<div style={{color:'#94a3b8',fontSize:12,textAlign:'center',padding:'10px 0'}}>Aucun pointage</div>}
          {derniers.map((p,i)=>{
            const dur=p.arrivee&&p.depart?((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))/3600000):null;
            const ok=dur>=8;
            return(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<derniers.length-1?'1px solid #f1f5f9':'none'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:p.date===today?'#e85d04':ok?'#22c55e':'#f59e0b',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,fontWeight:700,color:p.date===today?'#e85d04':'#1e293b'}}>{p.date===today?'Aujourd\'hui':shortDate(p.date)}</span>
                    <span style={{fontSize:12,fontWeight:800,color:ok?'#06844b':'#f59e0b'}}>{dur?`${Math.floor(dur)}h${pad(Math.round((dur%1)*60))}`:'—'}</span>
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>↑{p.arrivee?.slice(0,5)||'—'}{p.depart?' ↓'+p.depart.slice(0,5):''}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Demain */}
        <div style={{background:tomorrowShift.bg,borderRadius:14,padding:'13px 16px',border:`1px solid ${tomorrowShift.color}25`,display:'flex',alignItems:'center',gap:12}}>
          <Ic.Cal/>
          <div>
            <div style={{fontSize:10,color:tomorrowShift.color,fontWeight:700,textTransform:'uppercase'}}>Demain</div>
            <div style={{fontSize:14,fontWeight:700,color:'#1e293b',marginTop:2}}>{tomorrowShift.label} {tomorrowShift.heure!=='—'?`· ${tomorrowShift.heure}`:''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCAN ─────────────────────────────────────────────────────────────────────
function ScanScreen({agent}) {
  const [phase,setPhase]=useState('idle'); // idle|gps|gps_done|selfie|scanning|success|blocked
  const [gpsData,setGpsData]=useState(null);
  const [selfieOk,setSelfieOk]=useState(false);
  const [result,setResult]=useState(null);
  const [zones,setZones]=useState([]);
  const today=nowStr();

  useEffect(()=>{ api.zones().then(z=>setZones(z.filter(x=>x.actif))).catch(()=>{}); },[]);

  const agentZones=zones.filter(z=>(agent.zones||[]).includes(z.id));
  const primaryZone=zones.find(z=>z.id===agent.zone_defaut)||agentZones[0];

  function startGPS() {
    setPhase('gps');
    // En production : navigator.geolocation.getCurrentPosition(...)
    // En démo : simuler une position dans la zone principale
    setTimeout(()=>{
      if(!primaryZone) {
        setGpsData({ok:true,dist:0,zone:null,lat:0,lon:0});
        setPhase('gps_done');
        return;
      }
      const inZone=Math.random()>0.25;
      const lat=primaryZone.lat+(inZone?1:-1)*(Math.random()*0.0008);
      const lon=primaryZone.lon+(inZone?1:-1)*(Math.random()*0.0008);
      let nearestZone=null,minDist=Infinity;
      agentZones.forEach(z=>{
        const d=haversine(lat,lon,z.lat,z.lon);
        if(d<minDist){minDist=d;nearestZone=z;}
      });
      const ok=nearestZone&&minDist<=nearestZone.rayon;
      setGpsData({ok,dist:Math.round(minDist),zone:nearestZone,lat,lon});
      setPhase('gps_done');
    },2000);
  }

  function startSelfie() {
    setPhase('selfie');
    setTimeout(()=>{ setSelfieOk(true); setPhase('selfie_done'); },1500);
  }

  async function doScan() {
    setPhase('scanning');
    try {
      const res = await api.scan({
        agent_id: agent.id,
        lat: gpsData?.lat||null,
        lon: gpsData?.lon||null,
        selfie: selfieOk,
      });
      setResult(res);
      setPhase('success');
    } catch(e) {
      setResult({error:e.message});
      setPhase('blocked');
    }
  }

  function reset(){setPhase('idle');setGpsData(null);setSelfieOk(false);setResult(null);}

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#0f172a'}}>
      <div style={{padding:'14px 18px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{color:'#fff',fontWeight:700,fontSize:15}}>Pointage Sécurisé</div>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:20,padding:'3px 10px'}}>
          <Ic.Shield/><span style={{color:'#86efac',fontSize:9,fontWeight:700}}>GÉOFENCING</span>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0 18px 20px',gap:14,overflow:'auto'}}>

        {phase==='idle'&&(
          <>
            {primaryZone&&(
              <div style={{width:'100%',background:'rgba(255,255,255,0.06)',borderRadius:14,padding:'12px 14px',border:'1px solid rgba(255,255,255,0.1)'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:5}}>Zone autorisée</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:primaryZone.couleur,boxShadow:`0 0 8px ${primaryZone.couleur}`}}/>
                  <div>
                    <div style={{color:'#fff',fontWeight:700,fontSize:13}}>{primaryZone.nom}</div>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>{primaryZone.adresse} · ±{primaryZone.rayon}m</div>
                  </div>
                </div>
              </div>
            )}
            {!primaryZone&&(
              <div style={{width:'100%',background:'rgba(245,158,11,0.1)',borderRadius:12,padding:'12px 14px',border:'1px solid rgba(245,158,11,0.3)'}}>
                <div style={{color:'#fbbf24',fontSize:12,fontWeight:600}}>⚠️ Aucune zone assignée — pointage libre autorisé</div>
              </div>
            )}
            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:7}}>
              {[
                {i:<Ic.Map/>,l:'Vérification GPS',s:`Rayon ±${primaryZone?.rayon||'—'}m`,c:'#2563eb',done:false},
                {i:<Ic.Cam/>,l:'Selfie de présence',s:'Photo horodatée',c:'#7c3aed',done:false},
                {i:<Ic.Scan/>,l:'Validation scan',s:'Enregistrement final',c:'#e85d04',done:false},
              ].map(({i,l,s,c,done})=>(
                <div key={l} style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'10px 13px',display:'flex',alignItems:'center',gap:12,border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${c}20`,border:`1px solid ${c}40`,display:'flex',alignItems:'center',justifyContent:'center',color:c,flexShrink:0}}>{i}</div>
                  <div style={{flex:1}}>
                    <div style={{color:'#fff',fontWeight:600,fontSize:12}}>{l}</div>
                    <div style={{color:'rgba(255,255,255,0.35)',fontSize:10}}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={startGPS} style={{width:'100%',background:'linear-gradient(135deg,#1a3a5c,#2563eb)',border:'none',borderRadius:16,padding:'16px',fontSize:15,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 8px 24px rgba(37,99,235,0.4)'}}>
              <Ic.Map/>Lancer la vérification
            </button>
          </>
        )}

        {phase==='gps'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
            <div style={{width:80,height:80,borderRadius:'50%',border:'3px solid #2563eb',display:'flex',alignItems:'center',justifyContent:'center',animation:'spin 2s linear infinite',color:'#2563eb'}}><Ic.Map/></div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff',fontWeight:700,fontSize:16}}>Localisation GPS</div>
              <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:4}}>Acquisition du signal…</div>
            </div>
          </div>
        )}

        {phase==='gps_done'&&gpsData&&(
          <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:gpsData.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',borderRadius:14,padding:'14px 16px',border:`1.5px solid ${gpsData.ok?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:12,height:12,borderRadius:'50%',background:gpsData.ok?'#22c55e':'#ef4444'}}/>
                <div style={{color:gpsData.ok?'#86efac':'#fca5a5',fontWeight:700,fontSize:14}}>{gpsData.ok?'✓ Position validée':'✗ Hors zone autorisée'}</div>
              </div>
              {gpsData.zone&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div style={{background:'rgba(255,255,255,0.05)',borderRadius:9,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:2}}>Zone</div>
                    <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{gpsData.zone.nom.split('–')[0].trim()}</div>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.05)',borderRadius:9,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:2}}>Distance</div>
                    <div style={{fontSize:14,fontWeight:800,color:gpsData.ok?'#22c55e':'#ef4444'}}>{gpsData.dist}m</div>
                  </div>
                </div>
              )}
            </div>
            {gpsData.ok?(
              <button onClick={startSelfie} style={{width:'100%',background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',borderRadius:14,padding:'14px',fontSize:14,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9}}>
                <Ic.Cam/>Étape suivante : Selfie
              </button>
            ):(
              <>
                <div style={{background:'rgba(239,68,68,0.08)',borderRadius:12,padding:'12px 14px',border:'1px solid rgba(239,68,68,0.25)'}}>
                  <div style={{color:'#fca5a5',fontWeight:700,fontSize:13,marginBottom:3}}>⚠️ Pointage impossible</div>
                  <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,lineHeight:1.5}}>Vous êtes à <b style={{color:'#ef4444'}}>{gpsData.dist}m</b> de la zone {gpsData.zone?.nom}. Rapprochez-vous pour pointer.</div>
                </div>
                <button onClick={reset} style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'none',borderRadius:12,padding:'12px',fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.6)',cursor:'pointer'}}>Réessayer</button>
              </>
            )}
          </div>
        )}

        {phase==='selfie'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18}}>
            <div style={{width:90,height:90,borderRadius:'50%',border:'3px solid #7c3aed',display:'flex',alignItems:'center',justifyContent:'center',animation:'pulseAnim 1.5s ease infinite',color:'#7c3aed'}}><Ic.Cam/></div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff',fontWeight:700,fontSize:15}}>Capture selfie…</div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:12,marginTop:3}}>Authentification visuelle</div>
            </div>
          </div>
        )}

        {phase==='selfie_done'&&(
          <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:'rgba(124,58,237,0.12)',borderRadius:14,padding:'14px 16px',border:'1.5px solid rgba(124,58,237,0.4)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:'#a78bfa'}}/>
                <div style={{color:'#c4b5fd',fontWeight:700,fontSize:14}}>✓ Selfie capturé et horodaté</div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <div style={{width:60,height:60,borderRadius:10,background:'rgba(124,58,237,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>😊</div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{agent.nom} {agent.prenom}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>{today} · {new Date().toTimeString().slice(0,5)}</div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:4,background:'rgba(34,197,94,0.12)',borderRadius:20,padding:'2px 8px'}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:'#22c55e'}}/>
                    <span style={{fontSize:9,color:'#86efac',fontWeight:700}}>Vérifié</span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={doScan} style={{width:'100%',background:'linear-gradient(135deg,#e85d04,#f97316)',border:'none',borderRadius:14,padding:'14px',fontSize:15,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9,boxShadow:'0 8px 24px rgba(232,93,4,0.4)'}}>
              <Ic.Scan/>Valider le pointage
            </button>
          </div>
        )}

        {phase==='scanning'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
            <div style={{position:'relative',width:160,height:160}}>
              {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
                <div key={i} style={{position:'absolute',width:24,height:24,...pos,borderTop:i<2?'3px solid #e85d04':'none',borderBottom:i>=2?'3px solid #e85d04':'none',borderLeft:i%2===0?'3px solid #e85d04':'none',borderRight:i%2===1?'3px solid #e85d04':'none',borderRadius:i===0?'5px 0 0 0':i===1?'0 5px 0 0':i===2?'0 0 0 5px':'0 0 5px 0',animation:'cornerAnim 1s ease infinite'}}/>
              ))}
              <div style={{position:'absolute',left:12,right:12,height:2,background:'linear-gradient(90deg,transparent,#e85d04,transparent)',animation:'scanLine 1.5s ease-in-out infinite'}}/>
              <div style={{position:'absolute',inset:'12px',opacity:0.7}}><QRVis value="EASY_POINTER_BUREAU" size={134}/></div>
            </div>
            <div style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600,animation:'pulseAnim 1s ease infinite'}}>Enregistrement…</div>
          </div>
        )}

        {(phase==='success'||phase==='blocked')&&result&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,animation:'fadeUp 0.4s ease'}}>
            <div style={{width:86,height:86,borderRadius:'50%',background:phase==='success'?'linear-gradient(135deg,#06844b,#22c55e)':'linear-gradient(135deg,#dc2626,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:phase==='success'?'0 0 0 16px rgba(34,197,94,0.15)':'0 0 0 16px rgba(239,68,68,0.15)'}}>
              {phase==='success'?<Ic.Check/>:<Ic.Alert/>}
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff',fontWeight:800,fontSize:19,marginBottom:5}}>
                {phase==='success'?(result.action==='arrivee'?'✅ Arrivée enregistrée !':result.action==='depart'?'🏁 Départ enregistré !':'ℹ️ Déjà pointé'):'❌ Pointage refusé'}
              </div>
              <div style={{color:'rgba(255,255,255,0.55)',fontSize:13}}>{agent.nom} · {new Date().toTimeString().slice(0,5)}</div>
              {phase==='success'&&result.pointage?.arrivee&&result.pointage?.depart&&(()=>{
                const dur=(new Date(`2000-01-01T${result.pointage.depart}`)-new Date(`2000-01-01T${result.pointage.arrivee}`))/3600000;
                return(
                  <div style={{marginTop:12,background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'12px 28px',display:'inline-flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>Temps passé</div>
                    <div style={{fontSize:30,fontWeight:800,color:dur>=8?'#22c55e':'#f59e0b'}}>{Math.floor(dur)}h{pad(Math.round((dur%1)*60))}</div>
                    <div style={{fontSize:11,fontWeight:600,color:dur>=8?'#86efac':'#fde68a'}}>{dur>=8?'✓ Objectif atteint':`Déficit : ${8-Math.floor(dur)}h${pad(Math.round(((8-dur)%1)*60))}`}</div>
                  </div>
                );
              })()}
              {phase==='blocked'&&<div style={{marginTop:10,background:'rgba(239,68,68,0.1)',borderRadius:10,padding:'10px 16px',border:'1px solid rgba(239,68,68,0.3)',fontSize:12,color:'#fca5a5'}}>{result.error||'Position non autorisée'}</div>}
            </div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',justifyContent:'center'}}>
              {['📍 GPS','📷 Selfie',phase==='success'?'🔒 Autorisé':'🚫 Bloqué'].map((b,i)=>(
                <span key={i} style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'3px 9px',fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:600}}>{b}</span>
              ))}
            </div>
            <button onClick={reset} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'12px 32px',fontSize:13,fontWeight:700,color:'#fff',cursor:'pointer'}}>Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PLANNING ─────────────────────────────────────────────────────────────────
function PlanningScreen({agent}) {
  const [weekOff,setWeekOff]=useState(0);
  const [planData,setPlanData]=useState({});
  const today=nowStr();
  const mon=addDays(getMon(today),weekOff*7);
  const weekDates=Array.from({length:7},(_,i)=>addDays(mon,i));

  useEffect(()=>{
    api.planning({agent_id:agent.id,date_debut:addDays(mon,-7),date_fin:addDays(mon,13)}).then(rows=>{
      const map={};
      rows.forEach(x=>map[x.date]=x.shift_id);
      setPlanData(map);
    }).catch(()=>{});
  },[weekOff]);

  const d=new Date();
  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#1a3a5c,#2563eb)',padding:'20px 18px 24px'}}>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:10,fontWeight:700,textTransform:'uppercase'}}>Mon Planning</div>
        <div style={{color:'#fff',fontWeight:800,fontSize:18,marginTop:4}}>{MOIS_FR[d.getMonth()]} {d.getFullYear()}</div>
      </div>
      <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:12}}>
        {/* Nav semaine */}
        <div style={{background:'#fff',borderRadius:13,padding:'9px 13px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 1px 5px rgba(0,0,0,0.07)'}}>
          <button onClick={()=>setWeekOff(p=>p-1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex'}}><Ic.CL/></button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>Sem. du {shortDate(mon)}</div>
            <div style={{fontSize:10,color:'#64748b'}}>{weekOff===0?'Cette semaine':weekOff>0?`+${weekOff} sem.`:`${weekOff} sem.`}</div>
          </div>
          <div style={{display:'flex',gap:5,alignItems:'center'}}>
            {weekOff!==0&&<button onClick={()=>setWeekOff(0)} style={{background:'#e85d04',color:'#fff',border:'none',borderRadius:7,padding:'5px 8px',cursor:'pointer',fontSize:9,fontWeight:700}}>Auj.</button>}
            <button onClick={()=>setWeekOff(p=>p+1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex'}}><Ic.CR/></button>
          </div>
        </div>

        {/* Cartes jours */}
        {weekDates.map((dt,i)=>{
          const sid=planData[dt]||'repos';
          const s=SHIFTS.find(x=>x.id===sid)||SHIFTS[4];
          const isT=dt===today,isPast=dt<today;
          const dn=new Date(dt);
          return(
            <div key={dt} style={{background:'#fff',borderRadius:14,padding:'13px 16px',display:'flex',alignItems:'center',gap:14,boxShadow:isT?'0 4px 16px rgba(232,93,4,0.15)':'0 1px 4px rgba(0,0,0,0.06)',border:isT?'2px solid #e85d04':'2px solid transparent',opacity:isPast&&!isT?0.65:1}}>
              <div style={{width:42,textAlign:'center',flexShrink:0}}>
                <div style={{fontSize:10,fontWeight:700,color:isT?'#e85d04':'#94a3b8',textTransform:'uppercase'}}>{JOURS_SEM[i]}</div>
                <div style={{fontSize:22,fontWeight:800,color:isT?'#e85d04':'#1e293b',lineHeight:1}}>{dn.getDate()}</div>
              </div>
              <div style={{width:3,height:40,borderRadius:2,background:s.color,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700}}>{s.label}</span>
                  {isT&&<span style={{fontSize:9,fontWeight:700,color:'#e85d04',background:'#fff7ed',padding:'2px 7px',borderRadius:20}}>Aujourd'hui</span>}
                </div>
                {s.heure!=='—'&&<div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{s.heure}</div>}
              </div>
            </div>
          );
        })}

        {/* Légende */}
        <div style={{background:'#fff',borderRadius:13,padding:'13px 14px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:9,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:9}}>Légende des shifts</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {SHIFTS.map(s=>(
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:7,background:s.bg,borderRadius:9,padding:'7px 10px'}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:s.color}}>{s.label}</div>
                  {s.heure!=='—'&&<div style={{fontSize:9,color:'#94a3b8'}}>{s.heure}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROFIL ───────────────────────────────────────────────────────────────────
function ProfilScreen({agent,setAgent,onLogout}) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({...agent});
  const [saved,setSaved]=useState(false);
  const [historique,setHistorique]=useState([]);

  useEffect(()=>{
    api.pointages({agent_id:agent.id}).then(rows=>setHistorique(rows)).catch(()=>{});
  },[]);

  async function save() {
    try {
      await api.updateAgent(agent.id,{...form});
      setAgent(form);setEditing(false);setSaved(true);setTimeout(()=>setSaved(false),2500);
    } catch(e){}
  }

  function handlePhoto(e) {
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>setForm(p=>({...p,photo_base64:ev.target.result}));r.readAsDataURL(f);
  }

  const moisPts=historique.filter(p=>moisStr(p.date)===moisStr(nowStr()));
  const totalH=moisPts.reduce((a,p)=>a+(p.arrivee&&p.depart?((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))/3600000):0),0);
  const joursP=moisPts.filter(p=>p.arrivee).length;

  function anc(ds){if(!ds)return'';const m=Math.floor((new Date()-new Date(ds))/(30.44*86400000));return m<12?`${m} mois`:`${Math.floor(m/12)} an${Math.floor(m/12)>1?'s':''}`;}

  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1a3a5c)',padding:'0 0 24px',overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',top:-20,right:-20,width:120,height:120,borderRadius:'50%',background:'rgba(232,93,4,0.1)'}}/>
        <div style={{padding:'16px 18px 0',display:'flex',justifyContent:'flex-end'}}>
          <button onClick={()=>setEditing(!editing)} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:'5px 13px',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <Ic.Edit/>{editing?'Annuler':'Modifier'}
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'6px 18px 0'}}>
          <div style={{position:'relative'}}>
            <Av ag={editing?form:agent} size={78} border="rgba(255,255,255,0.3)"/>
            {editing&&(
              <label htmlFor="pp" style={{position:'absolute',bottom:0,right:0,background:'#e85d04',borderRadius:'50%',width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid #fff'}}>
                <Ic.Cam/>
                <input id="pp" type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto}/>
              </label>
            )}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'#fff',fontWeight:800,fontSize:18}}>{agent.nom} {agent.prenom}</div>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>{agent.poste}</div>
            <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:7,flexWrap:'wrap'}}>
              <span style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.75)',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{agent.contrat}</span>
              {agent.dateEmbauche&&<span style={{background:'rgba(232,93,4,0.25)',color:'#fb923c',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{anc(agent.date_embauche||agent.dateEmbauche)}</span>}
            </div>
          </div>
        </div>
      </div>

      {saved&&<div style={{margin:'10px 14px 0',background:'#ecfdf5',border:'1px solid #6ee7b7',borderRadius:11,padding:'9px 13px',fontSize:12,fontWeight:600,color:'#065f46'}}>✅ Profil mis à jour !</div>}

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
          {[{l:'Heures mois',v:`${Math.floor(totalH)}h${pad(Math.round((totalH%1)*60))}`,c:'#1a3a5c'},{l:'Jours présents',v:`${joursP}j`,c:'#e85d04'}].map(({l,v,c})=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'13px 14px',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}>
              <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {editing?(
          <div style={{background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 8px rgba(0,0,0,0.07)',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontWeight:700,fontSize:14,color:'#1e293b'}}>Modifier mes informations</div>
            {[['Nom','nom'],['Prénom','prenom'],['Téléphone','tel'],['Email','email']].map(([label,key])=>(
              <div key={key}>
                <label style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>
                <input value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{width:'100%',padding:'11px 13px',borderRadius:10,border:'1.5px solid #e2e8f0',fontSize:14,outline:'none'}}/>
              </div>
            ))}
            <button onClick={save} style={{background:'linear-gradient(135deg,#1a3a5c,#2563eb)',color:'#fff',border:'none',borderRadius:12,padding:'13px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Enregistrer</button>
          </div>
        ):(
          <div style={{background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
            {agent.tel&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:32,height:32,background:'#f1f5f9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',flexShrink:0}}><Ic.Phone/></div><span style={{fontSize:13}}>{agent.tel}</span></div>}
            {agent.email&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:32,height:32,background:'#f1f5f9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',flexShrink:0}}><Ic.Mail/></div><span style={{fontSize:13}}>{agent.email}</span></div>}
            <div style={{marginTop:12}}>
              {[['ID',agent.id],['Contrat',agent.contrat],['Horaire',agent.horaire]].map(([k,v])=>v&&(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}>
                  <span style={{color:'#94a3b8'}}>{k}</span><span style={{fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR personnel */}
        <div style={{background:'#fff',borderRadius:14,padding:'16px',textAlign:'center',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:10}}>Ma carte QR personnelle</div>
          <div style={{display:'inline-block',padding:10,background:'#f8fafc',borderRadius:12,border:'1.5px solid #e2e8f0'}}>
            <QRVis value={`EP_${agent.id}_${agent.nom.toUpperCase()}`} size={110}/>
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:8}}>Présentez au terminal fixe à l'entrée</div>
        </div>

        {/* Historique récent */}
        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}>
          <div style={{fontWeight:700,fontSize:12,color:'#1e293b',marginBottom:10}}>Historique récent</div>
          {historique.slice(0,8).map((p,i)=>{
            const dur=p.arrivee&&p.depart?((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))/3600000):null;
            const ok=dur>=8;
            return(<div key={p.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<7?'1px solid #f1f5f9':'none',fontSize:12}}>
              <span style={{fontWeight:600,color:'#1e293b'}}>{shortDate(p.date)}</span>
              <span style={{color:'#64748b'}}>{p.arrivee?.slice(0,5)||'—'} → {p.depart?.slice(0,5)||'—'}</span>
              <span style={{fontWeight:700,color:ok?'#06844b':'#f59e0b'}}>{dur?`${Math.floor(dur)}h${pad(Math.round((dur%1)*60))}`:'—'}</span>
            </div>);
          })}
          {historique.length===0&&<div style={{color:'#94a3b8',fontSize:12,textAlign:'center',padding:'10px 0'}}>Aucun pointage</div>}
        </div>

        {/* Déconnexion */}
        <div onClick={onLogout} style={{background:'#fff',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
          <div style={{width:36,height:36,background:'#fee2e2',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center'}}><Ic.Out/></div>
          <div><div style={{fontSize:12,fontWeight:700,color:'#dc2626'}}>Se déconnecter</div><div style={{fontSize:10,color:'#94a3b8'}}>Retour à la sélection</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── APP AGENT PRINCIPALE ─────────────────────────────────────────────────────
export default function AgentApp() {
  const [agent,setAgent]=useState(null);
  const [tab,setTab]=useState('home');
  const [clockStr,setClockStr]=useState('');

  useEffect(()=>{
    const saved=localStorage.getItem('ep_agent_data');
    if(saved) try{ setAgent(JSON.parse(saved)); }catch(e){}
  },[]);

  useEffect(()=>{
    const tick=()=>{const d=new Date();setClockStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`);};
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[]);

  function handleLogin(ag) {
    setAgent(ag);
    localStorage.setItem('ep_agent_data',JSON.stringify(ag));
    setTab('home');
  }

  function handleLogout() {
    localStorage.removeItem('ep_agent_data');
    setAgent(null);
    setTab('home');
  }

  const TABS=[
    {id:'home',  label:'Accueil', Icon:Ic.Home},
    {id:'scan',  label:'Pointer', Icon:Ic.Scan},
    {id:'plan',  label:'Planning',Icon:Ic.Cal},
    {id:'profil',label:'Profil',  Icon:Ic.User},
  ];

  return(
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 50%,#1e4d8c 100%)',padding:'10px',fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      {/* Shell smartphone */}
      <div style={{width:'min(390px,100vw)',height:'min(820px,95vh)',borderRadius:'min(48px,6vw)',background:'#1e293b',boxShadow:'0 40px 120px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(255,255,255,0.1)',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
        {/* Status bar */}
        <div style={{height:44,background:agent?'#0f172a':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 22px',flexShrink:0,zIndex:20}}>
          <div style={{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{clockStr}</div>
          <div style={{width:110,height:24,background:'#000',borderRadius:18,position:'absolute',left:'50%',transform:'translateX(-50%)',top:10}}/>
          <div style={{color:'rgba(255,255,255,0.65)',fontSize:12}}>▊▊▊</div>
        </div>

        {/* Contenu */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {!agent
            ?<LoginScreen onLogin={handleLogin}/>
            :<>
              {tab==='home'  &&<HomeScreen  agent={agent} clockStr={clockStr} setTab={setTab}/>}
              {tab==='scan'  &&<ScanScreen  agent={agent}/>}
              {tab==='plan'  &&<PlanningScreen agent={agent}/>}
              {tab==='profil'&&<ProfilScreen agent={agent} setAgent={a=>{setAgent(a);localStorage.setItem('ep_agent_data',JSON.stringify(a));}} onLogout={handleLogout}/>}
            </>
          }
        </div>

        {/* Bottom nav */}
        {agent&&(
          <div style={{height:68,background:'rgba(10,18,32,0.98)',backdropFilter:'blur(20px)',display:'flex',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
            {TABS.map(({id,label,Icon})=>{
              const active=tab===id;
              return(
                <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,border:'none',background:'none',cursor:'pointer',color:active?'#e85d04':'rgba(255,255,255,0.3)',padding:'7px 0',transition:'all 0.15s',position:'relative'}}>
                  {active&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:22,height:2.5,background:'#e85d04',borderRadius:'0 0 3px 3px'}}/>}
                  <Icon/>
                  <span style={{fontSize:9,fontWeight:active?700:500,letterSpacing:'0.03em'}}>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{height:22,background:'rgba(10,18,32,0.98)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <div style={{width:90,height:3.5,background:'rgba(255,255,255,0.18)',borderRadius:2}}/>
        </div>
      </div>

      <style>{`
        @keyframes pulseAnim{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:12px;opacity:1}50%{top:140px;opacity:0.8}100%{top:12px;opacity:1}}
        @keyframes cornerAnim{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{display:none;}
        button:active{opacity:0.85;}
      `}</style>
    </div>
  );
}
