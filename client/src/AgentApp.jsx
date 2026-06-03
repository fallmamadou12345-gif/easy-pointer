import { useState, useEffect, useRef, useCallback } from 'react';

// ─── CONFIG API ───────────────────────────────────────────────────────────────
const API_BASE = '/api/agent-app';

function getToken() { return localStorage.getItem('ep_agent_token'); }
function setToken(t) { localStorage.setItem('ep_agent_token', t); }
function clearToken() { localStorage.removeItem('ep_agent_token'); localStorage.removeItem('ep_agent_data'); }

async function apiCall(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { clearToken(); window.location.reload(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const SHIFTS = [
  { id:'matin',  label:'Matin',       heure:'06:00–14:00', color:'#d97706', bg:'#fef3c7' },
  { id:'jour',   label:'Journée',     heure:'08:00–16:00', color:'#2563eb', bg:'#dbeafe' },
  { id:'apm',    label:'Après-midi',  heure:'10:00–18:00', color:'#7c3aed', bg:'#ede9fe' },
  { id:'soir',   label:'Soir',        heure:'14:00–22:00', color:'#ea580c', bg:'#ffedd5' },
  { id:'repos',  label:'Repos',       heure:'—',           color:'#64748b', bg:'#f1f5f9' },
  { id:'conge',  label:'Congé',       heure:'—',           color:'#059669', bg:'#d1fae5' },
];
const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const HEURES_REF = 8;

function pad(n) { return String(n).padStart(2,'0'); }
function nowStr() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function diffH(a,b) { if(!a||!b)return null; const[ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number); return((bh*60+bm)-(ah*60+am))/60; }
function fmtH(h) { if(h===null||h===undefined)return'—'; const neg=h<0,abs=Math.abs(h),hh=Math.floor(abs),mm=Math.round((abs-hh)*60); return`${neg?'-':''}${pad(hh)}h${pad(mm)}`; }
function getMon(ds) { const d=new Date(ds),day=d.getDay(),diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(ds,n) { const d=new Date(ds); d.setDate(d.getDate()+n); return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function shortDate(ds) { const d=new Date(ds); return`${pad(d.getDate())}/${pad(d.getMonth()+1)}`; }
function moisStr(d) { return d?.slice(0,7); }

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const I = {
  Home:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Scan:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  Cal:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:22,height:22}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Shield: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Clock:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Check:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width:28,height:28}}><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:26,height:26}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Map:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Cam:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Edit:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Phone:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 4.69 12 19.79 19.79 0 0 1 1.09 3.6 2 2 0 0 1 3.1 1.09h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.4 6.4l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Mail:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Out:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  CL:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18}}><polyline points="15 18 9 12 15 6"/></svg>,
  CR:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:18,height:18}}><polyline points="9 18 15 12 9 6"/></svg>,
  Spin:   ()=><div style={{width:20,height:20,border:'3px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>,
  Refresh:()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
};

// ─── QR CODE VISUEL ───────────────────────────────────────────────────────────
function QRVis({value,size=130}) {
  const cells=21,cell=size/cells;
  const h=(s)=>{let x=0;for(let i=0;i<s.length;i++)x=(x*31+s.charCodeAt(i))%997;return x;};
  const dots=[];
  for(let r=0;r<cells;r++) for(let c=0;c<cells;c++){
    const finder=(r<7&&c<7)||(r<7&&c>=cells-7)||(r>=cells-7&&c<7);
    const timing=(r===6||c===6)&&(r+c)%2===0;
    if(finder||timing||(!finder&&!timing&&(h(value+r*100+c)%3!==0))) dots.push([r,c]);
  }
  return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block'}}>
    <rect width={size} height={size} fill="white" rx="8"/>
    {dots.map(([r,c])=><rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill="#0f172a"/>)}
    <rect x={2.5*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
    <rect x={(cells-4.5)*cell} y={2.5*cell} width={2*cell} height={2*cell} fill="white"/>
    <rect x={2.5*cell} y={(cells-4.5)*cell} width={2*cell} height={2*cell} fill="white"/>
  </svg>);
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Av({ag,size=44,border}) {
  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];
  const ci=(ag?.id||'A001').charCodeAt(1)%pal.length;
  const s={width:size,height:size,borderRadius:'50%',flexShrink:0,...(border?{border:`3px solid ${border}`}:{})};
  if(ag?.photo_base64) return <img src={ag.photo_base64} alt={ag.nom} style={{...s,objectFit:'cover'}}/>;
  return <div style={{...s,background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size*0.34,fontWeight:800}}>{(ag?.nom||'?').charAt(0)}{(ag?.prenom||'').charAt(0)}</div>;
}

// ─── ÉCRAN DE SÉLECTION (liste des agents du serveur) ─────────────────────────
function SelectAgent({onSelect}) {
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState('');

  useEffect(()=>{
    fetch('/api/agents',{headers:{'Authorization':'Bearer dummy'}})
      .then(()=>{})
      .catch(()=>{});
    // Appel sans auth pour lister les agents (endpoint public simplifié)
    fetch('/api/agent-app/agents-list')
      .then(r=>r.json())
      .then(data=>{ if(Array.isArray(data)) setAgents(data); })
      .catch(()=>setErr('Impossible de charger les agents'))
      .finally(()=>setLoading(false));
  },[]);

  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#0f172a 0%,#1a3a5c 55%,#1e4d8c 100%)',overflow:'hidden'}}>
      <div style={{padding:'36px 24px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
        <div style={{width:54,height:54,background:'#e85d04',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff',boxShadow:'0 8px 24px rgba(232,93,4,0.5)'}}>EP</div>
        <div style={{color:'#fff',fontWeight:800,fontSize:20}}>Easy Pointer</div>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:20,padding:'3px 12px'}}>
          <I.Shield/><span style={{color:'#86efac',fontSize:10,fontWeight:700,letterSpacing:'0.08em'}}>GÉOFENCING ACTIVÉ</span>
        </div>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'0 18px 20px'}}>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,fontWeight:600,marginBottom:12,textAlign:'center'}}>Sélectionnez votre compte</div>
        {loading&&<div style={{textAlign:'center',color:'rgba(255,255,255,0.4)',padding:20}}><I.Spin/></div>}
        {err&&<div style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:12,padding:12,color:'#fca5a5',fontSize:12,textAlign:'center',marginBottom:12}}>{err}</div>}
        {agents.map(ag=>{
          const ci=ag.id.charCodeAt(1)%pal.length;
          return(<div key={ag.id} onClick={()=>onSelect(ag)}
            style={{background:'rgba(255,255,255,0.07)',backdropFilter:'blur(10px)',borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',marginBottom:8,transition:'all 0.15s'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:15,fontWeight:800,flexShrink:0}}>{ag.nom.charAt(0)}{(ag.prenom||'').charAt(0)}</div>
            <div style={{flex:1}}>
              <div style={{color:'#fff',fontWeight:700,fontSize:14}}>{ag.nom} {ag.prenom}</div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginTop:1}}>{ag.poste}</div>
            </div>
            <span style={{color:'rgba(255,255,255,0.3)',fontSize:20}}>›</span>
          </div>);
        })}
      </div>
    </div>
  );
}

