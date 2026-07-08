import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";

const API = import.meta.env.VITE_API_URL;
const F   = "'Inter', -apple-system, sans-serif";
const C   = {
  navy:"#0D1B3E", blue:"#2563EB", green:"#16A34A", red:"#DC2626",
  amber:"#D97706", white:"#FFFFFF", light:"#F8FAFC", muted:"#94A3B8",
  dark:"#1E293B", border:"#E2E8F0", ltblue:"#EFF6FF", ltgrn:"#F0FDF4",
  ltred:"#FEF2F2", ltamber:"#FFFBEB",
};

const PLAN_COLORS = {
  trial:      {bg:"#F1F5F9", fg:"#475569"},
  starter:    {bg:"#EFF6FF", fg:"#1E3A8A"},
  pro:        {bg:"#F0FDF4", fg:"#14532D"},
  enterprise: {bg:"#FDF4FF", fg:"#581C87"},
};

const STATUS_COLORS = {
  active:    {bg:"#F0FDF4", fg:"#16A34A"},
  suspended: {bg:"#FEF3C7", fg:"#92400E"},
  cancelled: {bg:"#FEF2F2", fg:"#DC2626"},
};

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

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    // Verify super admin
    const { data: profile } = await supabase.from("profiles")
      .select("is_super_admin, role")
      .eq("id", data.user.id)
      .single();
    if (!profile?.is_super_admin) {
      await supabase.auth.signOut();
      setError("Access denied. Super admin only.");
      setLoading(false);
      return;
    }
    onLogin(data.user);
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#0D1B3E",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>
      <div style={{background:C.white,borderRadius:16,padding:40,width:380,boxShadow:"0 24px 80px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/Fingoh_Black.png" alt="Fingoh" style={{height:32,display:"block",margin:"0 auto 4px"}}/>
          <div style={{fontSize:12,color:C.muted,fontWeight:500}}>Super Admin Panel</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.08,display:"block",marginBottom:6}}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required
              style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.08,display:"block",marginBottom:6}}>Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required
              style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"}}/>
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

// ── Stats Card ────────────────────────────────────────────────────────────────
function StatCard({ val, label, color }) {
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 24px"}}>
      <div style={{fontSize:28,fontWeight:800,color:color||C.navy,letterSpacing:"-0.02em"}}>{val}</div>
      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{label}</div>
    </div>
  );
}

