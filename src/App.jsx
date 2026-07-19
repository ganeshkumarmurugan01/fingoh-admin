import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";

const API = import.meta.env.VITE_API_URL;
const F   = "'Inter', -apple-system, sans-serif";
const C   = {
  navy:"#0D1B3E", blue:"#2563EB", green:"#16A34A", red:"#DC2626",
  amber:"#D97706", white:"#FFFFFF", light:"#F8FAFC", muted:"#94A3B8",
  dark:"#1E293B", border:"#E2E8F0", ltblue:"#EFF6FF", ltgrn:"#F0FDF4",
  ltred:"#FEF2F2", ltamber:"#FFFBEB", purple:"#7C3AED", ltpur:"#F5F3FF",
};

// ── Plan meta ─────────────────────────────────────────────────────────────────
const PLAN_COLORS = {
  trial:              {bg:"#F1F5F9", fg:"#475569"},
  single_event:       {bg:"#EFF6FF", fg:"#1E3A8A"},
  event_bundle:       {bg:"#ECFDF5", fg:"#065F46"},
  event_portfolio:    {bg:"#F0FDF4", fg:"#14532D"},
  annual_self_serve:  {bg:"#F5F3FF", fg:"#5B21B6"},
  annual_enterprise:  {bg:"#FFF7ED", fg:"#9A3412"},
  starter:    {bg:"#EFF6FF", fg:"#1E3A8A"},
  pro:        {bg:"#F0FDF4", fg:"#14532D"},
  enterprise: {bg:"#F5F3FF", fg:"#581C87"},
};
const STATUS_COLORS = {
  active:    {bg:"#F0FDF4", fg:"#16A34A"},
  suspended: {bg:"#FEF3C7", fg:"#92400E"},
  cancelled: {bg:"#FEF2F2", fg:"#DC2626"},
};
const SUPPORT_LABELS = { email:"Email", priority:"Priority", dedicated:"Dedicated CSM" };

// ── Auth helper ───────────────────────────────────────────────────────────────
async function apiCall(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || "";
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-fingoh-auth": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// ── Reusable field styles ─────────────────────────────────────────────────────
const iS = {width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"};
const lS = {fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.08,display:"block",marginBottom:5};

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles")
      .select("is_super_admin").eq("id", data.user.id).single();
    if (!profile?.is_super_admin) {
      await supabase.auth.signOut();
      setError("Access denied. Super admin only.");
      setLoading(false); return;
    }
    onLogin(data.user);
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.navy,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>
      <div style={{background:C.white,borderRadius:16,padding:40,width:380,boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/Fingoh_Black.png" alt="Fingoh" style={{height:32,display:"block",margin:"0 auto 4px"}}/>
          <div style={{fontSize:12,color:C.muted,fontWeight:500}}>Super Admin Panel</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:16}}>
            <label style={lS}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required style={iS}/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={lS}>Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required style={iS}/>
          </div>
          {error && <p style={{fontSize:12,color:C.red,marginBottom:16,textAlign:"center"}}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{width:"100%",padding:"11px 0",background:loading?"#CBD5E1":C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:F}}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── AI cost estimate helper ───────────────────────────────────────────────────
function aiCostEstimate(maxContacts, maxDeepIei) {
  const enrichCost  = (maxContacts  || 0) * 0.006;   // Sonnet enrichment per contact
  const deepCost    = (maxDeepIei   || 0) * 0.021;   // Deep IEI research per contact
  return (enrichCost + deepCost).toFixed(2);
}

// ── Plan feature card (read-only preview) ─────────────────────────────────────
function PlanFeatureCard({ config, compact = false }) {
  if (!config) return null;
  const pc = PLAN_COLORS[config.plan_id] || PLAN_COLORS.trial;
  const features = config.features_list || [];

  if (compact) {
    return (
      <div style={{background:pc.bg,border:`1.5px solid ${pc.fg}33`,borderRadius:10,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:pc.fg}}>{config.label}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{config.description}</div>
          </div>
          {(config.price_inr || config.price_usd) && (
            <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
              {config.price_inr ? <div style={{fontSize:12,fontWeight:700,color:pc.fg}}>₹{config.price_inr?.toLocaleString()}</div> : null}
              {config.price_usd ? <div style={{fontSize:11,color:C.muted}}>${config.price_usd}</div> : null}
            </div>
          )}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
          {features.slice(0,4).map((f,i) => (
            <span key={i} style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:"white",color:pc.fg,fontWeight:600,border:`1px solid ${pc.fg}44`}}>✓ {f}</span>
          ))}
          {features.length > 4 && <span style={{fontSize:10,color:C.muted}}>+{features.length-4} more</span>}
        </div>
        <div style={{display:"flex",gap:10,fontSize:10,color:C.muted,flexWrap:"wrap"}}>
          <span>📅 {config.max_events >= 999 ? "Unlimited events" : `${config.max_events} event${config.max_events>1?"s":""}`}</span>
          <span>👤 {config.max_contacts_per_event >= 9999 ? "Unlimited" : (config.max_contacts_per_event||0).toLocaleString()} contacts/ev</span>
          <span style={{color:C.purple}}>⚡ {config.max_deep_iei_per_event >= 9999 ? "Unlimited" : config.max_deep_iei_per_event} deep IEI/ev</span>
          <span>🎧 {SUPPORT_LABELS[config.support_level] || config.support_level}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{background:C.white,border:`1.5px solid ${pc.fg}33`,borderRadius:12,padding:"20px 22px",position:"relative"}}>
      <div style={{position:"absolute",top:14,right:14,fontSize:10,padding:"2px 8px",borderRadius:99,background:pc.bg,color:pc.fg,fontWeight:700}}>{config.plan_id}</div>
      <div style={{fontSize:15,fontWeight:700,color:pc.fg,marginBottom:4}}>{config.label}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}}>{config.description}</div>
      {(config.price_inr != null || config.price_usd != null) && (
        <div style={{marginBottom:12}}>
          {config.price_inr === 0 ? (
            <span style={{fontSize:18,fontWeight:800,color:pc.fg}}>Free</span>
          ) : (
            <>
              {config.price_inr ? <span style={{fontSize:18,fontWeight:800,color:pc.fg}}>₹{config.price_inr?.toLocaleString()}</span> : null}
              {config.price_usd ? <span style={{fontSize:12,color:C.muted,marginLeft:8}}>${config.price_usd} USD</span> : null}
            </>
          )}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12,padding:"10px 12px",background:C.light,borderRadius:8}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:C.navy}}>{config.max_events >= 999 ? "∞" : config.max_events}</div>
          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.05}}>Events</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:C.navy}}>{config.max_contacts_per_event >= 9999 ? "∞" : (config.max_contacts_per_event||"—").toLocaleString()}</div>
          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.05}}>Contacts/ev</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:C.purple}}>{config.max_deep_iei_per_event >= 9999 ? "∞" : (config.max_deep_iei_per_event||"—")}</div>
          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.05}}>Deep IEI/ev</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:800,color:C.navy}}>{config.max_staff_seats >= 999 ? "∞" : config.max_staff_seats}</div>
          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.05}}>Staff seats</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.navy}}>{SUPPORT_LABELS[config.support_level] || config.support_level}</div>
          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:.05}}>Support</div>
        </div>
      </div>
      {/* AI cost indicator */}
      <div style={{fontSize:10,color:C.muted,background:"#F8FAFC",borderRadius:6,padding:"6px 10px",marginBottom:8}}>
        Est. max AI cost/event: <strong style={{color:C.dark}}>${aiCostEstimate(config.max_contacts_per_event, config.max_deep_iei_per_event)}</strong>
        <span style={{marginLeft:8,color:"#94A3B8"}}>({config.max_contacts_per_event} contacts × $0.006 + {config.max_deep_iei_per_event} deep × $0.021)</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {features.map((f,i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.dark}}>
            <span style={{color:C.green,fontWeight:700,fontSize:13}}>✓</span> {f}
          </div>
        ))}
      </div>
      <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
        {config.has_ai_features      && <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"#EFF6FF",color:"#1D4ED8",fontWeight:600}}>AI features</span>}
        {config.has_crm_sync         && <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"#F0FDF4",color:"#166534",fontWeight:600}}>CRM sync</span>}
        {config.has_deep_iei         && <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"#F5F3FF",color:"#5B21B6",fontWeight:600}}>Deep IEI</span>}
        {config.has_walk_in_capture  && <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"#FFFBEB",color:"#92400E",fontWeight:600}}>Walk-in capture</span>}
        {config.has_meeting_scheduler&& <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"#FFF1F2",color:"#9F1239",fontWeight:600}}>Meeting scheduler</span>}
      </div>
    </div>
  );
}