// ─── ÉCRAN PIN ────────────────────────────────────────────────────────────────
function PinScreen({agent,onLogin,onBack}) {
  const [pin,setPin]=useState('');
  const [err,setErr]=useState(false);
  const [loading,setLoading]=useState(false);

  async function handlePin(d) {
    if(loading) return;
    if(d==='del'){ setPin(p=>p.slice(0,-1)); return; }
    const np=pin+d; setPin(np);
    if(np.length===4) {
      setLoading(true);
      try {
        const res = await apiCall('POST','/login',{agent_id:agent.id,pin:np});
        setToken(res.token);
        localStorage.setItem('ep_agent_data', JSON.stringify(res.agent));
        onLogin(res.agent);
      } catch(e) {
        setErr(true);
        setTimeout(()=>{ setPin(''); setErr(false); },900);
      } finally { setLoading(false); }
    }
  }

  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];
  const ci=agent.id.charCodeAt(1)%pal.length;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',background:'linear-gradient(160deg,#0f172a 0%,#1a3a5c 55%,#1e4d8c 100%)',padding:'28px 20px',overflow:'hidden'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:24,fontWeight:800,border:'3px solid rgba(255,255,255,0.3)',marginBottom:12}}>{agent.nom.charAt(0)}{(agent.prenom||'').charAt(0)}</div>
      <div style={{color:'#fff',fontWeight:800,fontSize:18}}>{agent.nom} {agent.prenom}</div>
      <div style={{color:'rgba(255,255,255,0.45)',fontSize:12,marginBottom:28}}>{agent.poste}</div>

      <div style={{display:'flex',gap:16,marginBottom:32}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:'50%',background:i<pin.length?(err?'#ef4444':'#e85d04'):'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.25)',transform:i<pin.length?'scale(1.25)':'scale(1)',transition:'all 0.15s'}}/>)}
      </div>
      {err&&<div style={{color:'#f87171',fontSize:11,marginBottom:12,fontWeight:600}}>Code incorrect — code démo : 1234</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,width:'100%',maxWidth:250}}>
        {['1','2','3','4','5','6','7','8','9','','0','del'].map(k=>(
          <button key={k} onClick={()=>k&&handlePin(k)} style={{height:56,borderRadius:14,border:'none',cursor:k?'pointer':'default',background:k==='del'?'rgba(255,255,255,0.07)':k?'rgba(255,255,255,0.09)':'transparent',color:k==='del'?'#94a3b8':'#fff',fontSize:k==='del'?18:21,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {loading&&k===''?<I.Spin/>:k==='del'?'⌫':k}
          </button>
        ))}
      </div>
      <button onClick={onBack} style={{marginTop:20,background:'transparent',border:'none',color:'rgba(255,255,255,0.35)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Changer de compte</button>
      <div style={{marginTop:6,color:'rgba(255,255,255,0.2)',fontSize:10}}>Code démo : 1 2 3 4</div>
    </div>
  );
}

// ─── ÉCRAN ACCUEIL ────────────────────────────────────────────────────────────
function HomeScreen({agent,historique,planning,clockStr,onTabChange}) {
  const today=nowStr();
  const todayPt=historique.find(p=>p.date===today);
  const moisPts=historique.filter(p=>moisStr(p.date)===moisStr(today));
  const totalH=moisPts.reduce((a,p)=>a+(diffH(p.arrivee,p.depart)||0),0);
  const joursP=moisPts.filter(p=>p.arrivee).length;
  const supH=Math.max(0,totalH-joursP*HEURES_REF);
  const status=!todayPt?'absent':!todayPt.depart?'present':'sorti';
  const sCfg={absent:{l:'Pas encore pointé',c:'#f59e0b',bg:'rgba(245,158,11,0.15)'},present:{l:'Présent · En cours',c:'#22c55e',bg:'rgba(34,197,94,0.15)'},sorti:{l:'Journée terminée',c:'#60a5fa',bg:'rgba(96,165,250,0.15)'}}[status];
  const d=new Date();
  const shiftToday=SHIFTS.find(s=>s.id===(planning[today]||'repos'))||SHIFTS[4];
  const derniers=[...historique].slice(0,5);

  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 60%,#1e4d8c 100%)',padding:'20px 18px 58px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.03)'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',position:'relative'}}>
          <div>
            <div style={{color:'rgba(255,255,255,0.45)',fontSize:10,fontWeight:600,textTransform:'uppercase'}}>{JOURS[d.getDay()]} {d.getDate()} {MOIS_FR[d.getMonth()]}</div>
            <div style={{color:'#fff',fontWeight:800,fontSize:20,marginTop:3}}>Bonjour, {agent.nom} 👋</div>
            <div style={{color:'rgba(255,255,255,0.45)',fontSize:11,marginTop:1}}>{agent.poste}</div>
          </div>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:22,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{clockStr}</div>
        </div>
        <div style={{marginTop:14,display:'inline-flex',alignItems:'center',gap:7,background:sCfg.bg,border:`1px solid ${sCfg.c}40`,borderRadius:28,padding:'6px 14px'}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:sCfg.c,animation:status==='present'?'pulse 2s infinite':'none'}}/>
          <span style={{color:sCfg.c,fontSize:11,fontWeight:700}}>{sCfg.l}</span>
          {todayPt?.arrivee&&<span style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>· {todayPt.arrivee.slice(0,5)}</span>}
        </div>
      </div>

      {/* Carte shift overlap */}
      <div style={{margin:'-28px 14px 0',background:'#fff',borderRadius:16,padding:'14px 16px',boxShadow:'0 4px 20px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',zIndex:10}}>
        <div>
          <div style={{fontSize:9,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:4}}>Shift aujourd'hui</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:shiftToday.bg,color:shiftToday.color,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:700,border:`1px solid ${shiftToday.color}30`}}>{shiftToday.label}</span>
            {shiftToday.heure!=='—'&&<span style={{fontSize:11,color:'#64748b'}}>{shiftToday.heure}</span>}
          </div>
        </div>
        <button onClick={()=>onTabChange('scan')} style={{background:'linear-gradient(135deg,#e85d04,#f97316)',border:'none',borderRadius:12,padding:'10px 16px',fontSize:12,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 14px rgba(232,93,4,0.4)'}}>
          <I.Scan/>Pointer
        </button>
      </div>

      <div style={{padding:'16px 14px',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9}}>
          {[{l:'Heures mois',v:fmtH(totalH),c:'#1a3a5c'},{l:'Heures sup',v:`+${fmtH(supH)}`,c:'#06844b'},{l:'Jours présents',v:`${joursP}j`,c:'#e85d04'}].map(({l,v,c})=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'12px 10px',boxShadow:'0 1px 5px rgba(0,0,0,0.05)',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:9,color:'#94a3b8',marginTop:2,lineHeight:1.3}}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',boxShadow:'0 1px 6px rgba(0,0,0,0.06)'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1e293b',marginBottom:12,display:'flex',alignItems:'center',gap:6}}><I.Clock/>Activité récente</div>
          {derniers.length===0&&<div style={{color:'#94a3b8',fontSize:12,textAlign:'center',padding:'12px 0'}}>Aucun pointage enregistré</div>}
          {derniers.map((p,i)=>{
            const dur=diffH(p.arrivee,p.depart),ok=dur>=HEURES_REF,isT=p.date===today;
            return(<div key={p.date||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<derniers.length-1?'1px solid #f1f5f9':'none'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:isT?'#e85d04':ok?'#22c55e':'#f59e0b',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,fontWeight:700,color:isT?'#e85d04':'#1e293b'}}>{isT?'Aujourd\'hui':shortDate(p.date)}</span>
                  <span style={{fontSize:12,fontWeight:800,color:ok?'#06844b':'#f59e0b'}}>{fmtH(dur)}</span>
                </div>
                <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>↑{p.arrivee?.slice(0,5)||'—'} {p.depart?'↓'+p.depart.slice(0,5):''} {p.zone_nom?`· ${p.zone_nom}`:''}</div>
              </div>
            </div>);
          })}
        </div>

        {/* Prochain shift */}
        {(()=>{
          const demain=addDays(today,1);
          const s=SHIFTS.find(x=>x.id===(planning[demain]||'repos'))||SHIFTS[4];
          return(<div style={{background:s.bg,borderRadius:14,padding:'12px 16px',border:`1px solid ${s.color}25`,display:'flex',alignItems:'center',gap:12}}>
            <I.Cal/>
            <div><div style={{fontSize:10,color:s.color,fontWeight:700,textTransform:'uppercase'}}>Demain</div>
            <div style={{fontSize:13,fontWeight:700,color:'#1e293b',marginTop:2}}>{s.label}{s.heure!=='—'?` · ${s.heure}`:''}</div></div>
          </div>);
        })()}
      </div>
    </div>
  );
}