// ── Create Customer Modal ─────────────────────────────────────────────────────
function CreateCustomerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    company_name:"", slug:"", admin_email:"", admin_name:"",
    plan:"starter", max_events:3, admin_notes:"", subscription_expires_at:""
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");

  const iS = {width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"};
  const lS = {fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.08,display:"block",marginBottom:5};

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
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.white,borderRadius:16,padding:32,maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{fontSize:16,fontWeight:700,color:C.navy,margin:0}}>Create New Customer</h2>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.muted}}>✕</button>
        </div>

        {result ? (
          <div>
            <div style={{background:C.ltgrn,border:"1px solid #86EFAC",borderRadius:10,padding:20,marginBottom:20}}>
              <p style={{fontSize:14,fontWeight:700,color:"#14532D",margin:"0 0 12px 0"}}>✓ Customer created successfully!</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Company:</strong> {form.company_name}</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Login Email:</strong> {result.email}</p>
              <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Password:</strong> <code style={{background:"#DCFCE7",padding:"2px 6px",borderRadius:4}}>{result.password}</code></p>
              <p style={{fontSize:11,color:"#DC2626",margin:"8px 0 0 0",fontWeight:600}}>⚠ Save this password — it won't be shown again</p>
            </div>
            <button onClick={onClose} style={{width:"100%",padding:"10px 0",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>
              Done
            </button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={lS}>Company Name *</label><input value={form.company_name} onChange={e=>setForm(p=>({...p,company_name:e.target.value,slug:e.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}))} style={iS} placeholder="Acme Corp"/></div>
              <div><label style={lS}>Slug *</label><input value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))} style={iS} placeholder="acme-corp"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={lS}>Admin Name *</label><input value={form.admin_name} onChange={e=>setForm(p=>({...p,admin_name:e.target.value}))} style={iS} placeholder="John Smith"/></div>
              <div><label style={lS}>Admin Email *</label><input value={form.admin_email} onChange={e=>setForm(p=>({...p,admin_email:e.target.value}))} type="email" style={iS} placeholder="john@acme.com"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <div>
                <label style={lS}>Plan</label>
                <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))} style={iS}>
                  {["trial","starter","pro","enterprise"].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label style={lS}>Max Events</label><input value={form.max_events} onChange={e=>setForm(p=>({...p,max_events:e.target.value}))} type="number" min="1" style={iS}/></div>
              <div><label style={lS}>Expires</label><input value={form.subscription_expires_at} onChange={e=>setForm(p=>({...p,subscription_expires_at:e.target.value}))} type="date" style={iS}/></div>
            </div>
            <div><label style={lS}>Admin Notes</label><textarea value={form.admin_notes} onChange={e=>setForm(p=>({...p,admin_notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}} placeholder="Internal notes…"/></div>
            {error && <p style={{fontSize:12,color:C.red,margin:0}}>{error}</p>}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={onClose} style={{flex:1,padding:"10px 0",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:F}}>Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                style={{flex:2,padding:"10px 0",background:loading?"#CBD5E1":C.navy,color:C.white,border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:F}}>
                {loading?"Creating…":"Create Customer"}
              </button>
            </div>
          </div>
        )}
      </div>
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

  return (
    <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"2fr 1fr 80px 80px 100px 60px 160px",gap:12,alignItems:"center",background:C.white,cursor:"pointer"}}
      onClick={()=>onSelect(org)}>
      <div>
        <p style={{fontSize:13,fontWeight:600,color:C.navy,margin:0}}>{org.name}</p>
        <p style={{fontSize:11,color:C.muted,margin:0}}>{org.slug} · {org.users?.[0]?.name||"—"}</p>
      </div>
      <div style={{fontSize:11,color:C.muted}}>{org.users?.[0] ? org.users[0].name : "—"}</div>
      <div style={{textAlign:"center"}}>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:pc.bg,color:pc.fg,fontWeight:700}}>{org.plan}</span>
      </div>
      <div style={{textAlign:"center"}}>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:sc.bg,color:sc.fg,fontWeight:700}}>{org.status}</span>
      </div>
      <div style={{textAlign:"center",fontSize:11,color:C.muted}}>{expires}</div>
      <div style={{textAlign:"center"}}>
        <span style={{fontSize:12,fontWeight:600,color:C.navy}}>{org.event_count||0}</span>
        <span style={{fontSize:10,color:C.muted}}> events</span>
      </div>
      <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
        <select value={org.status} onChange={e=>onStatusChange(org.id, e.target.value)}
          style={{padding:"4px 6px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontFamily:F,cursor:"pointer"}}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={async()=>{ setResetting(true); await onResetPassword(org.id); setResetting(false); }}
          disabled={resetting}
          style={{padding:"4px 8px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:F,whiteSpace:"nowrap"}}>
          {resetting?"…":"Reset PW"}
        </button>
      </div>
    </div>
  );
}
// ── Customer Detail View ──────────────────────────────────────────────────────
function CustomerDetail({ orgId, onBack }) {
  const [org, setOrg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({name:"",email:"",role:"user",title:""});
  const [addingUser, setAddingUser]   = useState(false);
  const [addUserResult, setAddUserResult] = useState(null);

  useEffect(()=>{
    apiCall(`/admin/customers/${orgId}`).then(data=>{
      setOrg(data);
      setForm({
        plan: data.plan||"starter",
        max_events: data.max_events||3,
        status: data.status||"active",
        subscription_expires_at: data.subscription_expires_at?.slice(0,10)||"",
        admin_notes: data.admin_notes||"",
      });
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[orgId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall(`/admin/customers/${orgId}`, {
        method:"PATCH", body:JSON.stringify(form)
      });
      setEditing(false);
      const data = await apiCall(`/admin/customers/${orgId}`);
      setOrg(data);
    } catch(e) { alert("Failed: "+e.message); }
    setSaving(false);
  };

  if (loading) return <div style={{padding:40,textAlign:"center",color:C.muted,fontFamily:F}}>Loading…</div>;
  if (!org)    return <div style={{padding:40,textAlign:"center",color:C.red,fontFamily:F}}>Customer not found</div>;

  const iS = {width:"100%",padding:"8px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,fontFamily:F,outline:"none",boxSizing:"border-box"};
  const lS = {fontSize:10,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:.08,display:"block",marginBottom:5};
  const pc = PLAN_COLORS[org.plan]||PLAN_COLORS.trial;
  const sc = STATUS_COLORS[org.status]||STATUS_COLORS.active;

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
        {/* Subscription card */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:14,fontWeight:700,color:C.navy,margin:0}}>Subscription</h3>
            {!editing
              ? <button onClick={()=>setEditing(true)} style={{padding:"5px 12px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>Edit</button>
              : <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setEditing(false)} style={{padding:"5px 12px",background:C.white,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={{padding:"5px 12px",background:C.navy,color:C.white,border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>{saving?"Saving…":"Save"}</button>
                </div>
            }
          </div>
          {editing ? (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={lS}>Plan</label>
                  <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))} style={iS}>
                    {["trial","starter","pro","enterprise"].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lS}>Status</label>
                  <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={iS}>
                    {["active","suspended","cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={lS}>Max Events</label><input type="number" value={form.max_events} onChange={e=>setForm(p=>({...p,max_events:parseInt(e.target.value)}))} style={iS}/></div>
                <div><label style={lS}>Expires</label><input type="date" value={form.subscription_expires_at} onChange={e=>setForm(p=>({...p,subscription_expires_at:e.target.value}))} style={iS}/></div>
              </div>
              <div><label style={lS}>Admin Notes</label><textarea value={form.admin_notes} onChange={e=>setForm(p=>({...p,admin_notes:e.target.value}))} rows={2} style={{...iS,resize:"vertical"}}/></div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
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
          )}
        </div>

             {/* Users card */}
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
                <button
                  onClick={async()=>{
                    if (!window.confirm(`Reset password for ${u.name}?`)) return;
                    try {
                      const data = await apiCall(`/admin/customers/${orgId}/reset-password`,{method:"POST"});
                      alert(`New password: ${data.new_password}\n\nSave this — shown once only.`);
                    } catch(e){ alert("Failed: "+e.message); }
                  }}
                  style={{padding:"5px 12px",background:C.ltblue,color:C.blue,border:`1px solid #BFDBFE`,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                  Reset PW
                </button>
                <button
                  onClick={async()=>{
                    if (!window.confirm(`Delete user ${u.name}? This cannot be undone.`)) return;
                    try {
                      await apiCall(`/admin/customers/${orgId}/users/${u.id}`,{method:"DELETE"});
                      const data = await apiCall(`/admin/customers/${orgId}`);
                      setOrg(data);
                    } catch(e){ alert("Failed: "+e.message); }
                  }}
                  style={{padding:"5px 12px",background:"#FEF2F2",color:C.red,border:"1px solid #FECACA",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
                  Delete
                </button>
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
          : <div style={{display:"flex",flexDirection:"column",gap:0}}>
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
        {/* Delete Customer */}
      <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:24,marginTop:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.red,margin:"0 0 8px 0"}}>Danger Zone</h3>
        <p style={{fontSize:12,color:"#991B1B",margin:"0 0 16px 0",lineHeight:1.6}}>
          Deleting this customer will permanently remove the organisation, all users, all events, all contacts, 
          all meeting requests, all conversation signals and all CRM connections. <strong>This action cannot be undone.</strong>
        </p>
        <button
          onClick={async()=>{
            const confirmed = window.confirm(
              `Are you sure you want to delete "${org.name}"?\n\nThis will permanently delete:\n• All users\n• All events (${org.events?.length||0})\n• All contacts and meetings\n\nThis cannot be undone.`
            );
            if (!confirmed) return;
            const doubleConfirm = window.confirm(`Type OK to confirm deletion of "${org.name}"`);
            if (!doubleConfirm) return;
            try {
              await apiCall(`/admin/customers/${orgId}`, {method:"DELETE"});
              alert(`"${org.name}" has been deleted.`);
              onBack();
              window.location.reload();
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
              <button onClick={()=>{setShowAddUser(false);setAddUserResult(null);setAddUserForm({name:"",email:"",role:"user",title:""});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.muted}}>✕</button>
            </div>
            {addUserResult ? (
              <div>
                <div style={{background:C.ltgrn,border:"1px solid #86EFAC",borderRadius:8,padding:16,marginBottom:16}}>
                  <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Email:</strong> {addUserResult.email}</p>
                  <p style={{fontSize:12,color:"#166534",margin:"4px 0"}}><strong>Password:</strong> <code style={{background:"#DCFCE7",padding:"2px 6px",borderRadius:4}}>{addUserResult.password}</code></p>
                  <p style={{fontSize:11,color:C.red,margin:"8px 0 0 0",fontWeight:600}}>⚠ Save this password — shown once only</p>
                </div>
                <button onClick={()=>{
                  setShowAddUser(false);setAddUserResult(null);
                  setAddUserForm({name:"",email:"",role:"user",title:""});
                  apiCall(`/admin/customers/${orgId}`).then(data=>setOrg(data));
                }} style={{width:"100%",padding:"10px 0",background:C.navy,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>Done</button>
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
                        const data = await apiCall(`/admin/customers/${orgId}/users`,{
                          method:"POST", body:JSON.stringify(addUserForm)
                        });
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
      )}</div>
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
  const [showCreate, setShowCreate] = useState(false);
  const [selOrg, setSelOrg]       = useState(null);
  const [pwResult, setPwResult]   = useState(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if (session?.user) setUser(session.user);
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user || null);
    });
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
      const [s, c] = await Promise.all([
        apiCall("/admin/stats"),
        apiCall("/admin/customers"),
      ]);
      setStats(s);
      setCustomers(c);
    } catch(e) {
      console.error("Load failed:", e);
    }
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

  if (loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,color:C.muted}}>Loading…</div>;
  if (!user)   return <LoginScreen onLogin={setUser}/>;

  return (
    <div style={{minHeight:"100vh",background:C.light,fontFamily:F}}>
      {/* Header */}
      <div style={{background:C.navy,padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <img src="/Fingoh_Black.png" alt="Fingoh" style={{height:22,display:"block",filter:"brightness(0) invert(1)"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:500}}>Super Admin</span>
        </div>
        <button onClick={()=>supabase.auth.signOut()}
          style={{padding:"6px 14px",background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F}}>
          Sign out
        </button>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
        {selOrg ? (
          <CustomerDetail orgId={selOrg.id} onBack={()=>setSelOrg(null)}/>
        ) : (<>
        {/* Stats */}
        {stats && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:28}}>
            <StatCard val={stats.total_customers}  label="Total customers" color={C.navy}/>
            <StatCard val={stats.active_customers} label="Active"          color={C.green}/>
            <StatCard val={stats.total_users}      label="Total users"     color={C.blue}/>
            <StatCard val={stats.total_events}     label="Events created"  color={C.amber}/>
            <StatCard val={stats.total_contacts}   label="Total contacts"  color="#8B5CF6"/>
          </div>
        )}

        {/* Customers table */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <h2 style={{fontSize:15,fontWeight:700,color:C.navy,margin:0}}>Customers</h2>
              <p style={{fontSize:11,color:C.muted,margin:0}}>{customers.length} organisations</p>
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
          {/* Table header */}
          <div style={{padding:"8px 20px",display:"grid",gridTemplateColumns:"2fr 1fr 80px 80px 100px 60px 160px",gap:12,background:"#F8FAFC",borderBottom:`1px solid ${C.border}`}}>
            {["Company","Admin","Plan","Status","Expires","Events","Actions"].map(h=>(
              <div key={h} style={{fontSize:10,fontWeight:600,color:C.muted,textAlign:["Events"].includes(h)?"center":"left"}}>{h}</div>
            ))}
          </div>
          {dataLoading ? (
            <div style={{padding:40,textAlign:"center",color:C.muted,fontSize:13}}>
              <div style={{width:24,height:24,border:`2px solid #E2E8F0`,borderTop:`2px solid ${C.navy}`,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/>
              Loading customers…
            </div>
          ) : customers.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:C.muted,fontSize:13}}>No customers yet — create your first one</div>
          ) : customers.map(org=>(
            <CustomerRow key={org.id} org={org}
              onSelect={setSelOrg}
              onStatusChange={handleStatusChange}
              onResetPassword={handleResetPassword}
            />
          ))}
        </div>

        {/* Plan breakdown */}
        {stats && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16}}>
            {Object.entries(stats.plans).map(([plan,count])=>{
              const pc = PLAN_COLORS[plan]||PLAN_COLORS.trial;
              return (
                <div key={plan} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.dark,textTransform:"capitalize",fontWeight:500}}>{plan}</span>
                  <span style={{fontSize:14,fontWeight:700,padding:"3px 10px",borderRadius:99,background:pc.bg,color:pc.fg}}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
        </>)}
      </div>
       {/* Modals */}
      {showCreate && (
        <CreateCustomerModal
          onClose={()=>setShowCreate(false)}
          onCreated={()=>{ loadData(); }}
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