// ── Add-on Catalog Editor ─────────────────────────────────────────────────────
const EMPTY_ADDON = { addon_id:"", label:"", addon_type:"extra_contacts", quantity:"", price_inr:"", price_usd:"", description:"", is_active:true };

function AddonCatalogSection() {
  const [catalog, setCatalog]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // addon_id or "new"
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);

  const load = useCallback(() => {
    apiCall("/admin/addon-catalog").then(d => { setCatalog(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const buildPayload = (f) => ({
    ...f,
    quantity:  parseInt(f.quantity)  || 0,
    price_inr: f.price_inr ? parseInt(f.price_inr) : null,
    price_usd: f.price_usd ? parseInt(f.price_usd) : null,
  });

  const handleSave = async () => {
    if (!editForm.label || !editForm.quantity) { alert("Label and Quantity are required."); return; }
    setSaving(true);
    try {
      if (editing === "new") {
        if (!editForm.addon_id) { alert("Add-on ID is required (e.g. extra_contacts_200)"); setSaving(false); return; }
        await apiCall(`/admin/addon-catalog/${editForm.addon_id}`, { method:"PUT", body:JSON.stringify(buildPayload(editForm)) });
      } else {
        await apiCall(`/admin/addon-catalog/${editing}`, { method:"PUT", body:JSON.stringify(buildPayload(editForm)) });
      }
      setEditing(null); load();
    } catch(e) { alert("Save failed: "+e.message); }
    setSaving(false);
  };

  const TC = { extra_events:{bg:"#EFF6FF",fg:"#1E3A8A"}, extra_contacts:{bg:"#F0FDF4",fg:"#065F46"} };

  const AddonForm = () => (
    <div style={{background:C.white,border:`2px solid ${C.blue}`,borderRadius:10,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>{editing==="new"?"New Add-on":"Edit Add-on"}</div>
      {editing === "new" && (
        <div style={{marginBottom:8}}>
          <label style={lS}>Add-on ID <span style={{color:C.red}}>*</span></label>
          <input value={editForm.addon_id||""} onChange={e=>setEditForm(f=>({...f,addon_id:e.target.value.toLowerCase().replace(/\s+/g,"_")}))}
            style={{...iS,fontSize:11}} placeholder="e.g. extra_contacts_200"/>
          <p style={{fontSize:9,color:C.muted,margin:"3px 0 0 0"}}>Lowercase, underscores only. Cannot change after save.</p>
        </div>
      )}
      {[["Label","label","text"],["Description","description","text"]].map(([lbl,field,type])=>(
        <div key={field} style={{marginBottom:8}}>
          <label style={lS}>{lbl}</label>
          <input type={type} value={editForm[field]||""} onChange={e=>setEditForm(f=>({...f,[field]:e.target.value}))} style={{...iS,fontSize:11}}/>
        </div>
      ))}
      <div style={{marginBottom:8}}>
        <label style={lS}>Type</label>
        <select value={editForm.addon_type||"extra_contacts"} onChange={e=>setEditForm(f=>({...f,addon_type:e.target.value}))} style={{...iS,fontSize:11}}>
          <option value="extra_contacts">Extra Contacts</option>
          <option value="extra_events">Extra Events</option>
        </select>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[["Quantity","quantity","number"],["Price ₹","price_inr","number"],["Price $","price_usd","number"]].map(([lbl,field,type])=>(
          <div key={field}>
            <label style={lS}>{lbl}</label>
            <input type={type} value={editForm[field]||""} onChange={e=>setEditForm(f=>({...f,[field]:e.target.value}))} style={{...iS,fontSize:11}}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setEditing(null)} style={{flex:1,padding:"7px 0",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:F}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"7px 0",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F}}>{saving?"Saving…":"Save Add-on"}</button>
      </div>
    </div>
  );

  if (loading) return <div style={{fontSize:12,color:C.muted,padding:"32px 0"}}>Loading add-ons…</div>;

  return (
    <div style={{marginTop:40,borderTop:`2px solid ${C.border}`,paddingTop:32}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:C.navy,margin:0}}>Add-on Catalog</h3>
          <p style={{fontSize:12,color:C.muted,margin:"4px 0 0 0"}}>Add-ons customers can purchase on top of their plan. Assign from the customer profile.</p>
        </div>
        {editing !== "new" && (
          <button onClick={()=>{setEditing("new");setEditForm({...EMPTY_ADDON});}}
            style={{padding:"7px 16px",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>
            + New Add-on
          </button>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
        {editing === "new" && <AddonForm/>}
        {catalog.map(a => {
          const tc = TC[a.addon_type] || TC.extra_contacts;
          return editing === a.addon_id
            ? <AddonForm key={a.addon_id}/>
            : (
              <div key={a.addon_id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:16,position:"relative",opacity:a.is_active?1:0.45}}>
                <span style={{display:"inline-block",fontSize:9,padding:"2px 8px",borderRadius:99,background:tc.bg,color:tc.fg,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>
                  {a.addon_type.replace(/_/g," ")}
                </span>
                <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:3}}>{a.label}</div>
                {a.description && <div style={{fontSize:11,color:C.muted,marginBottom:10,lineHeight:1.5}}>{a.description}</div>}
                <div style={{display:"flex",gap:10,alignItems:"baseline",marginBottom:12}}>
                  {a.price_inr != null && <span style={{fontSize:15,fontWeight:800,color:C.navy}}>₹{a.price_inr?.toLocaleString()}</span>}
                  {a.price_usd != null && <span style={{fontSize:12,color:C.muted}}>${a.price_usd}</span>}
                </div>
                <div style={{fontSize:11,color:C.muted}}>+{a.quantity} {a.addon_type==="extra_events"?"event(s)":"contacts"}</div>
                <button onClick={()=>{setEditing(a.addon_id);setEditForm(a);}}
                  style={{position:"absolute",top:12,right:12,padding:"3px 9px",background:"none",color:C.muted,border:`1px solid ${C.border}`,borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:F}}>
                  Edit
                </button>
              </div>
            );
        })}
      </div>
    </div>
  );
}

// ── Plans Config Screen ───────────────────────────────────────────────────────
function PlansConfigScreen() {
  const [configs, setConfigs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // plan_id being edited
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiCall("/admin/plan-configs")
      .then(data => { setConfigs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (cfg) => {
    setEditing(cfg.plan_id);
    setEditForm({
      ...cfg,
      features_list: Array.isArray(cfg.features_list) ? cfg.features_list.join("\n") : (cfg.features_list || ""),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        features_list: typeof editForm.features_list === "string"
          ? editForm.features_list.split("\n").map(s=>s.trim()).filter(Boolean)
          : editForm.features_list,
        max_events: parseInt(editForm.max_events) || 1,
        max_staff_seats: parseInt(editForm.max_staff_seats) || 3,
        price_inr: editForm.price_inr ? parseInt(editForm.price_inr) : null,
        price_usd: editForm.price_usd ? parseInt(editForm.price_usd) : null,
        sort_order: parseInt(editForm.sort_order) || 0,
      };
      await apiCall(`/admin/plan-configs/${editing}`, { method:"PUT", body:JSON.stringify(payload) });
      setEditing(null);
      load();
    } catch(e) { alert("Save failed: "+e.message); }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset all plans to default configuration? Any custom changes will be lost.")) return;
    setResetting(true);
    try {
      await apiCall("/admin/plan-configs/reset-defaults", { method:"POST" });
      load();
    } catch(e) { alert("Reset failed: "+e.message); }
    setResetting(false);
  };

  const toggle = (field) => setEditForm(f => ({...f, [field]: !f[field]}));

  const ToggleChip = ({field, label}) => (
    <button onClick={()=>toggle(field)}
      style={{padding:"5px 12px",borderRadius:99,border:`1.5px solid ${editForm[field]?C.green:C.border}`,background:editForm[field]?"#F0FDF4":C.white,color:editForm[field]?C.green:C.muted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
      {editForm[field] ? "✓" : "○"} {label}
    </button>
  );

  if (loading) return <div style={{padding:40,color:C.muted,fontSize:13}}>Loading plan configurations…</div>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,color:C.navy,margin:0}}>Plans & Packages</h2>
          <p style={{fontSize:12,color:C.muted,margin:"4px 0 0 0"}}>Define what each plan includes. These features are shown when creating or upgrading a customer.</p>
        </div>
        <button onClick={handleReset} disabled={resetting}
          style={{padding:"7px 16px",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          {resetting ? "Resetting…" : "↺ Reset to defaults"}
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
        {configs.filter(c => c.is_active && c.plan_id !== "event_portfolio").map(cfg => (
          <div key={cfg.plan_id}>
            {editing === cfg.plan_id ? (
              <div style={{background:C.white,border:`2px solid ${C.blue}`,borderRadius:12,padding:"20px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.navy}}>Editing: {cfg.label}</span>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setEditing(null)} style={{padding:"4px 10px",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:F}}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{padding:"4px 10px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F}}>{saving?"Saving…":"Save"}</button>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div><label style={lS}>Label</label><input value={editForm.label||""} onChange={e=>setEditForm(f=>({...f,label:e.target.value}))} style={iS}/></div>
                  <div><label style={lS}>Description</label><input value={editForm.description||""} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} style={iS}/></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><label style={lS}>Max Events</label><input type="number" value={editForm.max_events||1} onChange={e=>setEditForm(f=>({...f,max_events:e.target.value}))} style={iS}/></div>
                    <div><label style={lS}>Staff Seats</label><input type="number" value={editForm.max_staff_seats||3} onChange={e=>setEditForm(f=>({...f,max_staff_seats:e.target.value}))} style={iS}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <label style={lS}>Max Contacts / Event</label>
                      <input type="number" value={editForm.max_contacts_per_event||500} onChange={e=>setEditForm(f=>({...f,max_contacts_per_event:e.target.value}))} style={iS}/>
                      <p style={{fontSize:9,color:C.muted,margin:"3px 0 0 0"}}>Upload cap enforced at CSV import</p>
                    </div>
                    <div>
                      <label style={lS}>Max Deep IEI / Event</label>
                      <input type="number" value={editForm.max_deep_iei_per_event||50} onChange={e=>setEditForm(f=>({...f,max_deep_iei_per_event:e.target.value}))} style={iS}/>
                      <p style={{fontSize:9,color:C.muted,margin:"3px 0 0 0"}}>Deep research AI analysis cap</p>
                    </div>
                  </div>
                  {/* Live cost estimate */}
                  <div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8,padding:"10px 12px",fontSize:11}}>
                    <strong style={{color:"#14532D"}}>Est. max AI cost/event: ${aiCostEstimate(editForm.max_contacts_per_event, editForm.max_deep_iei_per_event)}</strong>
                    <div style={{color:"#166534",marginTop:3,fontSize:10}}>
                      {editForm.max_contacts_per_event||0} contacts × $0.006 (Sonnet enrichment) + {editForm.max_deep_iei_per_event||0} deep IEI × $0.021 (research)
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div><label style={lS}>Price (₹ INR)</label><input type="number" value={editForm.price_inr||""} onChange={e=>setEditForm(f=>({...f,price_inr:e.target.value}))} style={iS} placeholder="0 for free"/></div>
                    <div><label style={lS}>Price ($ USD)</label><input type="number" value={editForm.price_usd||""} onChange={e=>setEditForm(f=>({...f,price_usd:e.target.value}))} style={iS} placeholder="0 for free"/></div>
                  </div>
                  <div>
                    <label style={lS}>Support Level</label>
                    <select value={editForm.support_level||"email"} onChange={e=>setEditForm(f=>({...f,support_level:e.target.value}))} style={iS}>
                      <option value="email">Email support</option>
                      <option value="priority">Priority support</option>
                      <option value="dedicated">Dedicated CSM</option>
                    </select>
                  </div>
                  <div>
                    <label style={lS}>Features list (one per line)</label>
                    <textarea value={editForm.features_list||""} onChange={e=>setEditForm(f=>({...f,features_list:e.target.value}))}
                      rows={5} style={{...iS,resize:"vertical",lineHeight:1.6}} placeholder="1 event&#10;IEI scoring&#10;Staff app"/>
                  </div>
                  <div>
                    <label style={{...lS,marginBottom:8}}>Included features</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      <ToggleChip field="has_ai_features"       label="AI features"/>
                      <ToggleChip field="has_crm_sync"          label="CRM sync"/>
                      <ToggleChip field="has_deep_iei"          label="Deep IEI"/>
                      <ToggleChip field="has_walk_in_capture"   label="Walk-in capture"/>
                      <ToggleChip field="has_meeting_scheduler" label="Meeting scheduler"/>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{position:"relative"}}>
                <PlanFeatureCard config={cfg}/>
                <button onClick={()=>startEdit(cfg)}
                  style={{position:"absolute",top:14,right:60,padding:"3px 10px",background:"rgba(255,255,255,0.9)",color:C.navy,border:`1px solid ${C.border}`,borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <AddonCatalogSection/>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ val, label, color }) {
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 24px"}}>
      <div style={{fontSize:28,fontWeight:800,color:color||C.navy,letterSpacing:"-0.02em"}}>{val}</div>
      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{label}</div>
    </div>
  );
}

// ── Create Customer Modal ─────────────────────────────────────────────────────
function CreateCustomerModal({ onClose, onCreated, planConfigs }) {
  const [form, setForm] = useState({
    company_name:"", slug:"", admin_email:"", admin_name:"",
    plan:"single_event", max_events:1, admin_notes:"", subscription_expires_at:""
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");

  const selectedPlanConfig = planConfigs.find(p => p.plan_id === form.plan);

  const handlePlanChange = (plan) => {
    const cfg = planConfigs.find(p => p.plan_id === plan);
    setForm(f => ({...f, plan, max_events: cfg ? cfg.max_events : f.max_events}));
  };

  const handleSubmit = async () => {
    if (!form.company_name||!form.slug||!form.admin_email||!form.admin_name) {
      setError("Please fill all required fields"); return;
    }
    setLoading(true); setError("");
    try {
      const data = await apiCall("/admin/customers", {
        method:"POST", body:JSON.stringify({...form, max_events:parseInt(form.max_events)})
      });
      setResult(data);
      onCreated();
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.white,borderRadius:16,padding:32,maxWidth:600,width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{fontSize:16,fontWeight:700,color:C.navy,margin:0}}>Create New Customer</h2>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.muted}}>✕</button>
        </div>

        {result ? (
          <div>
            <div style={{background:C.ltgrn,border:"1px solid #86EFAC",borderRadius:10,padding:20,marginBottom:20}}>
              <p style={{fontSize:14,fontWeight:700,color:"#14532D",margin:"0 0 12px 0"}}>✓ Customer created! Welcome email sent.</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Company:</strong> {form.company_name}</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Login Email:</strong> {result.email}</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Password:</strong> <code style={{background:"#DCFCE7",padding:"2px 6px",borderRadius:4}}>{result.password}</code></p>
              <p style={{fontSize:11,color:"#DC2626",margin:"8px 0 0 0",fontWeight:600}}>⚠ Save this password — it won't be shown again</p>
            </div>
            <button onClick={onClose} style={{width:"100%",padding:"10px 0",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>Done</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={lS}>Company Name *</label>
                <input value={form.company_name}
                  onChange={e=>setForm(p=>({...p,company_name:e.target.value,slug:e.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}))}
                  style={iS} placeholder="Acme Corp"/>
              </div>
              <div><label style={lS}>Slug *</label>
                <input value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))} style={iS} placeholder="acme-corp"/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={lS}>Admin Name *</label><input value={form.admin_name} onChange={e=>setForm(p=>({...p,admin_name:e.target.value}))} style={iS} placeholder="John Smith"/></div>
              <div><label style={lS}>Admin Email *</label><input value={form.admin_email} onChange={e=>setForm(p=>({...p,admin_email:e.target.value}))} type="email" style={iS} placeholder="john@acme.com"/></div>
            </div>

            {/* Plan selector */}
            <div>
              <label style={lS}>Plan</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                {planConfigs.filter(p=>p.is_active && !["starter","pro","enterprise"].includes(p.plan_id)).map(cfg => {
                  const pc = PLAN_COLORS[cfg.plan_id] || PLAN_COLORS.trial;
                  const active = form.plan === cfg.plan_id;
                  return (
                    <button key={cfg.plan_id} onClick={()=>handlePlanChange(cfg.plan_id)}
                      style={{padding:"6px 14px",borderRadius:8,border:`2px solid ${active?pc.fg:C.border}`,background:active?pc.bg:C.white,color:active?pc.fg:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F,transition:"all .1s"}}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              {/* Plan feature preview */}
              {selectedPlanConfig && <PlanFeatureCard config={selectedPlanConfig} compact/>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={lS}>Max Events</label>
                <input value={form.max_events} onChange={e=>setForm(p=>({...p,max_events:e.target.value}))} type="number" min="1" style={iS}/>
              </div>
              <div><label style={lS}>Subscription Expires</label>
                <input value={form.subscription_expires_at} onChange={e=>setForm(p=>({...p,subscription_expires_at:e.target.value}))} type="date" style={iS}/>
              </div>
            </div>
            <div><label style={lS}>Admin Notes</label>
              <textarea value={form.admin_notes} onChange={e=>setForm(p=>({...p,admin_notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}} placeholder="Internal notes…"/>
            </div>
            {error && <p style={{fontSize:12,color:C.red,margin:0}}>{error}</p>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={onClose} style={{flex:1,padding:"10px 0",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                style={{flex:2,padding:"10px 0",background:loading?"#CBD5E1":C.navy,color:C.white,border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:F}}>
                {loading?"Creating…":"Create Customer & Send Welcome Email →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Log ──────────────────────────────────────────────────────────────
function ActivityLog({ orgId }) {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    apiCall(`/admin/customers/${orgId}/activity`)
      .then(data=>{ setLogs(data); setLoading(false); })
      .catch(()=>setLoading(false));
  },[orgId]);

  const ACTION_ICONS = {event_created:"📅",contacts_uploaded:"⬆",meeting_sent:"🤝",crm_sync:"🔗",login:"🔑"};

  if (loading) return <div style={{color:C.muted,fontSize:12}}>Loading…</div>;
  if (!logs.length) return <div style={{color:C.muted,fontSize:12}}>No activity yet</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {logs.map((log,i)=>(
        <div key={log.id} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 0",borderBottom:i<logs.length-1?`1px solid #F1F5F9`:"none"}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>
            {ACTION_ICONS[log.action]||"•"}
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:12,fontWeight:600,color:C.dark,margin:0}}>{log.description}</p>
            <p style={{fontSize:11,color:C.muted,margin:"2px 0 0 0"}}>{new Date(log.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Customer Detail ───────────────────────────────────────────────────────────
// ── Org Add-ons Section ───────────────────────────────────────────────────────
function OrgAddonsSection({ orgId, events }) {
  const [addons, setAddons]     = useState([]);
  const [catalog, setCatalog]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ addon_catalog_id:"", event_id:"", notes:"" });
  const [adding, setAdding]     = useState(false);

  const load = useCallback(() => {
    Promise.all([
      apiCall(`/admin/customers/${orgId}/addons`),
      apiCall("/admin/addon-catalog"),
    ]).then(([a, c]) => { setAddons(a); setCatalog(c.filter(x=>x.is_active)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const selectedCatalog = catalog.find(c => c.addon_id === form.addon_catalog_id);
  const needsEvent = selectedCatalog?.addon_type === "extra_contacts";

  const handleAdd = async () => {
    if (!form.addon_catalog_id) return;
    setAdding(true);
    try {
      const payload = {
        addon_catalog_id: form.addon_catalog_id,
        addon_type: selectedCatalog.addon_type,
        quantity: selectedCatalog.quantity,
        notes: form.notes || null,
        event_id: needsEvent && form.event_id ? form.event_id : null,
      };
      await apiCall(`/admin/customers/${orgId}/addons`, { method:"POST", body:JSON.stringify(payload) });
      setForm({ addon_catalog_id:"", event_id:"", notes:"" });
      setShowForm(false);
      load();
    } catch(e) { alert("Failed: "+e.message); }
    setAdding(false);
  };

  const handleRemove = async (addonRowId) => {
    if (!window.confirm("Remove this add-on?")) return;
    try {
      await apiCall(`/admin/customers/${orgId}/addons/${addonRowId}`, { method:"DELETE" });
      load();
    } catch(e) { alert("Failed: "+e.message); }
  };

  const TYPE_COLORS = {
    extra_events:   { bg:"#EFF6FF", fg:"#1E3A8A" },
    extra_contacts: { bg:"#F0FDF4", fg:"#065F46" },
  };

  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:0}}>Add-ons</h3>
        <button onClick={()=>setShowForm(s=>!s)}
          style={{padding:"5px 12px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          {showForm ? "Cancel" : "+ Assign Add-on"}
        </button>
      </div>

      {showForm && (
        <div style={{background:"#F8FAFC",border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:10,alignItems:"end"}}>
            <div>
              <label style={lS}>Add-on *</label>
              <select value={form.addon_catalog_id} onChange={e=>setForm(f=>({...f,addon_catalog_id:e.target.value,event_id:""}))} style={iS}>
                <option value="">Select add-on…</option>
                {catalog.map(c=>(
                  <option key={c.addon_id} value={c.addon_id}>{c.label} (₹{c.price_inr?.toLocaleString()})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lS}>Event {needsEvent ? "*" : "(optional)"}</label>
              <select value={form.event_id} onChange={e=>setForm(f=>({...f,event_id:e.target.value}))} style={iS} disabled={!needsEvent}>
                <option value="">All events / N/A</option>
                {events.map(ev=><option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lS}>Notes</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={iS} placeholder="e.g. promo, request ID…"/>
            </div>
            <button onClick={handleAdd} disabled={adding||!form.addon_catalog_id||(needsEvent&&!form.event_id)}
              style={{padding:"8px 16px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>
              {adding?"Adding…":"Assign"}
            </button>
          </div>
          {selectedCatalog && needsEvent && !form.event_id && (
            <p style={{fontSize:11,color:C.red,margin:"8px 0 0 0"}}>⚠ Extra contacts must be linked to a specific event.</p>
          )}
        </div>
      )}

      {loading ? <div style={{fontSize:12,color:C.muted}}>Loading…</div>
      : addons.length === 0
        ? <p style={{fontSize:12,color:C.muted,margin:0}}>No add-ons assigned to this customer.</p>
        : (
          <div>
            {addons.map(a => {
              const tc = TYPE_COLORS[a.addon_type] || TYPE_COLORS.extra_events;
              const ev = events.find(e=>e.id===a.event_id);
              return (
                <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:tc.bg,color:tc.fg,fontWeight:700,textTransform:"uppercase"}}>{a.addon_type.replace(/_/g," ")}</span>
                    <div>
                      <p style={{fontSize:12,fontWeight:700,color:C.navy,margin:0}}>
                        +{a.quantity} {a.addon_type === "extra_events" ? "event(s)" : "contacts"}
                      </p>
                      {ev && <p style={{fontSize:11,color:C.muted,margin:"1px 0 0 0"}}>Event: {ev.name}</p>}
                      {a.notes && <p style={{fontSize:11,color:C.muted,margin:"1px 0 0 0"}}>{a.notes}</p>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:11,color:C.muted}}>{new Date(a.created_at).toLocaleDateString()}</span>
                    <button onClick={()=>handleRemove(a.id)}
                      style={{padding:"4px 10px",background:C.ltred,color:C.red,border:"1px solid #FECACA",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

function CustomerDetail({ orgId, onBack, planConfigs }) {
  const [org, setOrg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({name:"",email:"",role:"user",title:""});
  const [addingUser, setAddingUser]   = useState(false);
  const [addUserResult, setAddUserResult] = useState(null);

  const reload = useCallback(() => {
    apiCall(`/admin/customers/${orgId}`).then(data => {
      setOrg(data);
      setForm({
        plan: data.plan||"single_event",
        max_events: data.max_events||1,
        status: data.status||"active",
        subscription_expires_at: data.subscription_expires_at?.slice(0,10)||"",
        admin_notes: data.admin_notes||"",
      });
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [orgId]);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall(`/admin/customers/${orgId}`, { method:"PATCH", body:JSON.stringify(form) });
      setEditing(false);
      reload();
    } catch(e) { alert("Failed: "+e.message); }
    setSaving(false);
  };

  if (loading) return <div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:F}}>Loading…</div>;
  if (!org)    return <div style={{padding:40,textAlign:"center",color:C.red,fontFamily:F}}>Customer not found</div>;

  const pc = PLAN_COLORS[org.plan]||PLAN_COLORS.trial;
  const sc = STATUS_COLORS[org.status]||STATUS_COLORS.active;
  const selectedPlanConfig = planConfigs.find(p => p.plan_id === form.plan);

  return (
    <div style={{fontFamily:F}}>
      {/* Back + header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button onClick={onBack} style={{padding:"7px 14px",background:C.white,color:C.navy,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          ← Back
        </button>
        <div>
          <h1 style={{fontSize:20,fontWeight:700,color:C.navy,margin:0,letterSpacing:"-0.02em"}}>{org.name}</h1>
          <p style={{fontSize:12,color:C.muted,margin:0}}>{org.slug} · Created {new Date(org.created_at).toLocaleDateString()}</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,padding:"4px 10px",borderRadius:99,background:pc.bg,color:pc.fg,fontWeight:700}}>{org.plan}</span>
          <span style={{fontSize:11,padding:"4px 10px",borderRadius:99,background:sc.bg,color:sc.fg,fontWeight:700}}>{org.status}</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Subscription */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:0}}>Subscription</h3>
            {!editing
              ? <button onClick={()=>setEditing(true)} style={{padding:"5px 12px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>Edit</button>
              : <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditing(false)} style={{padding:"5px 12px",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:F}}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={{padding:"5px 12px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{saving?"Saving…":"Save & Notify"}</button>
                </div>
            }
          </div>
          {editing ? (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Plan selector with feature preview */}
              <div>
                <label style={lS}>Plan</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {planConfigs.filter(p=>p.is_active && p.plan_id !== "event_portfolio").map(cfg => {
                    const pcc = PLAN_COLORS[cfg.plan_id] || PLAN_COLORS.trial;
                    const active = form.plan === cfg.plan_id;
                    return (
                      <button key={cfg.plan_id} onClick={()=>{
                        const c = planConfigs.find(p=>p.plan_id===cfg.plan_id);
                        setForm(f=>({...f, plan:cfg.plan_id, max_events: c ? c.max_events : f.max_events}));
                      }}
                        style={{padding:"5px 12px",borderRadius:7,border:`2px solid ${active?pcc.fg:C.border}`,background:active?pcc.bg:C.white,color:active?pcc.fg:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:F}}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {selectedPlanConfig && <PlanFeatureCard config={selectedPlanConfig} compact/>}
                <p style={{fontSize:10,color:C.muted,marginTop:6}}>Changing plan will auto-email the customer.</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lS}>Status</label>
                  <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={iS}>
                    {["active","suspended","cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label style={lS}>Max Events</label><input type="number" value={form.max_events} onChange={e=>setForm(p=>({...p,max_events:parseInt(e.target.value)}))} style={iS}/></div>
              </div>
              <div><label style={lS}>Expires</label><input type="date" value={form.subscription_expires_at} onChange={e=>setForm(p=>({...p,subscription_expires_at:e.target.value}))} style={iS}/></div>
              <div><label style={lS}>Admin Notes</label><textarea value={form.admin_notes} onChange={e=>setForm(p=>({...p,admin_notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}}/></div>
            </div>
          ) : (
            <div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                {[
                  ["Plan",       org.plan],
                  ["Status",     org.status],
                  ["Max Events", org.max_events],
                  ["Expires",    org.subscription_expires_at ? new Date(org.subscription_expires_at).toLocaleDateString() : "—"],
                  ["Notes",      org.admin_notes||"—"],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                    <span style={{color:C.muted,fontWeight:500}}>{k}</span>
                    <span style={{color:C.dark,fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Show current plan features */}
              {planConfigs.find(p=>p.plan_id===org.plan) && (
                <PlanFeatureCard config={planConfigs.find(p=>p.plan_id===org.plan)} compact/>
              )}
            </div>
          )}
        </div>

        {/* Users */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:0}}>Users ({org.users?.length||0})</h3>
            <button onClick={()=>setShowAddUser(true)}
              style={{padding:"5px 12px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
              + Add User
            </button>
          </div>
          {org.users?.length===0
            ? <p style={{fontSize:12,color:C.muted}}>No users yet</p>
            : org.users?.map(u=>(
              <div key={u.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:C.navy,margin:0}}>{u.name||"—"}</p>
                  <p style={{fontSize:11,color:C.muted,margin:0}}>{u.email||"—"}</p>
                  <p style={{fontSize:10,color:C.muted,margin:"2px 0 0 0"}}>{u.role} · {u.title||"—"}</p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={async()=>{
                    if (!window.confirm(`Reset password for ${u.name}?`)) return;
                    try {
                      const data = await apiCall(`/admin/customers/${orgId}/reset-password`,{method:"POST"});
                      alert(`New password: ${data.new_password}\n\nSave this — shown once only.`);
                    } catch(e){ alert("Failed: "+e.message); }
                  }}
                    style={{padding:"5px 10px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                    Reset PW
                  </button>
                  <button onClick={async()=>{
                    if (!window.confirm(`Delete user ${u.name}? This cannot be undone.`)) return;
                    try {
                      await apiCall(`/admin/customers/${orgId}/users/${u.id}`,{method:"DELETE"});
                      reload();
                    } catch(e){ alert("Failed: "+e.message); }
                  }}
                    style={{padding:"5px 10px",background:C.ltred,color:C.red,border:"1px solid #FECACA",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Events */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:"0 0 16px 0"}}>Events ({org.events?.length||0})</h3>
        {org.events?.length===0
          ? <p style={{fontSize:12,color:C.muted}}>No events created yet</p>
          : <div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                {["Event Name","Date From","Date To","Created"].map(h=>(
                  <div key={h} style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase"}}>{h}</div>
                ))}
              </div>
              {org.events.map(ev=>(
                <div key={ev.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{ev.name}</span>
                  <span style={{fontSize:12,color:C.muted}}>{ev.date_from||"—"}</span>
                  <span style={{fontSize:12,color:C.muted}}>{ev.date_to||"—"}</span>
                  <span style={{fontSize:12,color:C.muted}}>{new Date(ev.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Add-ons */}
      <OrgAddonsSection orgId={orgId} events={org.events||[]}/>

      {/* Activity Log */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:"0 0 16px 0"}}>Activity Log</h3>
        <ActivityLog orgId={orgId}/>
      </div>

      {/* Danger Zone */}
      <div style={{background:C.ltred,border:"1px solid #FECACA",borderRadius:12,padding:24}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.red,margin:"0 0 8px 0"}}>Danger Zone</h3>
        <p style={{fontSize:12,color:"#991B1B",margin:"0 0 16px 0",lineHeight:1.6}}>
          Deleting this customer permanently removes the organisation, all users, all events, all contacts, all meetings, and all CRM connections. <strong>This action cannot be undone.</strong>
        </p>
        <button
          onClick={async()=>{
            if (!window.confirm(`Delete "${org.name}"?\n\nThis will permanently delete:\n• All users\n• All events (${org.events?.length||0})\n• All contacts and meetings\n\nThis cannot be undone.`)) return;
            if (!window.confirm(`Confirm deletion of "${org.name}"`)) return;
            try {
              await apiCall(`/admin/customers/${orgId}`, {method:"DELETE"});
              alert(`"${org.name}" has been deleted.`);
              onBack();
            } catch(e) { alert("Failed: "+e.message); }
          }}
          style={{padding:"9px 20px",background:C.red,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>
          Delete Customer & All Data
        </button>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.white,borderRadius:14,padding:28,maxWidth:420,width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{fontSize:15,fontWeight:700,color:C.navy,margin:0}}>Add User</h3>
              <button onClick={()=>{setShowAddUser(false);setAddUserResult(null);setAddUserForm({name:"",email:"",role:"user",title:""});}}
                style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.muted}}>✕</button>
            </div>
            {addUserResult ? (
              <div>
                <div style={{background:C.ltgrn,border:"1px solid #86EFAC",borderRadius:8,padding:16,marginBottom:16}}>
                  <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Email:</strong> {addUserResult.email}</p>
                  <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Password:</strong> <code style={{background:"#DCFCE7",padding:"2px 6px",borderRadius:4}}>{addUserResult.password}</code></p>
                  <p style={{fontSize:11,color:C.red,margin:"8px 0 0 0",fontWeight:600}}>⚠ Save this password — shown once only</p>
                </div>
                <button onClick={()=>{setShowAddUser(false);setAddUserResult(null);setAddUserForm({name:"",email:"",role:"user",title:""});reload();}}
                  style={{width:"100%",padding:"10px 0",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>Done</button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><label style={lS}>Name *</label><input value={addUserForm.name} onChange={e=>setAddUserForm(p=>({...p,name:e.target.value}))} style={iS} placeholder="John Smith"/></div>
                <div><label style={lS}>Email *</label><input value={addUserForm.email} onChange={e=>setAddUserForm(p=>({...p,email:e.target.value}))} type="email" style={iS} placeholder="john@company.com"/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={lS}>Role</label>
                    <select value={addUserForm.role} onChange={e=>setAddUserForm(p=>({...p,role:e.target.value}))} style={iS}>
                      {["admin","user","viewer"].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label style={lS}>Title</label><input value={addUserForm.title} onChange={e=>setAddUserForm(p=>({...p,title:e.target.value}))} style={iS} placeholder="Sales Manager"/></div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>setShowAddUser(false)} style={{flex:1,padding:"10px 0",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>Cancel</button>
                  <button disabled={addingUser||!addUserForm.name||!addUserForm.email}
                    onClick={async()=>{
                      setAddingUser(true);
                      try {
                        const data = await apiCall(`/admin/customers/${orgId}/users`,{method:"POST",body:JSON.stringify(addUserForm)});
                        setAddUserResult(data);
                      } catch(e){ alert("Failed: "+e.message); }
                      setAddingUser(false);
                    }}
                    style={{flex:2,padding:"10px 0",background:addingUser?"#CBD5E1":C.navy,color:C.white,border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:addingUser?"not-allowed":"pointer",fontFamily:F}}>
                    {addingUser?"Adding…":"Add User"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Customer Row ──────────────────────────────────────────────────────────────
function CustomerRow({ org, onSelect, onStatusChange, onResetPassword }) {
  const [resetting, setResetting] = useState(false);
  const pc = PLAN_COLORS[org.plan] || PLAN_COLORS.trial;
  const sc = STATUS_COLORS[org.status] || STATUS_COLORS.active;
  const expires = org.subscription_expires_at
    ? new Date(org.subscription_expires_at).toLocaleDateString()
    : "—";
  const expiring = org.subscription_expires_at &&
    (new Date(org.subscription_expires_at) - Date.now()) < 30 * 86400000 &&
    (new Date(org.subscription_expires_at) - Date.now()) > 0;

  return (
    <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 1fr 90px 80px 110px 60px 160px",gap:12,alignItems:"center",background:C.white,cursor:"pointer",transition:"background .1s"}}
      onClick={()=>onSelect(org)}
      onMouseOver={e=>e.currentTarget.style.background=C.light}
      onMouseOut={e=>e.currentTarget.style.background=C.white}>
      <div>
        <p style={{fontSize:13,fontWeight:600,color:C.navy,margin:0}}>{org.name}</p>
        <p style={{fontSize:11,color:C.muted,margin:0}}>{org.slug}</p>
      </div>
      <div style={{fontSize:12,color:C.dark}}>{org.users?.[0]?.name || "—"}</div>
      <div>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:pc.bg,color:pc.fg,fontWeight:700}}>{org.plan?.replace(/_/g," ")}</span>
      </div>
      <div>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:sc.bg,color:sc.fg,fontWeight:700}}>{org.status}</span>
      </div>
      <div style={{fontSize:11,color:expiring?"#D97706":C.muted,fontWeight:expiring?700:400}}>
        {expiring && "⚠ "}{expires}
      </div>
      <div style={{textAlign:"center"}}>
        <span style={{fontSize:12,fontWeight:600,color:C.navy}}>{org.event_count||0}</span>
        <span style={{fontSize:10,color:C.muted}}> events</span>
      </div>
      <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
        <select value={org.status} onChange={e=>onStatusChange(org.id, e.target.value)}
          style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontFamily:F,cursor:"pointer",flex:1}}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={async()=>{ setResetting(true); await onResetPassword(org.id); setResetting(false); }}
          disabled={resetting}
          style={{padding:"4px 8px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>
          {resetting?"…":"PW"}
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState(null);
  const [customers, setCustomers] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [selOrg, setSelOrg]           = useState(null);
  const [pwResult, setPwResult]       = useState(null);
  const [activeTab, setActiveTab]     = useState("customers");
  const [planConfigs, setPlanConfigs] = useState([]);
  const [search, setSearch]           = useState("");

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if (session?.user) setUser(session.user);
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_,session)=>{ setUser(session?.user || null); });
  },[]);

  useEffect(()=>{
    const s = document.createElement("style");
    s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(s);
    return ()=>document.head.removeChild(s);
  },[]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [s, c, pc] = await Promise.all([
        apiCall("/admin/stats"),
        apiCall("/admin/customers"),
        apiCall("/admin/plan-configs"),
      ]);
      setStats(s);
      setCustomers(c);
      setPlanConfigs(pc);
    } catch(e) { console.error("Load failed:", e); }
    setDataLoading(false);
  };

  useEffect(()=>{ if(user) loadData(); },[user]);

  const handleStatusChange = async (orgId, status) => {
    try {
      await apiCall(`/admin/customers/${orgId}/status?status=${status}`, {method:"PATCH"});
      loadData();
    } catch(e) { alert("Failed: "+e.message); }
  };

  const handleResetPassword = async (orgId) => {
    try {
      const data = await apiCall(`/admin/customers/${orgId}/reset-password`, {method:"POST"});
      setPwResult(data);
    } catch(e) { alert("Failed: "+e.message); }
  };

  const filteredCustomers = customers.filter(org => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (org.name||"").toLowerCase().includes(q) ||
           (org.slug||"").toLowerCase().includes(q) ||
           (org.plan||"").toLowerCase().includes(q) ||
           (org.users?.[0]?.name||"").toLowerCase().includes(q);
  });

  if (loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,color:C.muted}}>Loading…</div>;
  if (!user)   return <LoginScreen onLogin={setUser}/>;

  const TABS = [
    { id:"customers", label:"Customers" },
    { id:"plans",     label:"Plans & Packages" },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.light,fontFamily:F}}>
      {/* Header */}
      <div style={{background:C.navy,padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src="/Fingoh_Black.png" alt="Fingoh" style={{height:22,display:"block",filter:"brightness(0) invert(1)"}}/>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:500}}>Super Admin</span>
          </div>
          {/* Tab nav */}
          {!selOrg && (
            <div style={{display:"flex",gap:2}}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setActiveTab(t.id)}
                  style={{padding:"6px 16px",background:activeTab===t.id?"rgba(255,255,255,0.15)":"transparent",color:activeTab===t.id?"#fff":"rgba(255,255,255,0.5)",border:"none",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F,transition:"all .1s"}}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={()=>supabase.auth.signOut()}
          style={{padding:"6px 14px",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          Sign out
        </button>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
        {selOrg ? (
          <CustomerDetail orgId={selOrg.id} onBack={()=>setSelOrg(null)} planConfigs={planConfigs}/>
        ) : activeTab === "plans" ? (
          <PlansConfigScreen/>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:28}}>
                <StatCard val={stats.total_customers}  label="Total customers" color={C.navy}/>
                <StatCard val={stats.active_customers} label="Active"          color={C.green}/>
                <StatCard val={stats.total_users}      label="Total users"     color={C.blue}/>
                <StatCard val={stats.total_events}     label="Events created"  color={C.amber}/>
                <StatCard val={stats.total_contacts}   label="Total contacts"  color={C.purple}/>
              </div>
            )}

            {/* Expiring soon banner */}
            {customers.filter(c => c.subscription_expires_at && (new Date(c.subscription_expires_at) - Date.now()) < 30*86400000 && (new Date(c.subscription_expires_at) - Date.now()) > 0).length > 0 && (
              <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>⚠️</span>
                <span style={{fontSize:13,color:"#92400E",fontWeight:600}}>
                  {customers.filter(c => c.subscription_expires_at && (new Date(c.subscription_expires_at) - Date.now()) < 30*86400000 && (new Date(c.subscription_expires_at) - Date.now()) > 0).length} customer(s) expiring in the next 30 days
                </span>
              </div>
            )}

            {/* Customers table */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div>
                  <h2 style={{fontSize:15,fontWeight:700,color:C.navy,margin:0}}>Customers</h2>
                  <p style={{fontSize:11,color:C.muted,margin:0}}>{filteredCustomers.length} of {customers.length} organisations</p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flex:1,maxWidth:360}}>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search company, plan, admin…"
                    style={{flex:1,padding:"7px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:F,outline:"none"}}/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={loadData}
                    style={{padding:"7px 14px",background:C.white,color:C.navy,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                    ↻ Refresh
                  </button>
                  <button onClick={()=>setShowCreate(true)}
                    style={{padding:"7px 16px",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>
                    + New Customer
                  </button>
                </div>
              </div>
              <div style={{padding:"8px 20px",display:"grid",gridTemplateColumns:"2fr 1fr 90px 80px 110px 60px 160px",gap:12,background:"#F8FAFC",borderBottom:`1px solid ${C.border}`}}>
                {["Company","Admin","Plan","Status","Expires","Events","Actions"].map(h=>(
                  <div key={h} style={{fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase"}}>{h}</div>
                ))}
              </div>
              {dataLoading ? (
                <div style={{padding:40,textAlign:"center",color:C.muted,fontSize:13}}>
                  <div style={{width:24,height:24,border:`2px solid #E2E8F0`,borderTop:`2px solid ${C.navy}`,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/>
                  Loading customers…
                </div>
              ) : filteredCustomers.length===0 ? (
                <div style={{padding:40,textAlign:"center",color:C.muted,fontSize:13}}>
                  {search ? "No customers match your search." : "No customers yet — create your first one"}
                </div>
              ) : filteredCustomers.map(org=>(
                <CustomerRow key={org.id} org={org}
                  onSelect={setSelOrg}
                  onStatusChange={handleStatusChange}
                  onResetPassword={handleResetPassword}
                />
              ))}
            </div>

            {/* Plan distribution */}
            {stats && (
              <div style={{marginTop:16}}>
                <h3 style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.06,margin:"0 0 10px 0"}}>Plan distribution</h3>
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                  {planConfigs.filter(p=>p.is_active && !["starter","pro","enterprise"].includes(p.plan_id)).map(p=>{
                    const count = stats.plans?.[p.plan_id]||0;
                    const pc = PLAN_COLORS[p.plan_id]||PLAN_COLORS.trial;
                    return (
                      <div key={p.plan_id} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
                        <div style={{fontSize:22,fontWeight:800,color:pc.fg}}>{count}</div>
                        <div style={{fontSize:10,fontWeight:600,color:pc.fg,marginTop:2}}>{p.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateCustomerModal
          onClose={()=>setShowCreate(false)}
          onCreated={()=>{ loadData(); }}
          planConfigs={planConfigs}
        />
      )}

      {pwResult && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.white,borderRadius:14,padding:28,maxWidth:400,width:"100%"}}>
            <h3 style={{fontSize:15,fontWeight:700,color:C.navy,marginBottom:16}}>Password Reset</h3>
            <div style={{background:C.ltgrn,border:"1px solid #86EFAC",borderRadius:8,padding:16,marginBottom:16}}>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>New Password:</strong></p>
              <code style={{fontSize:16,fontWeight:700,color:"#14532D"}}>{pwResult.new_password}</code>
              <p style={{fontSize:11,color:C.red,margin:"8px 0 0 0",fontWeight:600}}>⚠ Save this — shown once only</p>
            </div>
            <button onClick={()=>setPwResult(null)}
              style={{width:"100%",padding:"10px 0",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