// ─── ÉCRAN SCAN + GÉOFENCING ──────────────────────────────────────────────────
function ScanScreen({agent,onPointageDone}) {
  const [phase,setPhase]=useState('idle'); // idle|gps|gps_done|selfie|selfie_done|scanning|success|blocked
  const [gpsData,setGpsData]=useState(null);
  const [selfie,setSelfie]=useState(false);
  const [result,setResult]=useState(null);
  const [todayPt,setTodayPt]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    apiCall('GET','/historique').then(hist=>{
      const tp=hist.find(p=>p.date===nowStr());
      setTodayPt(tp||null);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const nextAction=!todayPt?'Pointer l\'arrivée':!todayPt.depart?'Pointer le départ':'Journée complète';
  const agentZone=agent.zoneDefaut||agent.zones?.[0];

  function startGPS() {
    setPhase('gps');
    // En production : navigator.geolocation.getCurrentPosition(...)
    // Ici simulation avec position dans/hors zone aléatoirement
    setTimeout(()=>{
      if(agentZone) {
        const inZone=Math.random()>0.2;
        const lat=agentZone.lat+(inZone?0.0005:-0.003);
        const lon=agentZone.lon+(inZone?0.0005:-0.003);
        const dist=inZone?Math.floor(Math.random()*agentZone.rayon*0.8):agentZone.rayon+150+Math.floor(Math.random()*200);
        setGpsData({lat,lon,dist,ok:inZone,zone:agentZone});
      } else {
        setGpsData({lat:14.7298,lon:-17.4973,dist:0,ok:true,zone:{nom:'Bureau Principal',rayon:150}});
      }
      setPhase('gps_done');
    },2000);
  }

  function startSelfie() {
    setPhase('selfie');
    setTimeout(()=>{ setSelfie(true); setPhase('selfie_done'); },1500);
  }

  async function doScan() {
    setPhase('scanning');
    try {
      const res = await apiCall('POST','/scan',{lat:gpsData?.lat,lon:gpsData?.lon,selfie:true});
      setResult({...res,time:new Date().toTimeString().slice(0,5)});
      setPhase('success');
      onPointageDone();
    } catch(e) {
      if(e.message?.includes('HORS_ZONE')||e.message?.includes('m (max')) {
        setPhase('blocked');
        setResult({msg:e.message});
      } else {
        setPhase('blocked');
        setResult({msg:e.message||'Erreur réseau'});
      }
    }
  }

  function reset() { setPhase('idle'); setGpsData(null); setSelfie(false); setResult(null); }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#0f172a'}}>
      <div style={{padding:'14px 18px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{color:'#fff',fontWeight:700,fontSize:15}}>Pointage Sécurisé</div>
        <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:20,padding:'3px 10px'}}>
          <I.Shield/><span style={{color:'#86efac',fontSize:9,fontWeight:700}}>GÉOFENCING</span>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0 18px 20px',gap:16,overflow:'auto'}}>

        {phase==='idle'&&(
          <>
            {agentZone&&(
              <div style={{width:'100%',background:'rgba(255,255,255,0.06)',borderRadius:14,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.1)'}}>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Zone autorisée</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 8px #22c55e'}}/>
                  <div>
                    <div style={{color:'#fff',fontWeight:700,fontSize:13}}>{agentZone.nom}</div>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>{agentZone.adresse||agentZone.ville} · Rayon : {agentZone.rayon}m</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>Étapes de validation</div>
              {[{ico:<I.Map/>,l:'Vérification GPS',s:`Rayon autorisé : ${agentZone?.rayon||150}m`,c:'#2563eb'},{ico:<I.Cam/>,l:'Selfie de présence',s:'Photo horodatée',c:'#7c3aed'},{ico:<I.Scan/>,l:'Scan QR Bureau',s:'Code QR fixe à l\'entrée',c:'#e85d04'}].map(({ico,l,s,c},i)=>(
                <div key={i} style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'11px 13px',display:'flex',alignItems:'center',gap:12,border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`${c}20`,border:`1px solid ${c}40`,display:'flex',alignItems:'center',justifyContent:'center',color:c,flexShrink:0}}>{ico}</div>
                  <div><div style={{color:'#fff',fontWeight:600,fontSize:12}}>{l}</div><div style={{color:'rgba(255,255,255,0.35)',fontSize:10,marginTop:1}}>{s}</div></div>
                </div>
              ))}
            </div>

            {todayPt&&(
              <div style={{width:'100%',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'11px 14px',border:'1px solid rgba(255,255,255,0.1)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>Arrivée enregistrée</div>
                <div style={{fontSize:15,fontWeight:800,color:'#22c55e'}}>{todayPt.arrivee?.slice(0,5)}</div>
              </div>
            )}

            {nextAction==='Journée complète'?(
              <div style={{width:'100%',background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.3)',borderRadius:14,padding:'14px',textAlign:'center'}}>
                <div style={{color:'#60a5fa',fontWeight:700,fontSize:15}}>✓ Journée complète</div>
                <div style={{color:'rgba(255,255,255,0.45)',fontSize:12,marginTop:4}}>Arrivée {todayPt?.arrivee?.slice(0,5)} · Départ {todayPt?.depart?.slice(0,5)}</div>
                <div style={{fontSize:15,fontWeight:800,color:'#fff',marginTop:6}}>{fmtH(diffH(todayPt?.arrivee,todayPt?.depart))}</div>
              </div>
            ):(
              <button onClick={startGPS} style={{width:'100%',background:'linear-gradient(135deg,#1a3a5c,#2563eb)',border:'none',borderRadius:16,padding:'16px',fontSize:15,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 8px 24px rgba(37,99,235,0.4)'}}>
                <I.Map/> Lancer la vérification
              </button>
            )}
          </>
        )}

        {phase==='gps'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
            <div style={{width:80,height:80,borderRadius:'50%',border:'3px solid #2563eb',display:'flex',alignItems:'center',justifyContent:'center',animation:'spin 2s linear infinite',color:'#2563eb'}}><I.Map/></div>
            <div style={{textAlign:'center'}}><div style={{color:'#fff',fontWeight:700,fontSize:16}}>Localisation GPS</div><div style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:4}}>Acquisition du signal…</div></div>
          </div>
        )}

        {phase==='gps_done'&&gpsData&&(
          <div style={{width:'100%',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:gpsData.ok?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',borderRadius:14,padding:'14px 16px',border:`1.5px solid ${gpsData.ok?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:12,height:12,borderRadius:'50%',background:gpsData.ok?'#22c55e':'#ef4444',boxShadow:`0 0 8px ${gpsData.ok?'#22c55e':'#ef4444'}`}}/>
                <div style={{color:gpsData.ok?'#86efac':'#fca5a5',fontWeight:700,fontSize:14}}>{gpsData.ok?'✓ Position validée':'✗ Hors zone autorisée'}</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:'rgba(255,255,255,0.05)',borderRadius:9,padding:'8px 10px'}}><div style={{fontSize:9,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:2}}>Zone</div><div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{gpsData.zone?.nom}</div></div>
                <div style={{background:'rgba(255,255,255,0.05)',borderRadius:9,padding:'8px 10px'}}><div style={{fontSize:9,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',marginBottom:2}}>Distance</div><div style={{fontSize:14,fontWeight:800,color:gpsData.ok?'#22c55e':'#ef4444'}}>{gpsData.dist}m <span style={{fontSize:9,color:'rgba(255,255,255,0.35)'}}>/ {gpsData.zone?.rayon}m max</span></div></div>
              </div>
            </div>
            {gpsData.ok?(
              <button onClick={startSelfie} style={{width:'100%',background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',borderRadius:14,padding:'14px',fontSize:14,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9}}>
                <I.Cam/> Étape suivante : Selfie
              </button>
            ):(
              <>
                <div style={{background:'rgba(239,68,68,0.08)',borderRadius:12,padding:'13px 15px',border:'1px solid rgba(239,68,68,0.25)'}}>
                  <div style={{color:'#fca5a5',fontWeight:700,fontSize:13,marginBottom:4}}>⚠️ Pointage impossible</div>
                  <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,lineHeight:1.5}}>Vous devez être dans un rayon de <b style={{color:'#fff'}}>{gpsData.zone?.rayon}m</b> autour de <b style={{color:'#fff'}}>{gpsData.zone?.nom}</b>. Vous êtes à <b style={{color:'#ef4444'}}>{gpsData.dist}m</b>.</div>
                </div>
                <button onClick={reset} style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'none',borderRadius:14,padding:'11px',fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.6)',cursor:'pointer'}}>Réessayer</button>
              </>
            )}
          </div>
        )}

        {phase==='selfie'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18}}>
            <div style={{width:90,height:90,borderRadius:'50%',border:'3px solid #7c3aed',display:'flex',alignItems:'center',justifyContent:'center',animation:'pulseBig 1.5s ease infinite',color:'#7c3aed'}}><I.Cam/></div>
            <div style={{textAlign:'center'}}><div style={{color:'#fff',fontWeight:700,fontSize:15}}>Capture selfie…</div><div style={{color:'rgba(255,255,255,0.45)',fontSize:12,marginTop:3}}>Authentification visuelle en cours</div></div>
          </div>
        )}

        {phase==='selfie_done'&&(
          <div style={{width:'100%',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'rgba(124,58,237,0.12)',borderRadius:14,padding:'14px 16px',border:'1.5px solid rgba(124,58,237,0.4)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><div style={{width:12,height:12,borderRadius:'50%',background:'#a78bfa'}}/><div style={{color:'#c4b5fd',fontWeight:700,fontSize:14}}>✓ Selfie capturé et horodaté</div></div>
              <div style={{display:'flex',gap:10}}>
                <div style={{width:60,height:60,borderRadius:10,background:'rgba(124,58,237,0.3)',border:'1px solid rgba(124,58,237,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>😊</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{agent.nom} {agent.prenom}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>{nowStr()} · {new Date().toTimeString().slice(0,5)}</div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:5,background:'rgba(34,197,94,0.12)',borderRadius:20,padding:'2px 8px'}}><div style={{width:5,height:5,borderRadius:'50%',background:'#22c55e'}}/><span style={{fontSize:9,color:'#86efac',fontWeight:700}}>Visage vérifié</span></div>
                </div>
              </div>
            </div>
            <button onClick={doScan} style={{width:'100%',background:'linear-gradient(135deg,#e85d04,#f97316)',border:'none',borderRadius:14,padding:'14px',fontSize:15,fontWeight:800,color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9,boxShadow:'0 8px 24px rgba(232,93,4,0.4)'}}>
              <I.Scan/> Scanner le QR Bureau
            </button>
          </div>
        )}

        {phase==='scanning'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
            <div style={{position:'relative',width:180,height:180}}>
              {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
                <div key={i} style={{position:'absolute',width:26,height:26,...pos,borderTop:i<2?'3px solid #e85d04':'none',borderBottom:i>=2?'3px solid #e85d04':'none',borderLeft:i%2===0?'3px solid #e85d04':'none',borderRight:i%2===1?'3px solid #e85d04':'none',borderRadius:i===0?'5px 0 0 0':i===1?'0 5px 0 0':i===2?'0 0 0 5px':'0 0 5px 0',animation:'cornerPulse 1s ease infinite'}}/>
              ))}
              <div style={{position:'absolute',left:15,right:15,height:2,background:'linear-gradient(90deg,transparent,#e85d04,transparent)',animation:'scanLine 1.5s ease-in-out infinite'}}/>
              <div style={{position:'absolute',inset:'15px',opacity:0.7}}><QRVis value="EASY_POINTER_BUREAU_DAKAR_2026" size={148}/></div>
            </div>
            <div style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600,animation:'pulse 1s ease infinite'}}>Lecture QR en cours…</div>
          </div>
        )}

        {(phase==='success'||phase==='blocked')&&result&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,animation:'fadeUp 0.4s ease'}}>
            <div style={{width:86,height:86,borderRadius:'50%',background:phase==='success'?'linear-gradient(135deg,#06844b,#22c55e)':'linear-gradient(135deg,#dc2626,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:phase==='success'?'0 0 0 16px rgba(34,197,94,0.15)':'0 0 0 16px rgba(239,68,68,0.15)'}}>
              {phase==='success'?<I.Check/>:<I.Alert/>}
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{color:'#fff',fontWeight:800,fontSize:19,marginBottom:5}}>
                {phase==='success'?(result.action==='arrivee'?'✅ Arrivée enregistrée !':result.action==='depart'?'🏁 Départ enregistré !':'ℹ️ Déjà pointé'):'⛔ Pointage refusé'}
              </div>
              <div style={{color:'rgba(255,255,255,0.55)',fontSize:13}}>{agent.nom} · {result.time}</div>
              {phase==='success'&&result.action==='depart'&&result.pointage&&(
                <div style={{marginTop:14,background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'12px 28px',display:'inline-flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',textTransform:'uppercase'}}>Temps passé</div>
                  {(()=>{const dur=diffH(result.pointage.arrivee,result.pointage.depart);return(<><div style={{fontSize:30,fontWeight:800,color:dur>=HEURES_REF?'#22c55e':'#f59e0b'}}>{fmtH(dur)}</div><div style={{fontSize:11,fontWeight:600,color:dur>=HEURES_REF?'#86efac':'#fde68a'}}>{dur>=HEURES_REF?'✓ Objectif atteint':`Déficit : ${fmtH(HEURES_REF-dur)}`}</div></>);})()}
                </div>
              )}
              {phase==='blocked'&&<div style={{marginTop:12,background:'rgba(239,68,68,0.1)',borderRadius:12,padding:'10px 18px',border:'1px solid rgba(239,68,68,0.3)'}}><div style={{fontSize:12,color:'#fca5a5'}}>{result.msg}</div></div>}
            </div>
            <button onClick={reset} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'12px 32px',fontSize:13,fontWeight:700,color:'#fff',cursor:'pointer'}}>Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ÉCRAN PLANNING ───────────────────────────────────────────────────────────
