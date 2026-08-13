// src/CreateOrganiser.jsx
import { useState } from "react";

const F = "'Inter', -apple-system, sans-serif";
const C = {
  navy:"#0D1B3E", blue:"#2563EB", green:"#16A34A", red:"#DC2626",
  white:"#FFFFFF", light:"#F8FAFC", muted:"#94A3B8",
  dark:"#1E293B", border:"#E2E8F0",
};
const iS = { width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:F, outline:"none", boxSizing:"border-box" };
const lS = { fontSize:10, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:.08, display:"block", marginBottom:5 };

export default function CreateOrganiser({ onBack, apiCall }) {
  const [form, setForm] = useState({
    name: "",
    contact_email: "",
    logo_url: "",
    exhibitor_quota: 10,
    data_quota: 1000,
    admin_email: "",
    admin_password: "",
    admin_full_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.contact_email || !form.admin_email || !form.admin_password || !form.admin_full_name) {
      setError("Please fill all required fields"); return;
    }
    setLoading(true); setError(null);
    try {
      const ADMIN_KEY = import.meta.env.VITE_ADMIN_INTERNAL_KEY;
      const API       = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API}/organiser/admin/create-organiser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fingoh-admin-key": ADMIN_KEY,
        },
        body: JSON.stringify({
          ...form,
          exhibitor_quota: parseInt(form.exhibitor_quota) || 10,
          data_quota:      parseInt(form.data_quota) || 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create organiser");
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: F }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <button onClick={onBack}
          style={{ padding:"7px 14px", background:C.white, color:C.navy, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:F }}>
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.navy, margin:0, letterSpacing:"-0.02em" }}>Create Organiser Account</h1>
          <p style={{ fontSize:12, color:C.muted, margin:0 }}>Provision a new organiser with their login credentials</p>
        </div>
      </div>

      <div style={{ maxWidth:600 }}>
        {result ? (
          <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:28 }}>
            <div style={{ background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:10, padding:20, marginBottom:20 }}>
              <p style={{ fontSize:14, fontWeight:700, color:"#14532D", margin:"0 0 12px" }}>✓ Organiser created successfully</p>
              <p style={{ fontSize:12, color:"#166534", margin:"4px 0" }}><strong>Organiser ID:</strong> {result.organiser_id}</p>
              <p style={{ fontSize:12, color:"#166534", margin:"4px 0" }}><strong>Login Email:</strong> {result.login_email}</p>
              <p style={{ fontSize:11, color:C.muted, margin:"10px 0 0" }}>Share the login email and password (set during creation) with the organiser. They can log in at the organiser portal once it's live.</p>
            </div>
            <button onClick={onBack}
              style={{ width:"100%", padding:"11px 0", background:C.navy, color:C.white, border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:F }}>
              Done
            </button>
          </div>
        ) : (
          <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:28 }}>

            {/* Section: Organiser Details */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", marginBottom:14, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
                Organiser Details
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={lS}>Organisation Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} style={iS} placeholder="e.g. Reed Exhibitions India"/>
                </div>
                <div>
                  <label style={lS}>Contact Email *</label>
                  <input value={form.contact_email} onChange={e => set("contact_email", e.target.value)} type="email" style={iS} placeholder="contact@organiser.com"/>
                </div>
                <div>
                  <label style={lS}>Logo URL (optional)</label>
                  <input value={form.logo_url} onChange={e => set("logo_url", e.target.value)} style={iS} placeholder="https://…/logo.png"/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={lS}>Exhibitor Quota *</label>
                    <input value={form.exhibitor_quota} onChange={e => set("exhibitor_quota", e.target.value)} type="number" min="1" style={iS}/>
                    <p style={{ fontSize:10, color:C.muted, margin:"4px 0 0" }}>Max exhibitors allowed</p>
                  </div>
                  <div>
                    <label style={lS}>Data Quota (rows) *</label>
                    <input value={form.data_quota} onChange={e => set("data_quota", e.target.value)} type="number" min="1" style={iS}/>
                    <p style={{ fontSize:10, color:C.muted, margin:"4px 0 0" }}>Total visitor rows across all exhibitors</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Admin Login */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", marginBottom:14, paddingBottom:8, borderBottom:`1px solid ${C.border}` }}>
                Admin Login Credentials
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={lS}>Full Name *</label>
                  <input value={form.admin_full_name} onChange={e => set("admin_full_name", e.target.value)} style={iS} placeholder="Jane Smith"/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={lS}>Login Email *</label>
                    <input value={form.admin_email} onChange={e => set("admin_email", e.target.value)} type="email" style={iS} placeholder="jane@organiser.com"/>
                  </div>
                  <div>
                    <label style={lS}>Password *</label>
                    <input value={form.admin_password} onChange={e => set("admin_password", e.target.value)} type="password" style={iS} placeholder="Min 8 characters"/>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ fontSize:12, color:C.red, marginBottom:16, padding:"10px 12px", background:"#FEF2F2", borderRadius:8, border:"1px solid #FECACA" }}>
                {error}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onBack}
                style={{ flex:1, padding:"11px 0", background:C.white, color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:F }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex:2, padding:"11px 0", background:loading?"#CBD5E1":C.navy, color:C.white, border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:F }}>
                {loading ? "Creating…" : "Create Organiser Account →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}