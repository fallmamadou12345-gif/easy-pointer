import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api.js';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const SHIFTS = [
  { id:'matin',  label:'Matin',       heure:'06:00–14:00', color:'#d97706', bg:'#fef3c7' },
  { id:'jour',   label:'Journée',     heure:'08:00–16:00', color:'#2563eb', bg:'#dbeafe' },
  { id:'apm',    label:'Après-midi',  heure:'10:00–18:00', color:'#7c3aed', bg:'#ede9fe' },
  { id:'soir',   label:'Soir',        heure:'14:00–22:00', color:'#ea580c', bg:'#ffedd5' },
  { id:'repos',  label:'Repos',       heure:'—',           color:'#64748b', bg:'#f1f5f9' },
  { id:'conge',  label:'Congé',       heure:'—',           color:'#059669', bg:'#d1fae5' },
];
const JOURS_SEM = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MOIS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const COULEURS_ZONES = ['#2563eb','#7c3aed','#059669','#e85d04','#dc2626','#0369a1','#d97706','#be123c'];
const C = { bg:'#f0f4f8', card:'#fff', pr:'#1a3a5c', acc:'#e85d04', ok:'#06844b', wa:'#d97706', tx:'#1e293b', sub:'#64748b', bd:'#e2e8f0' };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2,'0');
const nowStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtH = h => { if(h===null||h===undefined)return'—'; const neg=h<0,abs=Math.abs(h),hh=Math.floor(abs),mm=Math.round((abs-hh)*60); return `${neg?'-':''}${pad(hh)}h${pad(mm)}`; };
const getMon = ds => { const d=new Date(ds),day=d.getDay(),diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays = (ds,n) => { const d=new Date(ds); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const shortDate = ds => { const d=new Date(ds); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`; };

// ─── ICÔNES ───────────────────────────────────────────────────────────────────
const Ic = {
  QR:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>,
  Cal:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Users:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chart:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Shield: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Map:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Dl:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Plus:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Check:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:14,height:14}}><polyline points="20 6 9 17 4 12"/></svg>,
  Close:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:15,height:15}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  CL:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:17,height:17}}><polyline points="15 18 9 12 15 6"/></svg>,
  CR:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:17,height:17}}><polyline points="9 18 15 12 9 6"/></svg>,
  Spin:   ()=><div style={{width:18,height:18,border:'2px solid #e2e8f0',borderTopColor:C.pr,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>,
  Logout: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Clock:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Target: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Cam:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:17,height:17}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

// ─── COMPOSANTS UTILITAIRES ───────────────────────────────────────────────────
function Av({ag,size=40}) {
  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];
  const ci=ag.id?.charCodeAt(1)%pal.length||0;
  if(ag.photo_base64) return <img src={ag.photo_base64} alt={ag.nom} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>;
  return <div style={{width:size,height:size,borderRadius:'50%',background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:size*0.34,fontWeight:800,flexShrink:0}}>{(ag.nom||'?').charAt(0)}{(ag.prenom||'').charAt(0)}</div>;
}

function Toast({msg,type,onClose}) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[]);
  const cfg = {ok:{bg:'#ecfdf5',bd:'#6ee7b7',c:'#065f46',ico:'✅'}, err:{bg:'#fef2f2',bd:'#fca5a5',c:'#dc2626',ico:'❌'}, warn:{bg:'#fffbeb',bd:'#fde68a',c:'#92400e',ico:'⚠️'}}[type||'ok'];
  return <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:cfg.bg,border:`1.5px solid ${cfg.bd}`,borderRadius:14,padding:'12px 22px',fontSize:13,fontWeight:700,color:cfg.c,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',zIndex:500,animation:'fadeUp 0.3s ease',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap'}}>{cfg.ico} {msg}</div>;
}

function Loader({text='Chargement…'}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:40,color:C.sub,fontSize:13}}><Ic.Spin/>{text}</div>;
}

function Modal({title,subtitle,onClose,children,maxWidth=560}) {
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth,maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}}>
        <div style={{background:`linear-gradient(135deg,${C.pr},#2563eb)`,borderRadius:'20px 20px 0 0',padding:'20px 22px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            {subtitle&&<div style={{color:'rgba(255,255,255,0.55)',fontSize:10,fontWeight:700,textTransform:'uppercase',marginBottom:3}}>{subtitle}</div>}
            <div style={{color:'#fff',fontWeight:800,fontSize:17}}>{title}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff'}}><Ic.Close/></button>
        </div>
        <div style={{padding:'22px'}}>{children}</div>
      </div>
    </div>
  );
}

function FormField({label,children}) {
  return <div><label style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>{children}</div>;
}

function Input({value,onChange,placeholder,type='text'}) {
  return <input type={type} value={value||''} onChange={onChange} placeholder={placeholder} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.bd}`,fontSize:13,outline:'none',background:'#f8fafc'}}/>;
}

// ─── ÉCRAN LOGIN ──────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [user,setUser]=useState('admin');
  const [pass,setPass]=useState('admin123');
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setErr('');
    try {
      const {token,user:u} = await api.login(user,pass);
      localStorage.setItem('ep_token',token);
      onLogin(u);
    } catch(e) { setErr(e.message); } finally { setLoading(false); }
  }

  return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:`linear-gradient(135deg,#0f172a 0%,${C.pr} 55%,#1e4d8c 100%)`,padding:20}}>
      <div style={{width:'100%',maxWidth:400,background:'rgba(255,255,255,0.06)',backdropFilter:'blur(20px)',borderRadius:24,padding:36,border:'1px solid rgba(255,255,255,0.12)',boxShadow:'0 32px 80px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:60,height:60,background:C.acc,borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#fff',margin:'0 auto 14px',boxShadow:`0 8px 24px rgba(232,93,4,0.5)`}}>EP</div>
          <div style={{color:'#fff',fontWeight:800,fontSize:24}}>Easy Pointer</div>
          <div style={{color:'rgba(255,255,255,0.45)',fontSize:12,marginTop:4,letterSpacing:'0.05em'}}>Gestion des présences · Kéditou v1.0</div>
        </div>
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{color:'rgba(255,255,255,0.6)',fontSize:11,fontWeight:600,display:'block',marginBottom:6}}>IDENTIFIANT</label>
            <input value={user} onChange={e=>setUser(e.target.value)} style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1.5px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.08)',color:'#fff',fontSize:14,outline:'none'}}/>
          </div>
          <div>
            <label style={{color:'rgba(255,255,255,0.6)',fontSize:11,fontWeight:600,display:'block',marginBottom:6}}>MOT DE PASSE</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1.5px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.08)',color:'#fff',fontSize:14,outline:'none'}}/>
          </div>
          {err&&<div style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'9px 13px',fontSize:12,color:'#fca5a5'}}>{err}</div>}
          <button type="submit" disabled={loading} style={{padding:'14px',background:`linear-gradient(135deg,${C.acc},#f97316)`,color:'#fff',border:'none',borderRadius:13,fontSize:15,fontWeight:800,cursor:loading?'wait':'pointer',marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.8:1}}>
            {loading?<><Ic.Spin/>Connexion…</>:'Se connecter'}
          </button>
        </form>
        <div style={{marginTop:20,padding:14,background:'rgba(255,255,255,0.05)',borderRadius:12,border:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{color:'rgba(255,255,255,0.4)',fontSize:10,fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Comptes démo</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.8}}>
            Admin : <b style={{color:'rgba(255,255,255,0.8)'}}>admin / admin123</b><br/>
            Gestionnaire : <b style={{color:'rgba(255,255,255,0.8)'}}>gestionnaire / gest123</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({user}) {
  const [data,setData]=useState(null);
  const [rapport,setRapport]=useState([]);
  const [loading,setLoading]=useState(true);
  const today=nowStr();

  useEffect(()=>{ load(); },[]);

  async function load() {
    setLoading(true);
    try {
      const [t,r] = await Promise.all([api.todayPointages(), api.rapport({period:'mensuel',mois:today.slice(0,7)})]);
      setData(t); setRapport(r);
    } catch(e){} finally{setLoading(false);}
  }

  if(loading) return <Loader/>;
  const presents=data?.pointages?.filter(p=>p.arrivee&&!p.depart)||[];
  const sortis=data?.pointages?.filter(p=>p.depart)||[];
  const absents=data?.absents||[];
  const moisTotalH=rapport.reduce((a,r)=>a+r.totalH,0);
  const moisSupH=rapport.reduce((a,r)=>a+r.supH,0);

  return(
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        {[
          {l:'Présents',v:presents.length,c:C.ok,bg:'#ecfdf5'},
          {l:'Sortis',v:sortis.length,c:'#2563eb',bg:'#eff6ff'},
          {l:'Absents',v:absents.length,c:C.acc,bg:'#fff7ed'},
          {l:'Heures mois',v:fmtH(moisTotalH),c:C.pr,bg:'#f0f4f8'},
        ].map(({l,v,c,bg})=>(
          <div key={l} style={{background:bg,borderRadius:16,padding:'18px 20px',border:`1px solid ${C.bd}`}}>
            <div style={{fontSize:30,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{background:C.card,borderRadius:16,padding:22,boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16,display:'flex',alignItems:'center',gap:8}}><Ic.Clock/>Activité du jour · {today}</div>
        {(!data?.pointages?.length&&!absents.length)&&<div style={{color:C.sub,textAlign:'center',padding:20}}>Aucun pointage aujourd'hui</div>}
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f8fafc'}}>{['Agent','Arrivée','Départ','Durée','Zone','Statut'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:C.sub,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>
            {data?.pointages?.map(p=>{
              const dur=p.arrivee&&p.depart?((parseInt(p.depart)-parseInt(p.arrivee))/3600):null;
              const badge=!p.depart?['#d1fae5','#065f46','En cours']:['#dbeafe','#1e40af','✓ Complet'];
              return(<tr key={p.id} style={{borderBottom:`1px solid ${C.bd}`}}>
                <td style={{padding:'10px 12px'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Av ag={{id:p.agent_id,nom:p.nom,prenom:p.prenom}} size={26}/><span style={{fontWeight:600}}>{p.nom}</span></div></td>
                <td style={{padding:'10px 12px',color:C.sub}}>{p.arrivee?.slice(0,5)||'—'}</td>
                <td style={{padding:'10px 12px',color:C.sub}}>{p.depart?.slice(0,5)||'—'}</td>
                <td style={{padding:'10px 12px',fontWeight:700,color:C.ok}}>{p.arrivee&&p.depart?`${Math.floor((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))/3600000)}h${pad(Math.round(((new Date(`2000-01-01T${p.depart}`)-new Date(`2000-01-01T${p.arrivee}`))%3600000)/60000))}m`:'—'}</td>
                <td style={{padding:'10px 12px',fontSize:11,color:C.sub}}>{p.zone_nom||'—'}</td>
                <td style={{padding:'10px 12px'}}><span style={{background:badge[0],color:badge[1],padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{badge[2]}</span></td>
              </tr>);
            })}
            {absents.map(a=>(
              <tr key={a.id} style={{borderBottom:`1px solid ${C.bd}`,opacity:0.6}}>
                <td style={{padding:'10px 12px'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Av ag={{id:a.id,nom:a.nom,prenom:a.prenom}} size={26}/><span style={{fontWeight:600}}>{a.nom}</span></div></td>
                <td colSpan={4} style={{padding:'10px 12px',color:C.sub,fontSize:12}}>Pas encore pointé</td>
                <td style={{padding:'10px 12px'}}><span style={{background:'#fee2e2',color:'#991b1b',padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>Absent</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AGENTS ───────────────────────────────────────────────────────────────────
function Agents({toast}) {
  const [agents,setAgents]=useState([]);
  const [zones,setZones]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null); // null | {mode:'new'|'edit', agent?}
  const [form,setForm]=useState({});

  useEffect(()=>{ load(); },[]);

  async function load() {
    setLoading(true);
    try { const [a,z]=await Promise.all([api.agents(),api.zones()]); setAgents(a); setZones(z); }
    catch(e){} finally{setLoading(false);}
  }

  function openNew() { setForm({contrat:'CDI',horaire:'08:00-16:00',role:'Agent',actif:1,zones:[]}); setModal({mode:'new'}); }
  function openEdit(ag) { setForm({...ag,zones:ag.zones||[]}); setModal({mode:'edit',agent:ag}); }

  async function handleSave() {
    try {
      if(modal.mode==='new') await api.createAgent(form);
      else await api.updateAgent(form.id, form);
      toast(modal.mode==='new'?'Agent créé':'Agent mis à jour');
      setModal(null); load();
    } catch(e){ toast(e.message,'err'); }
  }

  async function handleDelete(id) {
    if(!confirm('Supprimer cet agent ?')) return;
    try { await api.deleteAgent(id); toast('Agent supprimé','warn'); load(); }
    catch(e){ toast(e.message,'err'); }
  }

  function handlePhoto(e) {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>setForm(p=>({...p,photo_base64:ev.target.result})); r.readAsDataURL(f);
  }

  if(loading) return <Loader/>;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:800,fontSize:17}}>Agents · <span style={{color:C.acc}}>{agents.length}</span></div>
        <button onClick={openNew} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',background:C.pr,color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700}}><Ic.Plus/>Nouvel agent</button>
      </div>
      <div style={{background:C.card,borderRadius:16,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f8fafc'}}>{['Agent','Poste','Contrat','Zones','Statut','Actions'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontWeight:700,color:C.sub,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>
            {agents.map(ag=>{
              const agZones=zones.filter(z=>(ag.zones||[]).includes(z.id));
              return(<tr key={ag.id} style={{borderBottom:`1px solid ${C.bd}`}}>
                <td style={{padding:'12px 16px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><Av ag={ag} size={36}/><div><div style={{fontWeight:700}}>{ag.nom} {ag.prenom}</div><div style={{fontSize:11,color:C.sub}}>{ag.id}</div></div></div></td>
                <td style={{padding:'12px 16px',color:C.sub}}>{ag.poste}</td>
                <td style={{padding:'12px 16px'}}><span style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{ag.contrat}</span></td>
                <td style={{padding:'12px 16px'}}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{agZones.map(z=><span key={z.id} style={{background:`${z.couleur}15`,color:z.couleur,border:`1px solid ${z.couleur}30`,padding:'2px 7px',borderRadius:20,fontSize:10,fontWeight:700}}>{z.nom.split(' ')[0]}</span>)}{!agZones.length&&<span style={{color:'#f59e0b',fontSize:11}}>⚠️ Aucune</span>}</div></td>
                <td style={{padding:'12px 16px'}}><span style={{background:ag.actif?'#ecfdf5':'#f1f5f9',color:ag.actif?C.ok:C.sub,padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{ag.actif?'Actif':'Inactif'}</span></td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>openEdit(ag)} style={{padding:'6px 10px',background:'#f1f5f9',border:'none',borderRadius:8,fontSize:11,fontWeight:600,color:C.sub,display:'flex',gap:4,alignItems:'center'}}><Ic.Edit/>Modifier</button>
                    <button onClick={()=>handleDelete(ag.id)} style={{padding:'6px 8px',background:'#fff5f5',border:'none',borderRadius:8,color:'#ef4444',display:'flex',alignItems:'center'}}><Ic.Trash/></button>
                  </div>
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>

      {modal&&(
        <Modal title={modal.mode==='new'?'Nouvel agent':'Modifier l\'agent'} subtitle="AGENTS" onClose={()=>setModal(null)}>
          {/* Photo */}
          <div style={{display:'flex',alignItems:'center',gap:16,padding:16,background:'#f8fafc',borderRadius:12,marginBottom:18}}>
            <div style={{position:'relative'}}>
              <Av ag={{...form,id:form.id||'X'}} size={72}/>
              <label htmlFor="ag-photo" style={{position:'absolute',bottom:0,right:0,background:C.acc,borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid #fff'}}><Ic.Cam/><input id="ag-photo" type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto}/></label>
            </div>
            <div><div style={{fontWeight:700,fontSize:15}}>{form.nom||'Nouveau'} {form.prenom||''}</div><div style={{fontSize:12,color:C.sub}}>Cliquer sur 📷 pour ajouter une photo</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
            {[['Nom *','nom'],['Prénom','prenom'],['Poste','poste'],['Téléphone','tel'],['Email','email'],['Date embauche','date_embauche']].map(([l,k])=>(
              <FormField key={k} label={l}><Input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/></FormField>
            ))}
            <FormField label="Rôle"><select value={form.role||'Agent'} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.bd}`,fontSize:13,outline:'none',background:'#fff'}}>
              {['Agent','Superviseur','Superviseure','Manager'].map(r=><option key={r}>{r}</option>)}
            </select></FormField>
            <FormField label="Contrat"><select value={form.contrat||'CDI'} onChange={e=>setForm(p=>({...p,contrat:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.bd}`,fontSize:13,outline:'none',background:'#fff'}}>
              {['CDI','CDD','Stage','Freelance'].map(c=><option key={c}>{c}</option>)}
            </select></FormField>
            <FormField label="Horaire"><Input value={form.horaire} onChange={e=>setForm(p=>({...p,horaire:e.target.value}))} placeholder="08:00-16:00"/></FormField>
            <FormField label="Statut"><div onClick={()=>setForm(p=>({...p,actif:p.actif?0:1}))} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:form.actif?'#ecfdf5':'#f8fafc',border:`1.5px solid ${form.actif?'#6ee7b7':C.bd}`,borderRadius:10,cursor:'pointer',userSelect:'none'}}>
              <div style={{width:36,height:20,borderRadius:10,background:form.actif?C.ok:'#e2e8f0',position:'relative',transition:'all 0.2s'}}>
                <div style={{position:'absolute',top:2,left:form.actif?18:2,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'all 0.2s'}}/>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:form.actif?C.ok:C.sub}}>{form.actif?'Actif':'Inactif'}</span>
            </div></FormField>
          </div>
          {/* Zones */}
          <FormField label="Zones autorisées">
            <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:10,background:'#f8fafc',borderRadius:10,border:`1.5px solid ${C.bd}`}}>
              {zones.map(z=>{
                const sel=(form.zones||[]).includes(z.id);
                return(<div key={z.id} onClick={()=>setForm(p=>({...p,zones:sel?(p.zones||[]).filter(x=>x!==z.id):[...(p.zones||[]),z.id],zone_defaut:sel&&p.zone_defaut===z.id?'':(p.zones||[]).length===0?z.id:p.zone_defaut}))}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,cursor:'pointer',background:sel?`${z.couleur}15`:'#fff',border:`1.5px solid ${sel?z.couleur:C.bd}`,fontSize:12,fontWeight:700,color:sel?z.couleur:C.sub}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:z.couleur}}/>{z.nom}
                </div>);
              })}
            </div>
          </FormField>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button onClick={()=>setModal(null)} style={{flex:1,padding:11,background:'#f1f5f9',border:'none',borderRadius:11,fontSize:13,fontWeight:600,cursor:'pointer',color:C.sub}}>Annuler</button>
            <button onClick={handleSave} style={{flex:2,padding:11,background:`linear-gradient(135deg,${C.pr},#2563eb)`,color:'#fff',border:'none',borderRadius:11,fontSize:14,fontWeight:800,cursor:'pointer'}}>Enregistrer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ZONES ────────────────────────────────────────────────────────────────────
function Zones({toast}) {
  const [zones,setZones]=useState([]);
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [assignModal,setAssignModal]=useState(null);

  useEffect(()=>{ load(); },[]);
  async function load() {
    setLoading(true);
    try { const [z,a]=await Promise.all([api.zones(),api.agents()]); setZones(z); setAgents(a); }
    catch(e){} finally{setLoading(false);}
  }

  async function handleSave() {
    try {
      if(modal.mode==='new') await api.createZone(form);
      else await api.updateZone(form.id,form);
      toast(modal.mode==='new'?'Zone créée':'Zone mise à jour');
      setModal(null); load();
    } catch(e){ toast(e.message,'err'); }
  }

  async function handleDelete(id) {
    if(!confirm('Supprimer cette zone ?')) return;
    try { await api.deleteZone(id); toast('Zone supprimée','warn'); load(); }
    catch(e){ toast(e.message,'err'); }
  }

  async function handleToggle(id) {
    try { await api.toggleZone(id); load(); }
    catch(e){ toast(e.message,'err'); }
  }

  async function handleAssign(zone, agentUpdates) {
    // Mettre à jour chaque agent
    try {
      await Promise.all(agentUpdates.map(({agentId, zones, zone_defaut}) =>
        api.updateAgent(agentId, {zones, zone_defaut})
      ));
      toast('Assignations mises à jour');
      setAssignModal(null); load();
    } catch(e){ toast(e.message,'err'); }
  }

  if(loading) return <Loader/>;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:800,fontSize:17}}>Zones de pointage · <span style={{color:C.acc}}>{zones.length}</span></div>
        <button onClick={()=>{setForm({rayon:150,couleur:'#2563eb',actif:1,ville:'Dakar'});setModal({mode:'new'});}} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 18px',background:C.pr,color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700}}><Ic.Plus/>Nouvelle zone</button>
      </div>

      <div style={{background:C.card,borderRadius:16,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f8fafc'}}>{['Zone','Adresse','Rayon GPS','Agents','Statut','Actions'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontWeight:700,color:C.sub,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
          <tbody>
            {zones.map(z=>(
              <tr key={z.id} style={{borderBottom:`1px solid ${C.bd}`}}>
                <td style={{padding:'12px 16px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:14,height:14,borderRadius:'50%',background:z.couleur,boxShadow:`0 0 0 3px ${z.couleur}25`}}/><div><div style={{fontWeight:700}}>{z.nom}</div><div style={{fontSize:11,color:C.sub}}>{z.id} · {z.ville}</div></div></div></td>
                <td style={{padding:'12px 16px',color:C.sub,fontSize:12}}>{z.adresse}</td>
                <td style={{padding:'12px 16px'}}><div style={{display:'flex',alignItems:'center',gap:5}}><Ic.Target/><span style={{fontWeight:700,color:z.couleur}}>±{z.rayon}m</span></div></td>
                <td style={{padding:'12px 16px'}}><span style={{fontWeight:700}}>{z.agentCount||0}</span> agent{z.agentCount>1?'s':''}</td>
                <td style={{padding:'12px 16px'}}>
                  <div onClick={()=>handleToggle(z.id)} style={{display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer',background:z.actif?'#ecfdf5':'#f1f5f9',border:`1px solid ${z.actif?'#6ee7b7':C.bd}`,borderRadius:20,padding:'3px 10px',userSelect:'none'}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:z.actif?'#22c55e':'#94a3b8'}}/><span style={{fontSize:10,fontWeight:700,color:z.actif?'#16a34a':'#94a3b8'}}>{z.actif?'Active':'Inactive'}</span>
                  </div>
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{setForm({...z});setModal({mode:'edit'});}} style={{padding:'6px 10px',background:'#f1f5f9',border:'none',borderRadius:8,fontSize:11,fontWeight:600,color:C.sub,display:'flex',gap:4,alignItems:'center'}}><Ic.Edit/>Modifier</button>
                    <button onClick={()=>setAssignModal(z)} style={{padding:'6px 10px',background:'#eff6ff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,color:'#2563eb',display:'flex',gap:4,alignItems:'center'}}><Ic.Users/>Agents</button>
                    <button onClick={()=>handleDelete(z.id)} style={{padding:'6px 8px',background:'#fff5f5',border:'none',borderRadius:8,color:'#ef4444',display:'flex',alignItems:'center'}}><Ic.Trash/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal&&(
        <Modal title={modal.mode==='new'?'Nouvelle zone':'Modifier la zone'} subtitle="ZONES GPS" onClose={()=>setModal(null)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}><FormField label="Nom de la zone *"><Input value={form.nom} onChange={e=>setForm(p=>({...p,nom:e.target.value}))} placeholder="Bureau Principal…"/></FormField></div>
            <FormField label="Ville"><select value={form.ville||'Dakar'} onChange={e=>setForm(p=>({...p,ville:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.bd}`,fontSize:13,outline:'none',background:'#fff'}}>{['Dakar','Thiès','Mbour','Saint-Louis','Ziguinchor','Kaolack','Touba','Tambacounda','Rufisque','Saly'].map(v=><option key={v}>{v}</option>)}</select></FormField>
            <FormField label="Adresse"><Input value={form.adresse} onChange={e=>setForm(p=>({...p,adresse:e.target.value}))} placeholder="Quartier, rue…"/></FormField>
            <FormField label="Latitude *"><Input value={form.lat} onChange={e=>setForm(p=>({...p,lat:e.target.value}))} placeholder="14.7298"/></FormField>
            <FormField label="Longitude *"><Input value={form.lon} onChange={e=>setForm(p=>({...p,lon:e.target.value}))} placeholder="-17.4973"/></FormField>
          </div>
          <FormField label={`Rayon GPS : ${form.rayon||150}m`}>
            <input type="range" min="50" max="1000" step="25" value={form.rayon||150} onChange={e=>setForm(p=>({...p,rayon:parseInt(e.target.value)}))} style={{width:'100%',accentColor:C.acc,marginBottom:8}}/>
            <div style={{display:'flex',gap:8'}}>
              {[75,150,300,500].map(v=><button key={v} onClick={()=>setForm(p=>({...p,rayon:v}))} style={{flex:1,padding:'6px',background:form.rayon===v?C.pr:'#f8fafc',color:form.rayon===v?'#fff':C.sub,border:`1px solid ${form.rayon===v?C.pr:C.bd}`,borderRadius:8,fontSize:10,fontWeight:700,cursor:'pointer'}}>{v}m</button>)}
            </div>
          </FormField>
          <div style={{marginTop:14,display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontWeight:700,fontSize:11,color:C.sub,textTransform:'uppercase'}}>Couleur :</div>
            {COULEURS_ZONES.map(c=><div key={c} onClick={()=>setForm(p=>({...p,couleur:c}))} style={{width:26,height:26,borderRadius:'50%',background:c,cursor:'pointer',border:form.couleur===c?'3px solid #1e293b':'3px solid transparent',transform:form.couleur===c?'scale(1.2)':'scale(1)',transition:'all 0.15s'}}/>)}
          </div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button onClick={()=>setModal(null)} style={{flex:1,padding:11,background:'#f1f5f9',border:'none',borderRadius:11,fontSize:13,fontWeight:600,cursor:'pointer',color:C.sub}}>Annuler</button>
            <button onClick={handleSave} style={{flex:2,padding:11,background:`linear-gradient(135deg,${C.pr},#2563eb)`,color:'#fff',border:'none',borderRadius:11,fontSize:14,fontWeight:800,cursor:'pointer'}}>Enregistrer</button>
          </div>
        </Modal>
      )}

      {assignModal&&(
        <AssignZoneModal zone={assignModal} agents={agents} onSave={handleAssign} onClose={()=>setAssignModal(null)}/>
      )}
    </div>
  );
}

function AssignZoneModal({zone,agents,onSave,onClose}) {
  const [local,setLocal]=useState(agents.map(a=>({...a,inZone:(a.zones||[]).includes(zone.id),isDefault:a.zone_defaut===zone.id})));
  const pal=['#1a3a5c','#e85d04','#06844b','#7c3aed','#0369a1','#be123c'];

  function handleSave() {
    const updates=local.map(a=>({
      agentId:a.id,
      zones:a.inZone?[...(a.zones||[]).filter(z=>z!==zone.id),zone.id]:(a.zones||[]).filter(z=>z!==zone.id),
      zone_defaut:a.isDefault&&a.inZone?zone.id:a.zone_defaut,
    }));
    onSave(zone, updates);
  }

  return(
    <Modal title={`Agents — ${zone.nom}`} subtitle="ASSIGNATION" onClose={onClose} maxWidth={480}>
      <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:'10px 13px',fontSize:12,color:'#0369a1',marginBottom:16}}>
        Activez le toggle pour autoriser un agent à pointer dans cette zone. ⭐ = zone par défaut.
      </div>
      {local.map((ag,i)=>{
        const ci=ag.id.charCodeAt(1)%pal.length;
        return(<div key={ag.id} style={{background:ag.inZone?'#f0fdf4':'#f8fafc',border:`1.5px solid ${ag.inZone?'#6ee7b7':C.bd}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,marginBottom:8,transition:'all 0.15s'}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:pal[ci],display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:800,flexShrink:0}}>{ag.nom.charAt(0)}{ag.prenom.charAt(0)}</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{ag.nom} {ag.prenom}</div><div style={{fontSize:11,color:C.sub}}>{ag.poste}</div></div>
          {ag.inZone&&<button onClick={()=>setLocal(p=>p.map(x=>({...x,isDefault:x.id===ag.id})))} style={{padding:'4px 8px',background:ag.isDefault?'#fef9c3':'#f1f5f9',border:`1px solid ${ag.isDefault?'#fde68a':C.bd}`,borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700,color:ag.isDefault?'#d97706':C.sub}}>★</button>}
          <div onClick={()=>setLocal(p=>p.map(x=>x.id===ag.id?{...x,inZone:!x.inZone}:x))} style={{width:44,height:24,borderRadius:12,background:ag.inZone?zone.couleur:'#e2e8f0',cursor:'pointer',position:'relative',transition:'all 0.2s',flexShrink:0}}>
            <div style={{position:'absolute',top:3,left:ag.inZone?22:3,width:18,height:18,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.2)',transition:'all 0.2s'}}/>
          </div>
        </div>);
      })}
      <div style={{display:'flex',gap:10,marginTop:16}}>
        <button onClick={onClose} style={{flex:1,padding:11,background:'#f1f5f9',border:'none',borderRadius:11,fontSize:13,fontWeight:600,cursor:'pointer',color:C.sub}}>Annuler</button>
        <button onClick={handleSave} style={{flex:2,padding:11,background:`linear-gradient(135deg,${zone.couleur},${zone.couleur}cc)`,color:'#fff',border:'none',borderRadius:11,fontSize:14,fontWeight:800,cursor:'pointer'}}>Enregistrer</button>
      </div>
    </Modal>
  );
}

// ─── POINTAGE MANUEL ──────────────────────────────────────────────────────────
function Pointage({toast}) {
  const [agents,setAgents]=useState([]);
  const [today,setToday]=useState(null);
  const [selected,setSelected]=useState(null);
  const [scanning,setScanning]=useState(false);
  const [result,setResult]=useState(null);
  const [editModal,setEditModal]=useState(null);
  const [editForm,setEditForm]=useState({});

  useEffect(()=>{ load(); },[]);
  async function load() {
    try { const [a,t]=await Promise.all([api.agents(),api.todayPointages()]); setAgents(a); setToday(t); }
    catch(e){}
  }

  async function handleScan(agentId) {
    setScanning(agentId);
    try {
      const res = await api.scan({agent_id:agentId});
      setResult({...res, agentId});
      toast(res.action==='arrivee'?`✅ Arrivée — ${res.agent.nom}`:res.action==='depart'?`🏁 Départ — ${res.agent.nom}`:'Déjà pointé aujourd\'hui');
      load();
    } catch(e){ toast(e.message,'err'); } finally { setScanning(null); }
  }

  async function handleSaveEdit() {
    try { await api.updatePointage(editModal.id,editForm); toast('Pointage corrigé'); setEditModal(null); load(); }
    catch(e){ toast(e.message,'err'); }
  }

  const todayPts = today?.pointages||[];
  const absents = today?.absents||[];

  return(
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      {/* QR Bureau */}
      <div style={{background:C.card,borderRadius:16,padding:26,boxShadow:'0 1px 10px rgba(0,0,0,0.07)',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
        <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'0.08em'}}>QR Code Bureau — Terminal Fixe</div>
        <div style={{padding:14,background:'#f8fafc',borderRadius:14,border:`2px solid ${C.bd}`}}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{display:'block'}}>
            <rect width="160" height="160" fill="white" rx="8"/>
            {/* QR simplifié */}
            {Array.from({length:21},(_, r)=>Array.from({length:21},(_,c)=>{
              const h=(v)=>{let x=0;for(let i=0;i<v.length;i++)x=(x*31+v.charCodeAt(i))%997;return x;};
              const cell=160/21;
              const finder=(r<7&&c<7)||(r<7&&c>=14)||(r>=14&&c<7);
              const timing=(r===6||c===6)&&(r+c)%2===0;
              const data=!finder&&!timing&&(h('EASY_POINTER_BUREAU_DAKAR_2026'+r*100+c)%3!==0);
              if(finder||timing||data) return <rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill="#0f172a"/>;
              return null;
            }))}
          </svg>
        </div>
        <div style={{fontSize:11,color:C.sub,textAlign:'center'}}>Agents scannent ce code depuis l'app mobile</div>
        <div style={{width:'100%',background:'#f0f9ff',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#0369a1',lineHeight:1.5}}>
          💡 En simulation : cliquez sur un agent à droite pour enregistrer son passage.
        </div>
      </div>

      {/* Liste agents */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {result&&(
          <div style={{background:result.action==='arrivee'?'#ecfdf5':'#eff6ff',border:`1.5px solid ${result.action==='arrivee'?'#6ee7b7':'#93c5fd'}`,borderRadius:12,padding:'13px 17px',animation:'fadeIn 0.3s'}}>
            <div style={{fontWeight:700,fontSize:14,color:result.action==='arrivee'?'#065f46':'#1e40af'}}>{result.action==='arrivee'?'✅ Arrivée enregistrée':'🏁 Départ enregistré'}</div>
            <div style={{fontSize:12,color:C.sub,marginTop:3}}>{result.agent?.nom} · {result.pointage?.arrivee?.slice(0,5)}</div>
          </div>
        )}
        <div style={{background:C.card,borderRadius:16,padding:18,boxShadow:'0 1px 8px rgba(0,0,0,0.07)',flex:1,overflow:'auto'}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:12}}>Agents · {nowStr()}</div>
          {agents.map(ag=>{
            const tp=todayPts.find(p=>p.agent_id===ag.id);
            const status=!tp?'absent':!tp.depart?'present':'done';
            return(<div key={ag.id} onClick={()=>!scanning&&handleScan(ag.id)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderRadius:10,cursor:scanning?'wait':'pointer',background:status==='present'?'#ecfdf5':'#fff',border:`1px solid ${status==='present'?'#bbf7d0':C.bd}`,marginBottom:7,transition:'all 0.1s'}}>
              <div style={{display:'flex',alignItems:'center',gap:9}}>
                {scanning===ag.id?<Ic.Spin/>:<Av ag={ag} size={30}/>}
                <div><div style={{fontWeight:600,fontSize:13}}>{ag.nom}</div><div style={{fontSize:10,color:C.sub}}>{ag.poste}</div></div>
              </div>
              <div style={{textAlign:'right',fontSize:11,color:C.sub}}>
                {tp?<><div>↑ {tp.arrivee?.slice(0,5)}</div>{tp.depart&&<div>↓ {tp.depart?.slice(0,5)}</div>}</>:<span style={{background:'#fee2e2',color:'#991b1b',padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600}}>Absent</span>}
              </div>
            </div>);
          })}
        </div>
        {/* Corrections manuelles */}
        {todayPts.length>0&&(
          <div style={{background:C.card,borderRadius:14,padding:14,boxShadow:'0 1px 6px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:8}}>Corrections manuelles</div>
            {todayPts.map(p=>(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${C.bd}`}}>
                <span style={{fontSize:12,fontWeight:600}}>{p.nom}</span>
                <div style={{display:'flex',gap:4,alignItems:'center',fontSize:11,color:C.sub}}>
                  <span>{p.arrivee?.slice(0,5)} → {p.depart?.slice(0,5)||'?'}</span>
                  <button onClick={()=>{setEditModal(p);setEditForm({arrivee:p.arrivee?.slice(0,5),depart:p.depart?.slice(0,5)||'',note:p.note||''});}} style={{padding:'3px 8px',background:'#f1f5f9',border:'none',borderRadius:7,fontSize:10,fontWeight:600,cursor:'pointer',color:C.sub,display:'flex',gap:3,alignItems:'center'}}><Ic.Edit/>Corriger</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editModal&&(
        <Modal title={`Corriger — ${editModal.nom}`} subtitle="POINTAGE MANUEL" onClose={()=>setEditModal(null)} maxWidth={400}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <FormField label="Heure d'arrivée"><Input type="time" value={editForm.arrivee} onChange={e=>setEditForm(p=>({...p,arrivee:e.target.value+':00'}))}/></FormField>
            <FormField label="Heure de départ"><Input type="time" value={editForm.depart?.slice(0,5)} onChange={e=>setEditForm(p=>({...p,depart:e.target.value+':00'}))}/></FormField>
            <FormField label="Note / motif"><Input value={editForm.note} onChange={e=>setEditForm(p=>({...p,note:e.target.value}))} placeholder="Ex: Oubli de pointage…"/></FormField>
            <div style={{display:'flex',gap:10,marginTop:6}}>
              <button onClick={()=>setEditModal(null)} style={{flex:1,padding:11,background:'#f1f5f9',border:'none',borderRadius:11,fontSize:13,fontWeight:600,cursor:'pointer',color:C.sub}}>Annuler</button>
              <button onClick={handleSaveEdit} style={{flex:2,padding:11,background:`linear-gradient(135deg,${C.pr},#2563eb)`,color:'#fff',border:'none',borderRadius:11,fontSize:14,fontWeight:800,cursor:'pointer'}}>Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PLANNING ─────────────────────────────────────────────────────────────────
function Planning({toast}) {
  const [agents,setAgents]=useState([]);
  const [planData,setPlanData]=useState({});
  const [weekOff,setWeekOff]=useState(0);
  const [loading,setLoading]=useState(true);
  const [shiftModal,setShiftModal]=useState(null);

  const mon=addDays(getMon(nowStr()),weekOff*7);
  const weekDates=Array.from({length:7},(_,i)=>addDays(mon,i));

  useEffect(()=>{ loadAll(); },[weekOff]);

  async function loadAll() {
    setLoading(true);
    try {
      const [a,p]=await Promise.all([api.agents(),api.planning({date_debut:mon,date_fin:weekDates[6]})]);
      setAgents(a);
      const map={};
      p.forEach(x=>{ map[`${x.agent_id}-${x.date}`]=x.shift_id; });
      setPlanData(map);
    } catch(e){} finally{setLoading(false);}
  }

  async function handleShift(agentId,date,shiftId) {
    try {
      await api.setShift({agent_id:agentId,date,shift_id:shiftId});
      setPlanData(p=>({...p,[`${agentId}-${date}`]:shiftId}));
      setShiftModal(null);
    } catch(e){ toast(e.message,'err'); }
  }

  if(loading) return <Loader/>;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Nav semaine */}
      <div style={{background:C.card,borderRadius:14,padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 1px 6px rgba(0,0,0,0.06)'}}>
        <button onClick={()=>setWeekOff(p=>p-1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'7px 12px',cursor:'pointer',display:'flex',gap:4,alignItems:'center',fontSize:12,fontWeight:600}}><Ic.CL/>Précédente</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:15}}>Semaine du {shortDate(mon)} au {shortDate(addDays(mon,6))}</div>
          <div style={{fontSize:11,color:C.sub}}>{weekOff===0?'Semaine en cours':weekOff>0?`+${weekOff} sem.`:`${weekOff} sem.`}</div>
        </div>
        <div style={{display:'flex',gap:7}}>
          {weekOff!==0&&<button onClick={()=>setWeekOff(0)} style={{background:C.acc,color:'#fff',border:'none',borderRadius:8,padding:'7px 12px',cursor:'pointer',fontSize:11,fontWeight:700}}>Auj.</button>}
          <button onClick={()=>setWeekOff(p=>p+1)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'7px 12px',cursor:'pointer',display:'flex',gap:4,alignItems:'center',fontSize:12,fontWeight:600}}>Suivante<Ic.CR/></button>
        </div>
      </div>
      {/* Légende */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {SHIFTS.map(s=><div key={s.id} style={{display:'flex',alignItems:'center',gap:4,background:s.bg,border:`1px solid ${s.color}40`,borderRadius:20,padding:'3px 10px',fontSize:10,fontWeight:700,color:s.color}}><div style={{width:5,height:5,borderRadius:'50%',background:s.color}}/>{s.label}{s.heure!=='—'?` · ${s.heure}`:''}</div>)}
      </div>
      {/* Grille */}
      <div style={{background:C.card,borderRadius:16,overflow:'auto',boxShadow:'0 1px 10px rgba(0,0,0,0.07)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
          <thead>
            <tr style={{background:C.pr}}>
              <th style={{padding:'13px 16px',textAlign:'left',color:'rgba(255,255,255,0.6)',fontSize:10,fontWeight:700,width:160}}>AGENT</th>
              {weekDates.map((d,i)=>{
                const isT=d===nowStr();
                return <th key={d} style={{padding:'13px 8px',textAlign:'center',color:isT?'#fbbf24':'rgba(255,255,255,0.82)',fontSize:10,fontWeight:700,background:isT?'rgba(255,255,255,0.09)':'transparent',minWidth:90}}><div>{JOURS_SEM[i]}</div><div style={{fontSize:12,fontWeight:isT?800:600,marginTop:2}}>{shortDate(d)}</div></th>;
              })}
            </tr>
          </thead>
          <tbody>
            {agents.map((ag,idx)=>(
              <tr key={ag.id} style={{background:idx%2===0?'#fff':'#f9fafb',borderBottom:`1px solid ${C.bd}`}}>
                <td style={{padding:'9px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><Av ag={ag} size={28}/><div><div style={{fontWeight:700,fontSize:12}}>{ag.nom}</div><div style={{fontSize:10,color:C.sub}}>{ag.poste}</div></div></div>
                </td>
                {weekDates.map(d=>{
                  const sid=planData[`${ag.id}-${d}`]||'repos';
                  const s=SHIFTS.find(x=>x.id===sid)||SHIFTS[4];
                  const isT=d===nowStr();
                  return <td key={d} style={{padding:'7px 5px',textAlign:'center',background:isT?'#fefce8':'transparent'}}><div onClick={()=>setShiftModal({agentId:ag.id,agentNom:ag.nom,date:d,current:sid})} style={{background:s.bg,color:s.color,borderRadius:7,padding:'5px 3px',fontSize:9,fontWeight:700,cursor:'pointer',border:`1px solid ${s.color}25`,userSelect:'none'}}>{s.label}</div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shiftModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setShiftModal(null)}>
          <div style={{background:'#fff',borderRadius:20,padding:22,width:320,boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>Modifier le shift</div>
            <div style={{color:C.sub,fontSize:12,marginBottom:16}}>{shiftModal.agentNom} · {shortDate(shiftModal.date)}</div>
            {SHIFTS.map(s=>{
              const cur=shiftModal.current===s.id;
              return <div key={s.id} onClick={()=>handleShift(shiftModal.agentId,shiftModal.date,s.id)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 13px',borderRadius:11,cursor:'pointer',background:cur?s.bg:'#f8fafc',border:`1.5px solid ${cur?s.color:C.bd}`,marginBottom:7}}>
                <div><div style={{fontWeight:700,fontSize:13,color:s.color}}>{s.label}</div>{s.heure!=='—'&&<div style={{fontSize:10,color:C.sub}}>{s.heure}</div>}</div>
                {cur&&<div style={{width:18,height:18,borderRadius:'50%',background:s.color,display:'flex',alignItems:'center',justifyContent:'center'}}><Ic.Check/></div>}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RAPPORTS ─────────────────────────────────────────────────────────────────
function Rapports({toast}) {
  const [data,setData]=useState([]);
  const [period,setPeriod]=useState('mensuel');
  const [filter,setFilter]=useState('all');
  const [mois,setMois]=useState(nowStr().slice(0,7));
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{ api.agents().then(setAgents).catch(()=>{}); },[]);
  useEffect(()=>{ loadRapport(); },[period,mois,filter]);

  async function loadRapport() {
    setLoading(true);
    try { const r=await api.rapport({period,mois,agent_id:filter!=='all'?filter:undefined}); setData(r); }
    catch(e){} finally{setLoading(false);}
  }

  const totH=data.reduce((a,r)=>a+r.totalH,0);
  const totSup=data.reduce((a,r)=>a+r.supH,0);
  const totDef=data.reduce((a,r)=>a+r.defH,0);

  return(
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{background:C.card,borderRadius:14,padding:'14px 18px',display:'flex',gap:14,alignItems:'center',flexWrap:'wrap',boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:5}}>Période</div>
          <div style={{display:'flex',gap:5}}>
            {['mensuel','annuel'].map(p=><button key={p} onClick={()=>setPeriod(p)} style={{padding:'6px 13px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',background:period===p?C.pr:'#f1f5f9',color:period===p?'#fff':C.sub,border:'none',textTransform:'capitalize'}}>{p}</button>)}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:5}}>Mois</div>
          <input type="month" value={mois} onChange={e=>setMois(e.target.value)} style={{padding:'7px 11px',borderRadius:8,border:`1.5px solid ${C.bd}`,fontSize:12,outline:'none'}}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',marginBottom:5}}>Agent</div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'7px 11px',borderRadius:8,border:`1.5px solid ${C.bd}`,fontSize:12,background:'#fff',outline:'none'}}>
            <option value="all">Tous les agents</option>
            {agents.map(a=><option key={a.id} value={a.id}>{a.nom} {a.prenom}</option>)}
          </select>
        </div>
        <a href={api.exportCSV(mois)} download style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:C.acc,color:'#fff',borderRadius:9,fontSize:12,fontWeight:700,textDecoration:'none'}}>
          <Ic.Dl/>Exporter CSV
        </a>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:13}}>
        {[{l:'Total heures',v:fmtH(totH),c:C.pr},{l:'Heures sup',v:`+${fmtH(totSup)}`,c:C.ok},{l:'Déficit total',v:fmtH(totDef),c:C.acc}].map(({l,v,c})=>(
          <div key={l} style={{background:C.card,borderRadius:13,padding:'16px 18px',border:`1px solid ${C.bd}`,boxShadow:'0 1px 6px rgba(0,0,0,0.05)'}}>
            <div style={{fontSize:26,fontWeight:800,color:c}}>{v}</div>
            <div style={{fontSize:11,color:C.sub,marginTop:3}}>{l}</div>
          </div>
        ))}
      </div>
      {loading?<Loader/>:(
        <div style={{background:C.card,borderRadius:16,overflow:'hidden',boxShadow:'0 1px 8px rgba(0,0,0,0.07)'}}>
          <div style={{padding:'14px 20px',fontWeight:700,fontSize:13,borderBottom:`1px solid ${C.bd}`}}>Rapport {period} · {mois}</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#f8fafc'}}>{['Agent','Contrat','Jours','Total h','Heures sup','Déficit','Balance'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:700,color:C.sub,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
            <tbody>
              {data.map(({agent,joursPresents,totalHFmt,supHFmt,defHFmt,balanceFmt,supH,defH})=>{
                const pos=balanceFmt&&!balanceFmt.startsWith('-');
                return(<tr key={agent.id} style={{borderBottom:`1px solid ${C.bd}`}}>
                  <td style={{padding:'10px 14px'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Av ag={agent} size={26}/><span style={{fontWeight:700}}>{agent.nom} {agent.prenom}</span></div></td>
                  <td style={{padding:'10px 14px'}}><span style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 7px',borderRadius:20,fontSize:10,fontWeight:700}}>{agent.contrat}</span></td>
                  <td style={{padding:'10px 14px',color:C.sub}}>{joursPresents}j</td>
                  <td style={{padding:'10px 14px',fontWeight:700}}>{totalHFmt}</td>
                  <td style={{padding:'10px 14px',color:supH>0?C.ok:C.sub,fontWeight:supH>0?700:400}}>{supH>0?`+${supHFmt}`:'—'}</td>
                  <td style={{padding:'10px 14px',color:defH>0?C.acc:C.sub,fontWeight:defH>0?700:400}}>{defH>0?`-${defHFmt}`:'—'}</td>
                  <td style={{padding:'10px 14px'}}><span style={{background:pos?'#ecfdf5':'#fff7ed',color:pos?C.ok:C.acc,padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:700}}>{balanceFmt}</span></td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState('dashboard');
  const [clockStr,setClockStr]=useState('');
  const [toastData,setToastData]=useState(null);

  // Vérifier token existant
  useEffect(()=>{
    const token=localStorage.getItem('ep_token');
    if(token) api.me().then(setUser).catch(()=>localStorage.removeItem('ep_token'));
  },[]);

  useEffect(()=>{
    const tick=()=>{const d=new Date();setClockStr(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);};
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[]);

  function showToast(msg,type='ok') { setToastData({msg,type}); }

  if(!user) return <LoginScreen onLogin={setUser}/>;

  const TABS=[
    {id:'dashboard', label:'Dashboard', Icon:Ic.Chart},
    {id:'pointage',  label:'Pointage',  Icon:Ic.QR},
    {id:'planning',  label:'Planning',  Icon:Ic.Cal},
    {id:'agents',    label:'Agents',    Icon:Ic.Users},
    {id:'zones',     label:'Zones GPS', Icon:Ic.Map},
    {id:'rapports',  label:'Rapports',  Icon:Ic.Dl},
  ];

  return(
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:C.bg,minHeight:'100vh',color:C.tx}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${C.pr},#1e4d8c)`,padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 2px 16px rgba(0,0,0,0.2)',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,background:C.acc,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#fff',boxShadow:`0 4px 12px rgba(232,93,4,0.4)`}}>EP</div>
          <div>
            <div style={{color:'#fff',fontWeight:800,fontSize:15}}>Easy Pointer</div>
            <div style={{color:'rgba(255,255,255,0.4)',fontSize:9,textTransform:'uppercase',letterSpacing:'0.08em'}}>Kéditou · v1.0</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{clockStr}</div>
          <div style={{color:'rgba(255,255,255,0.6)',fontSize:12}}>{user.nom} ({user.role})</div>
          <button onClick={()=>{localStorage.removeItem('ep_token');setUser(null);}} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',gap:5,fontSize:12}}><Ic.Logout/>Déconnexion</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{background:'#fff',borderBottom:`1px solid ${C.bd}`,padding:'0 24px',display:'flex',overflowX:'auto',position:'sticky',top:60,zIndex:99}}>
        {TABS.map(({id,label,Icon})=>(
          <button key={id} onClick={()=>setTab(id)} style={{display:'flex',alignItems:'center',gap:6,padding:'13px 18px',border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:tab===id?C.acc:C.sub,borderBottom:tab===id?`3px solid ${C.acc}`:'3px solid transparent',whiteSpace:'nowrap',transition:'all 0.15s'}}>
            <Icon/>{label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:'22px 20px'}}>
        {tab==='dashboard' && <Dashboard user={user}/>}
        {tab==='pointage'  && <Pointage toast={showToast}/>}
        {tab==='planning'  && <Planning toast={showToast}/>}
        {tab==='agents'    && <Agents   toast={showToast}/>}
        {tab==='zones'     && <Zones    toast={showToast}/>}
        {tab==='rapports'  && <Rapports toast={showToast}/>}
      </div>

      {toastData&&<Toast msg={toastData.msg} type={toastData.type} onClose={()=>setToastData(null)}/>}
    </div>
  );
}