function PlanningScreen({planning}) {
  const [weekOff,setWeekOff]=useState(0);
  const mon=addDays(getMon(nowStr()),weekOff*7);
  const weekDates=Array.from({length:7},(_,i)=>addDays(mon,i));
  const today=nowStr();
  const d=new Date();

  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#1a3a5c,#2563eb)',padding:'20px 20px 24px'}}>
        <div style={{color:'rgba(255,255,255,0.5)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Mon Planning</div>
        <div style={{color:'#fff',fontWeight:800,fontSize:18,marginTop:4}}>{MOIS_FR[d.getMonth()]} {d.getFullYear()}</div>
      </div>
      <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{background:'#fff',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 1px 6px rgba(0,0,0,0.07)'}}>
          <button onClick={()=>setWeekOff(p=>p-1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex'}}><I.CL/></button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700,fontSize:13}}>Sem. du {shortDate(mon)}</div>
            <div style={{fontSize:11,color:'#64748b'}}>{weekOff===0?'Cette semaine':weekOff>0?`+${weekOff} sem.`:`${weekOff} sem.`}</div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {weekOff!==0&&<button onClick={()=>setWeekOff(0)} style={{background:'#e85d04',color:'#fff',border:'none',borderRadius:7,padding:'5px 8px',cursor:'pointer',fontSize:10,fontWeight:700}}>Auj.</button>}
            <button onClick={()=>setWeekOff(p=>p+1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex'}}><I.CR/></button>
          </div>
        </div>

        {weekDates.map((d,i)=>{
          const sid=planning[d]||'repos';
          const s=SHIFTS.find(x=>x.id===sid)||SHIFTS[4];
          const isT=d===today,isPast=d<today;
          const dn=new Date(d);
          return(<div key={d} style={{background:'#fff',borderRadius:14,padding:'13px 16px',display:'flex',alignItems:'center',gap:14,boxShadow:isT?'0 4px 16px rgba(232,93,4,0.15)':'0 1px 4px rgba(0,0,0,0.06)',border:isT?'2px solid #e85d04':'2px solid transparent',opacity:isPast&&!isT?0.65:1}}>
            <div style={{width:42,textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:10,fontWeight:700,color:isT?'#e85d04':'#94a3b8',textTransform:'uppercase'}}>{JOURS[dn.getDay()]}</div>
              <div style={{fontSize:22,fontWeight:800,color:isT?'#e85d04':'#1e293b',lineHeight:1}}>{dn.getDate()}</div>
            </div>
            <div style={{width:3,height:40,borderRadius:2,background:s.color,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{background:s.bg,color:s.color,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700}}>{s.label}</span>
                {isT&&<span style={{fontSize:10,fontWeight:700,color:'#e85d04',background:'#fff7ed',padding:'2px 7px',borderRadius:20}}>Aujourd'hui</span>}
              </div>
              {s.heure!=='—'&&<div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{s.heure}</div>}
            </div>
          </div>);
        })}

        <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Légende</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {SHIFTS.map(s=><div key={s.id} style={{display:'flex',alignItems:'center',gap:7,background:s.bg,borderRadius:9,padding:'7px 10px'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:s.color,flexShrink:0}}/>
              <div><div style={{fontSize:11,fontWeight:700,color:s.color}}>{s.label}</div>{s.heure!=='—'&&<div style={{fontSize:9,color:'#94a3b8'}}>{s.heure}</div>}</div>
            </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ÉCRAN PROFIL ─────────────────────────────────────────────────────────────
function ProfilScreen({agent,setAgent,onLogout}) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({nom:agent.nom,prenom:agent.prenom,tel:agent.tel||'',email:agent.email||''});
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await apiCall('PUT','/profile',form);
      setAgent(p=>({...p,...form}));
      localStorage.setItem('ep_agent_data',JSON.stringify({...agent,...form}));
      setEditing(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
    } catch(e){ alert(e.message); } finally{ setLoading(false); }
  }

  function handlePhoto(e) {
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=async(ev)=>{
      try {
        await apiCall('PUT','/profile',{...form,photo_base64:ev.target.result});
        setAgent(p=>({...p,photo_base64:ev.target.result}));
        localStorage.setItem('ep_agent_data',JSON.stringify({...agent,photo_base64:ev.target.result}));
      } catch(e){ alert(e.message); }
    }; r.readAsDataURL(f);
  }

  function anc(ds){ if(!ds)return''; const m=Math.floor((new Date()-new Date(ds))/(30.44*86400000)); return m<12?`${m} mois`:`${Math.floor(m/12)} an${Math.floor(m/12)>1?'s':''}`; }

  return(
    <div style={{flex:1,overflow:'auto',background:'#f0f4f8'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1a3a5c)',padding:'0 0 24px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-20,right:-20,width:120,height:120,borderRadius:'50%',background:'rgba(232,93,4,0.1)'}}/>
        <div style={{padding:'16px 18px 0',display:'flex',justifyContent:'flex-end'}}>
          <button onClick={()=>setEditing(!editing)} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:'5px 13px',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            <I.Edit/>{editing?'Annuler':'Modifier'}
          </button>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'6px 18px 0'}}>
          <div style={{position:'relative'}}>
            <Av ag={agent} size={78} border="rgba(255,255,255,0.3)"/>
            {editing&&<label htmlFor="pp" style={{position:'absolute',bottom:0,right:0,background:'#e85d04',borderRadius:'50%',width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid #fff'}}><I.Cam/><input id="pp" type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto}/></label>}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'#fff',fontWeight:800,fontSize:18}}>{agent.nom} {agent.prenom}</div>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>{agent.poste}</div>
            <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:7,flexWrap:'wrap'}}>
              <span style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.75)',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{agent.contrat}</span>
              <span style={{background:'rgba(232,93,4,0.25)',color:'#fb923c',padding:'2px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>Ancienneté : {anc(agent.date_embauche)}</span>
            </div>
          </div>
        </div>
      </div>

      {saved&&<div style={{margin:'10px 14px 0',background:'#ecfdf5',border:'1px solid #6ee7b7',borderRadius:11,padding:'9px 13px',fontSize:12,fontWeight:600,color:'#065f46'}}>✅ Profil mis à jour !</div>}

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:12}}>
        {editing?(
          <div style={{background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 8px rgba(0,0,0,0.07)',display:'flex',flexDirection:'column',gap:12}}>
            {[['Nom','nom'],['Prénom','prenom'],['Téléphone','tel'],['Email','email']].map(([l,k])=>(
              <div key={k}><label style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',display:'block',marginBottom:4}}>{l}</label>
              <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1.5px solid #e2e8f0',fontSize:13,outline:'none'}}/></div>
            ))}
            <button onClick={handleSave} disabled={loading} style={{background:'linear-gradient(135deg,#1a3a5c,#2563eb)',color:'#fff',border:'none',borderRadius:11,padding:'13px',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading?<I.Spin/>:'Enregistrer'}
            </button>
          </div>
        ):(
          <div style={{background:'#fff',borderRadius:14,padding:'16px',boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
            {agent.tel&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:32,height:32,background:'#f1f5f9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Phone/></div><span style={{fontSize:13,color:'#1e293b'}}>{agent.tel}</span></div>}
            {agent.email&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:32,height:32,background:'#f1f5f9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Mail/></div><span style={{fontSize:13,color:'#1e293b'}}>{agent.email}</span></div>}
            {[['ID',agent.id],['Contrat',agent.contrat],['Horaire',agent.horaire]].map(([k,v])=>v&&(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}>
                <span style={{color:'#94a3b8'}}>{k}</span><span style={{fontWeight:700,color:'#1e293b'}}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{background:'#fff',borderRadius:14,padding:'16px',textAlign:'center',boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:10}}>Ma carte QR</div>
          <div style={{display:'inline-block',padding:10,background:'#f8fafc',borderRadius:12,border:'1.5px solid #e2e8f0'}}><QRVis value={`EP_${agent.id}_${(agent.nom||'').toUpperCase()}`} size={110}/></div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:8}}>{agent.nom} {agent.prenom} · {agent.id}</div>
        </div>

        <div onClick={onLogout} style={{background:'#fff',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
          <div style={{width:36,height:36,background:'#fee2e2',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center'}}><I.Out/></div>
          <div><div style={{fontSize:12,fontWeight:700,color:'#dc2626'}}>Se déconnecter</div><div style={{fontSize:10,color:'#94a3b8'}}>Retour à la sélection</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function AgentApp() {
  const [step,setStep]=useState('select'); // select|pin|app
  const [selectedAgent,setSelectedAgent]=useState(null);
  const [agent,setAgent]=useState(null);
  const [tab,setTab]=useState('home');
  const [clockStr,setClockStr]=useState('');
  const [historique,setHistorique]=useState([]);
  const [planning,setPlanningData]=useState({});
  const [refreshKey,setRefreshKey]=useState(0);

  useEffect(()=>{
    const tick=()=>{ const d=new Date(); setClockStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`); };
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[]);

  // Restaurer session
  useEffect(()=>{
    const token=getToken(); const data=localStorage.getItem('ep_agent_data');
    if(token&&data) { setAgent(JSON.parse(data)); setStep('app'); }
  },[]);

  // Charger données quand l'agent est connecté
  useEffect(()=>{
    if(!agent||step!=='app') return;
    const today=nowStr();
    const mon=getMon(today);
    const fin=addDays(mon,28);
    Promise.all([
      apiCall('GET','/historique'),
      apiCall('GET',`/planning?date_debut=${addDays(mon,-7)}&date_fin=${fin}`),
    ]).then(([hist,plan])=>{
      setHistorique(hist||[]);
      setPlanningData(plan||{});
    }).catch(()=>{});
  },[agent,step,refreshKey]);

  function handleLogin(ag) { setAgent(ag); setStep('app'); setTab('home'); }
  function handleLogout() { clearToken(); setAgent(null); setSelectedAgent(null); setStep('select'); }
  function handlePointageDone() { setRefreshKey(k=>k+1); }

  const TABS=[
    {id:'home',  label:'Accueil', Icon:I.Home},
    {id:'scan',  label:'Pointer', Icon:I.Scan},
    {id:'plan',  label:'Planning',Icon:I.Cal},
    {id:'profil',label:'Profil',  Icon:I.User},
  ];

  return(
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1a3a5c 50%,#1e4d8c 100%)',padding:'20px',fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{width:390,height:812,borderRadius:48,background:'#1e293b',boxShadow:'0 40px 120px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(255,255,255,0.1)',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
        {/* Status bar */}
        <div style={{height:44,background:step==='app'?'#0f172a':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 22px',flexShrink:0,zIndex:20}}>
          <div style={{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{clockStr}</div>
          <div style={{width:110,height:24,background:'#000',borderRadius:18,position:'absolute',left:'50%',transform:'translateX(-50%)',top:10}}/>
          <div style={{display:'flex',gap:5,alignItems:'center'}}>
            {step==='app'&&<div style={{color:'#22c55e',fontSize:9,fontWeight:700}}>● GPS</div>}
            <div style={{color:'rgba(255,255,255,0.65)',fontSize:12}}>▊▊▊</div>
          </div>
        </div>

        {/* Contenu */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {step==='select'&&<SelectAgent onSelect={ag=>{setSelectedAgent(ag);setStep('pin');}}/>}
          {step==='pin'&&selectedAgent&&<PinScreen agent={selectedAgent} onLogin={handleLogin} onBack={()=>setStep('select')}/>}
          {step==='app'&&agent&&<>
            {tab==='home'&&<HomeScreen agent={agent} historique={historique} planning={planning} clockStr={clockStr} onTabChange={setTab}/>}
            {tab==='scan'&&<ScanScreen agent={agent} onPointageDone={handlePointageDone}/>}
            {tab==='plan'&&<PlanningScreen planning={planning}/>}
            {tab==='profil'&&<ProfilScreen agent={agent} setAgent={setAgent} onLogout={handleLogout}/>}
          </>}
        </div>

        {/* Bottom Nav */}
        {step==='app'&&(
          <div style={{height:68,background:'rgba(10,18,32,0.98)',backdropFilter:'blur(20px)',display:'flex',borderTop:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
            {TABS.map(({id,label,Icon})=>{
              const active=tab===id;
              return(<button key={id} onClick={()=>setTab(id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,border:'none',background:'none',cursor:'pointer',color:active?'#e85d04':'rgba(255,255,255,0.3)',padding:'7px 0',transition:'all 0.15s',position:'relative'}}>
                {active&&<div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:22,height:2.5,background:'#e85d04',borderRadius:'0 0 3px 3px'}}/>}
                <Icon/>
                <span style={{fontSize:9,fontWeight:active?700:500}}>{label}</span>
              </button>);
            })}
          </div>
        )}
        <div style={{height:22,background:'rgba(10,18,32,0.98)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <div style={{width:90,height:3.5,background:'rgba(255,255,255,0.18)',borderRadius:2}}/>
        </div>
      </div>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes pulseBig{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:15px}50%{top:160px}100%{top:15px}}
        @keyframes cornerPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{display:none;}
      `}</style>
    </div>
  );
}
