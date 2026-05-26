import { useState, useEffect, useRef, useMemo, useCallback, Component } from "react";
import {
  Scene, PerspectiveCamera, WebGLRenderer,
  AmbientLight, DirectionalLight, Group,
  SphereGeometry, CylinderGeometry, MeshStandardMaterial,
  Mesh, Vector3
} from "three";
import { SCI } from "./sciverse-data";

/* ═══════════════════════════════════════════════════════════════
   ANCIENTQ — Ancient Principles, Quantum Frontiers
   Educational simulations. Physics constants from NIST/CODATA 2018.
   All speculative claims marked as estimates. No data collection.
   ═══════════════════════════════════════════════════════════════ */

// ── Physics constants (NIST/CODATA 2018) ──
const PHYS = {
  hbar: 1.054571817e-34,       // Reduced Planck J·s
  kB:   1.380649e-23,           // Boltzmann J/K
  c:    299792458,              // Speed of light m/s
  mRb87: 1.44316060e-25,        // Rb-87 mass kg
  g:    9.80665,                // Std gravity m/s²
  // Rb-87 D2 line wavelength 780.241 nm → k_eff = 2×(2π/λ)
  kEffRb: 2 * (2 * Math.PI / 780.241e-9),  // ≈ 1.612e7 m⁻¹
};

// ── Color & font tokens ──
const C = {
  bg:"#060710", bg2:"#0C0E16", bg3:"#13161F",
  gold:"#D4A843", goldDim:"#8B6914", goldBr:"#F0D060",
  cyan:"#00E5FF", purple:"#9D6BFF", pink:"#FF4D8D",
  green:"#00E09E", orange:"#FF9D2E", red:"#FF4D4D",
  text:"#D8D0C4", dim:"#8A7F73", muted:"#3D3630",
};
const F = {
  t:"'Palatino Linotype','Book Antiqua',serif",
  b:"'Georgia',serif",
  m:"'Courier New',monospace",
  u:"system-ui,-apple-system,sans-serif"
};

// ── Safe numeric helpers (avoid NaN/Infinity propagation) ──
const safe = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ── High-DPI canvas setup (handles 1x, 1.5x, 2x, 3x DPR) ──
function setupCanvas(canvas) {
  if (!canvas) return null;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width || canvas.offsetWidth);
  const cssH = Math.max(1, parseFloat(canvas.style.height) || canvas.offsetHeight);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: cssW, H: cssH, dpr };
}


// ── DeepScience component — renders enriched content under each simulation ──
function DeepScience({ moduleKey }) {
  const topics = (SCI && SCI[moduleKey]) || [];
  const [openIdx, setOpenIdx] = useState(null);
  if (!topics.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        fontFamily: F.u, fontSize: 10, letterSpacing: ".3em",
        textTransform: "uppercase", color: C.gold, marginBottom: 10,
        paddingBottom: 6, borderBottom: `1px solid ${C.gold}25`
      }}>
        ▽ Deeper Science
      </div>
      {topics.map((t, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} style={{
            marginBottom: 10, background: `${C.bg2}`,
            border: `1px solid ${C.muted}`, borderRadius: 8, overflow: "hidden"
          }}>
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{
                width: "100%", padding: "12px 16px", textAlign: "left",
                background: "transparent", border: "none", cursor: "pointer",
                color: C.text, fontFamily: F.t, fontSize: 14, fontWeight: 600,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                minHeight: 44
              }}
            >
              <span>
                <span style={{ color: C.gold }}>{isOpen ? "−" : "+"}</span> {t.title}
                {t.sub && <span style={{
                  display: "block", fontFamily: F.u, fontSize: 11,
                  color: C.dim, fontWeight: 400, marginTop: 2
                }}>{t.sub}</span>}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                {t.paragraphs && t.paragraphs.map((p, pi) => (
                  <p key={`p${pi}`} style={{
                    fontFamily: F.b, fontSize: 13, lineHeight: 1.7,
                    color: C.text, marginBottom: 10, textAlign: "justify"
                  }}>{p}</p>
                ))}
                {t.theses && t.theses.length > 0 && (
                  <ul style={{
                    listStyle: "none", padding: 0, margin: "8px 0 0",
                    fontFamily: F.u, fontSize: 12, color: C.dim, lineHeight: 1.7
                  }}>
                    {t.theses.map((th, ti) => (
                      <li key={`th${ti}`} style={{
                        paddingLeft: 14, marginBottom: 6, position: "relative"
                      }}>
                        <span style={{
                          position: "absolute", left: 0, color: C.cyan
                        }}>•</span> {th}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div style={{
        marginTop: 12, padding: "10px 14px",
        background: `${C.gold}05`, border: `1px solid ${C.gold}15`,
        borderRadius: 6, fontFamily: F.u, fontSize: 10,
        color: C.dim, lineHeight: 1.7
      }}>
        Content adapted from Sciverse (33,603-topic interactive science encyclopedia) for educational purposes.
        Mentions of specific companies, products, individuals, or institutions appear in factual academic context only —
        no endorsement, affiliation, or sponsorship is implied. For original sources and peer-reviewed DOIs, see the References tab.
      </div>
    </div>
  );
}

// ── Visibility-aware animation using the latest-callback-ref pattern ──
// This prevents the RAF loop from restarting on every render while still
// giving the callback access to the latest state/props (no stale closures).
// Also respects prefers-reduced-motion and pauses when document is hidden.
function useAnimationFrame(callback) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    let rafId = 0;
    let active = true;
    const reduced = typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      if (!active) return;
      if (!document.hidden && typeof cbRef.current === "function") {
        try { cbRef.current(); } catch (e) { /* swallow per-frame errors */ }
      }
      rafId = requestAnimationFrame(tick);
    };
    // Reduced motion: still call once for a static frame, do not animate
    if (reduced) {
      if (typeof cbRef.current === "function") {
        try { cbRef.current(); } catch (e) {}
      }
      return () => {};
    }
    rafId = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(rafId); };
  }, []);
}

// ── ErrorBoundary: isolates module crashes so the whole app never goes blank ──
class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {
    // Deliberately no logging — respects privacy policy (zero telemetry)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20, borderRadius: 12,
          background: "rgba(255,77,77,0.08)",
          border: "1px solid rgba(255,77,77,0.25)",
          color: "#FF8888", fontFamily: "system-ui,sans-serif",
          fontSize: 13, lineHeight: 1.6
        }}>
          <strong>This module hit an unexpected error.</strong>
          <div style={{ marginTop: 8, fontSize: 12, color: "#8A7F73" }}>
            Try switching to another tab and coming back, or reload the app.
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 12, padding: "8px 14px",
              background: "rgba(255,77,77,0.12)",
              border: "1px solid rgba(255,77,77,0.35)",
              borderRadius: 6, color: "#FF8888", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12
            }}
          >↺ Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Shared UI primitives ──
function Btn({ children, onClick, disabled, color = C.gold, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      style={{
        padding:"10px 18px", borderRadius:8,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? `${C.muted}40` : `${color}15`,
        border: `1px solid ${disabled ? C.muted : color}40`,
        color: disabled ? C.muted : color,
        fontFamily: F.u, fontSize: 13, fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        minHeight: 44, // touch target
      }}
    >{children}</button>
  );
}

function Stat({ label, value, color = C.cyan, sub }) {
  return (
    <div style={{
      flex:1, minWidth:110, padding:"12px 8px",
      background:`${color}08`, border:`1px solid ${color}18`,
      borderRadius:8, textAlign:"center"
    }}>
      <div style={{ fontFamily:F.m, fontSize:17, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontFamily:F.m, fontSize:9, color:C.muted, marginTop:2 }}>{sub}</div>}
      <div style={{ fontFamily:F.u, fontSize:10, color:C.dim, marginTop:4 }}>{label}</div>
    </div>
  );
}

function Formula({ label, children }) {
  return (
    <div style={{
      background:`${C.cyan}06`, border:`1px solid ${C.cyan}15`,
      borderLeft:`3px solid ${C.cyan}`,
      padding:"14px 18px", margin:"16px 0", borderRadius:"0 8px 8px 0",
      fontFamily:F.m, fontSize:12, color:C.cyan,
      lineHeight:1.8, overflowX:"auto", whiteSpace:"pre-wrap"
    }}>
      {label && <span style={{
        fontFamily:F.u, fontSize:9, letterSpacing:".2em",
        textTransform:"uppercase", color:C.dim, display:"block", marginBottom:6
      }}>{label}</span>}
      {children}
    </div>
  );
}

function Disclaimer({ children }) {
  return (
    <div style={{
      margin:"12px 0", padding:"10px 14px",
      background:`${C.orange}08`, border:`1px solid ${C.orange}22`,
      borderLeft:`3px solid ${C.orange}`, borderRadius:"0 6px 6px 0",
      fontFamily:F.u, fontSize:11, color:C.orange, lineHeight:1.6
    }}>
      <strong>⚠ Educational Estimate:</strong> {children}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, color = C.cyan }) {
  const safeValue = Number.isFinite(value) ? value : (Number.isFinite(min) ? min : 0);
  return (
    <div>
      <label style={{ fontFamily:F.m, fontSize:11, color, display:"block", marginBottom:4 }}>
        {label}
      </label>
      <input
        type="range" min={min} max={max} step={step} value={safeValue}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && typeof onChange === "function") onChange(v);
        }}
        aria-label={label}
        style={{ width:"100%", accentColor:color, minHeight:28 }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 1. CONCRETE SELF-HEALING LAB
// ═══════════════════════════════════════════════════
function ConcreteSimulation() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    particles: [], cracks: [], healing: [], healingPool: [],
    time: 0, phase: "intact", healed: 0, bgSpots: null
  });
  const [phase, setPhase] = useState("intact");
  const [healedPct, setHealedPct] = useState(0);

  // One-time setup of particles (stable across renders)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { W, H } = setup;
    const s = stateRef.current;
    s.particles = [];
    // Lime clasts
    for (let i = 0; i < 30; i++) {
      s.particles.push({
        x: 60 + Math.random() * (W - 120),
        y: 60 + Math.random() * (H - 120),
        r: 6 + Math.random() * 10,
        opacity: 0.9, dissolved: 0, type: "clast",
      });
    }
    // Aggregates
    for (let i = 0; i < 15; i++) {
      s.particles.push({
        x: 40 + Math.random() * (W - 80),
        y: 40 + Math.random() * (H - 80),
        r: 10 + Math.random() * 18,
        opacity: 0.6, type: "agg",
        color: ["#7A6B5A","#6B5D4C","#8B7D6C"][i % 3]
      });
    }
    // Pre-compute static background spots (perf)
    s.bgSpots = [];
    for (let i = 0; i < 150; i++) {
      s.bgSpots.push({
        x: 20 + Math.random() * (W - 40),
        y: 20 + Math.random() * (H - 40),
        size: 1.5 + Math.random() * 3,
        alpha: 0.2 + Math.random() * 0.3,
      });
    }
    // Pre-allocate healing pool (avoid GC pressure)
    for (let i = 0; i < 200; i++) {
      s.healingPool.push({ x:0, y:0, vx:0, vy:0, life:0, active:false });
    }
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W < 10 || H < 10) return;
    const s = stateRef.current;
    s.time += 0.016;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#5C5346";
    ctx.fillRect(20, 20, W - 40, H - 40);

    // Static bg spots
    if (s.bgSpots) {
      for (let i = 0; i < s.bgSpots.length; i++) {
        const b = s.bgSpots[i];
        ctx.fillStyle = `rgba(90,80,65,${b.alpha})`;
        ctx.fillRect(b.x, b.y, b.size, b.size);
      }
    }

    // Aggregates
    for (let i = 0; i < s.particles.length; i++) {
      const p = s.particles[i];
      if (p.type !== "agg") continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Lime clasts
    const pulse = Math.sin(s.time * 2) * 0.15;
    for (let i = 0; i < s.particles.length; i++) {
      const p = s.particles[i];
      if (p.type !== "clast") continue;
      const rr = p.r * (1 - p.dissolved);
      if (rr <= 0) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      grad.addColorStop(0, `rgba(245,240,224,${(p.opacity - p.dissolved) * 0.9 + pulse})`);
      grad.addColorStop(1, `rgba(210,195,160,${(p.opacity - p.dissolved) * 0.5})`);
      ctx.fillStyle = grad;
      ctx.fill();
      if (p.dissolved > 0 && p.dissolved < 0.95) {
        ctx.strokeStyle = `rgba(0,229,255,${0.3 + pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Cracks
    for (let c = 0; c < s.cracks.length; c++) {
      const crack = s.cracks[c];
      ctx.beginPath();
      ctx.moveTo(crack[0].x, crack[0].y);
      for (let j = 1; j < crack.length; j++) ctx.lineTo(crack[j].x, crack[j].y);
      ctx.strokeStyle = s.phase === "healed" ? "rgba(0,229,255,0.2)" : "rgba(30,20,10,0.9)";
      ctx.lineWidth = s.phase === "healed" ? 1 : 3;
      ctx.stroke();
      if (s.phase === "water" || s.phase === "healing") {
        ctx.strokeStyle = `rgba(80,140,220,${0.3 + Math.sin(s.time * 3) * 0.2})`;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }

    // Healing particles (from pool)
    for (let i = 0; i < s.healingPool.length; i++) {
      const h = s.healingPool[i];
      if (!h.active) continue;
      h.life -= 0.005;
      h.x += h.vx; h.y += h.vy;
      h.vx *= 0.98; h.vy *= 0.98;
      if (h.life <= 0) { h.active = false; continue; }
      ctx.beginPath();
      ctx.arc(h.x, h.y, 3 + h.life * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${h.life * 0.8})`;
      ctx.fill();
    }

    // Healing logic
    if (s.phase === "healing") {
      for (let c = 0; c < s.cracks.length; c++) {
        const crack = s.cracks[c];
        for (let j = 0; j < crack.length; j += 2) { // skip points for perf
          const pt = crack[j];
          for (let i = 0; i < s.particles.length; i++) {
            const p = s.particles[i];
            if (p.type !== "clast" || p.dissolved >= 0.95) continue;
            const dx = p.x - pt.x, dy = p.y - pt.y;
            if (dx * dx + dy * dy < 3600) { // 60² (no sqrt)
              p.dissolved += 0.002;
              if (Math.random() < 0.1) {
                // Reuse pool slot
                for (let k = 0; k < s.healingPool.length; k++) {
                  const h = s.healingPool[k];
                  if (!h.active) {
                    h.x = p.x; h.y = p.y;
                    h.vx = (pt.x - p.x) * 0.02;
                    h.vy = (pt.y - p.y) * 0.02;
                    h.life = 1; h.active = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      // Count dissolved
      let totalDiss = 0, count = 0;
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        if (p.type === "clast" && p.dissolved > 0) {
          totalDiss += p.dissolved; count++;
        }
      }
      const avg = count ? totalDiss / count : 0;
      const pct = Math.min(100, Math.round(avg * 110));
      if (pct !== s.healed) {
        s.healed = pct;
        setHealedPct(pct);
      }
      if (avg > 0.9 && s.phase !== "healed") {
        s.phase = "healed";
        setPhase("healed");
      }
    }

    // Status label
    ctx.font = `16px ${F.u}`;
    ctx.fillStyle = C.gold;
    ctx.textAlign = "left";
    const labels = {
      intact: "INTACT — Tap/click to create a crack",
      cracked: "CRACKED — Add water to begin",
      water: "WATER ENTERING — Activate healing",
      healing: `Ca²⁺ → CaCO₃ crystallizing: ${s.healed}%`,
      healed: "SEALED ✓ Crack healed by CaCO₃"
    };
    ctx.fillText(labels[s.phase] || "", 30, H - 20);
  }, []);

  const handleClick = useCallback((e) => {
    const s = stateRef.current;
    if (s.phase !== "intact") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const x = (e.clientX - rect.left) * (canvas.width / dpr / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / dpr / rect.height);
    const crack = [];
    let cx = Math.max(40, x - 100), cy = y;
    for (let i = 0; i < 25; i++) {
      cx += 8;
      cy += (Math.random() - 0.5) * 10;
      crack.push({ x: cx, y: cy });
    }
    s.cracks.push(crack);
    s.phase = "cracked";
    setPhase("cracked");
  }, []);

  const addWater = () => { stateRef.current.phase = "water"; setPhase("water"); };
  const activateHealing = () => { stateRef.current.phase = "healing"; setPhase("healing"); };
  const reset = () => {
    const s = stateRef.current;
    s.cracks = []; s.phase = "intact"; s.healed = 0;
    for (let i = 0; i < s.particles.length; i++) {
      if (s.particles[i].type === "clast") s.particles[i].dissolved = 0;
    }
    for (let i = 0; i < s.healingPool.length; i++) s.healingPool[i].active = false;
    setPhase("intact");
    setHealedPct(0);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        role="img"
        aria-label="Interactive Roman concrete cross-section. Click to create a crack, then trigger self-healing."
        style={{
          width:"100%", height:320, borderRadius:12,
          cursor: phase === "intact" ? "crosshair" : "default",
          background:"#3D3630", display:"block", touchAction:"manipulation"
        }}
      />
      <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
        <Btn disabled={phase !== "cracked"} onClick={addWater} color={C.cyan}>💧 Add Water</Btn>
        <Btn disabled={phase !== "water"} onClick={activateHealing} color={C.green}>⚗️ Activate Lime Clasts</Btn>
        <Btn onClick={reset} color={C.dim}>↺ Reset</Btn>
      </div>
      <Formula label="Reaction Sequence">{`CaO + H₂O → Ca(OH)₂   (ΔH ≈ −65 kJ/mol; "hot mixing" produces local T > 200°C)
Ca(OH)₂ → Ca²⁺ + 2 OH⁻  (lime clast dissolves where crack-water arrives)
Ca²⁺ + CO₂(aq) + H₂O → CaCO₃↓   (precipitates in crack)
Lab observation: measurable resealing in ~2 weeks (Seymour et al., 2023)`}</Formula>
      <Disclaimer>
        Visualization is pedagogical. Real lime-clast distribution, crack propagation,
        and healing timescales vary with mix composition, temperature, and humidity.
      </Disclaimer>
      <DeepScience moduleKey="concrete" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 2. TESLA / SCHUMANN CAVITY
// ═══════════════════════════════════════════════════
const SCHUMANN = [7.83, 14.3, 20.8, 27.3, 33.8, 39.0]; // measured, Hz
function TeslaResonance() {
  const [freq, setFreq] = useState(7.83);
  const [power, setPower] = useState(300);
  const canvasRef = useRef(null);
  const stateRef = useRef({ time: 0 });

  const nearest = SCHUMANN.reduce((a, b) => Math.abs(b - freq) < Math.abs(a - freq) ? b : a);
  const Q = 1 / (1 + ((freq - nearest) / 0.5) ** 2);
  const effP = power * Q;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setupCanvas(canvas);
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W < 10 || H < 10) return;
    const s = stateRef.current;
    s.time += 0.02;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H * 0.55;
    const eR = Math.min(W, H) * 0.3;

    // Earth
    ctx.beginPath();
    ctx.arc(cx, cy, eR, 0, Math.PI * 2);
    const eg = ctx.createRadialGradient(cx - eR * 0.3, cy - eR * 0.3, 0, cx, cy, eR);
    eg.addColorStop(0, "#1a4a3a");
    eg.addColorStop(1, "#061510");
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.strokeStyle = `${C.green}40`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ionosphere
    ctx.beginPath();
    ctx.arc(cx, cy, eR + 40, 0, Math.PI * 2);
    ctx.strokeStyle = `${C.purple}30`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Standing waves
    const n = Math.max(1, Math.round(freq / 7.83));
    for (let l = 0; l < 3; l++) {
      ctx.beginPath();
      const wR = eR + 8 + l * 12;
      for (let a = 0; a < Math.PI * 2; a += 0.03) {
        const w = Math.sin(n * a + s.time * freq * 0.3) * 10 * Q * (1 - l * 0.3);
        const r = wR + w;
        if (a === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      const col = l === 0 ? "0,229,255" : l === 1 ? "157,107,255" : "255,77,141";
      ctx.strokeStyle = `rgba(${col},${0.5 * Q + 0.1})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Tower
    ctx.fillStyle = C.gold;
    ctx.fillRect(cx - 2, cy - eR - 38, 4, 32);
    ctx.beginPath();
    ctx.arc(cx, cy - eR - 38, 8, Math.PI, 0);
    ctx.fill();

    // Radiation rings (only when on-resonance)
    if (Q > 0.3) {
      for (let i = 0; i < 6; i++) {
        const r = 15 + ((s.time * 40 + i * 25) % 70);
        ctx.beginPath();
        ctx.arc(cx, cy - eR - 38, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,255,${(1 - r / 70) * 0.5 * Q})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // HUD
    ctx.font = `14px ${F.m}`;
    ctx.fillStyle = C.cyan;
    ctx.textAlign = "left";
    ctx.fillText(`f = ${freq.toFixed(2)} Hz`, 20, 30);
    ctx.fillText(`Q (coupling) = ${(Q * 100).toFixed(1)}%`, 20, 50);
    ctx.fillText(`P_eff = ${effP.toFixed(0)} kW (hypothetical)`, 20, 70);
  });

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Earth-ionosphere Schumann resonance cavity visualization. Tune frequency to match resonant modes."
        style={{ width:"100%", height:340, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        <div>
          <Slider
            label={`FREQUENCY: ${freq.toFixed(2)} Hz`}
            value={freq} onChange={v => setFreq(safe(v, 7.83))}
            min={1} max={50} step={0.01} color={C.cyan}
          />
          <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
            {SCHUMANN.map((f, i) => (
              <button
                key={i}
                onClick={() => setFreq(f)}
                aria-label={`Set frequency to Schumann mode ${i+1} at ${f} Hz`}
                style={{
                  padding:"4px 8px", fontSize:10, fontFamily:F.m,
                  background: Math.abs(freq - f) < 0.3 ? `${C.cyan}30` : C.bg2,
                  border: `1px solid ${C.cyan}30`, borderRadius:4,
                  color:C.cyan, cursor:"pointer", minHeight:28
                }}
              >f{i+1}={f}</button>
            ))}
          </div>
        </div>
        <Slider
          label={`TRANSMITTER POWER: ${power} kW`}
          value={power} onChange={v => setPower(safe(v, 300))}
          min={10} max={1000} color={C.gold}
        />
      </div>
      <Formula label="Schumann Cavity (measured values)">{`Fundamental f₁ ≈ 7.83 Hz  (harmonics ≈ 14.3, 20.8, 27.3, 33.8, 39.0 Hz)
Approximate formula: f_n ≈ (c/2πR)·√(n(n+1))
Cavity Q ≈ 4–10 (real, measured) — significant dissipation in ionosphere

This is a conceptual model of Tesla's Wardenclyffe vision.
Actual global wireless power transfer at Earth-scale is NOT physically feasible
with current technology — dissipation losses make it impractical.`}</Formula>
      <Disclaimer>
        Wardenclyffe never achieved operational global transmission. Schumann resonances are real,
        but extracting usable power from them is a theoretical concept, not a validated technology.
      </Disclaimer>
      <DeepScience moduleKey="tesla" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 3. VIKING SUNSTONE
// ═══════════════════════════════════════════════════
function SunstoneSimulator() {
  const [crystalAngle, setCrystalAngle] = useState(0);
  const sunAngleRef = useRef(Math.floor(Math.random() * 360));
  // Revision key forces a new random sun angle when user clicks "New Sun"
  const [revision, setRevision] = useState(0);
  const canvasRef = useRef(null);

  // Pure derived state — no effect loop risk
  const diff = Math.abs(((crystalAngle - sunAngleRef.current + 180) % 360) - 180);
  const found = diff < 5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, W, H } = setup;
    const sunAngle = sunAngleRef.current;

    // Cloudy sky
    const skyG = ctx.createLinearGradient(0, 0, 0, H);
    skyG.addColorStop(0, "#4A5568");
    skyG.addColorStop(1, "#718096");
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // Static clouds (seeded by sunAngle for determinism)
    const rand = (i) => {
      const x = Math.sin(i * 12.9898 + sunAngle) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 25; i++) {
      ctx.beginPath();
      ctx.arc(rand(i) * W, rand(i + 50) * H * 0.6, 25 + rand(i + 100) * 45, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,170,180,${0.15 + rand(i + 200) * 0.12})`;
      ctx.fill();
    }

    // Hidden sun (revealed when found)
    if (found) {
      const sunRad = sunAngle * Math.PI / 180;
      const sunX = W / 2 + Math.cos(sunRad) * W * 0.3;
      const sunY = H * 0.22;
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
      sg.addColorStop(0, "rgba(255,220,100,0.7)");
      sg.addColorStop(1, "rgba(255,220,100,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#FFD700";
      ctx.fill();
    }

    // Calcite crystal
    const cx = W / 2, cy = H * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(crystalAngle * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(32, 0);
    ctx.lineTo(0, 45);
    ctx.lineTo(-32, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(200,220,240,0.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200,220,240,0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // O-ray and E-ray spots
    // Intensities: sinusoidal function of crystal-sun angle diff.
    const delta = (crystalAngle - sunAngle) * Math.PI / 90;
    const oI = clamp(0.3 + Math.cos(delta) * 0.3 + 0.2, 0.05, 0.95);
    const eI = clamp(0.3 - Math.cos(delta) * 0.3 + 0.2, 0.05, 0.95);
    ctx.beginPath();
    ctx.arc(-11, -14, 7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,100,${oI})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, 14, 7, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100,180,255,${eI})`;
    ctx.fill();
    ctx.restore();

    // Match banner
    if (Math.abs(oI - eI) < 0.08) {
      ctx.font = `bold 16px ${F.u}`;
      ctx.fillStyle = C.green;
      ctx.textAlign = "center";
      ctx.fillText("✓ Rays matched — Sun direction found!", W / 2, H - 25);
    }

    // HUD
    ctx.font = `12px ${F.m}`;
    ctx.fillStyle = C.gold;
    ctx.textAlign = "left";
    ctx.fillText(`Crystal: ${crystalAngle}°`, 12, 20);
    ctx.fillText(`Sun: ${found ? sunAngle + "°" : "???"}`, 12, 36);
    ctx.fillText(`Error: ${diff.toFixed(1)}°`, 12, 52);
  }, [crystalAngle, found, diff, revision]);

  const newSun = () => {
    sunAngleRef.current = Math.floor(Math.random() * 360);
    setCrystalAngle(0);
    setRevision(r => r + 1);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Cloudy sky with calcite sunstone. Rotate the crystal to find the hidden sun using birefringence."
        style={{ width:"100%", height:340, borderRadius:12, display:"block" }}
      />
      <div style={{ marginTop:12 }}>
        <Slider
          label={`ROTATE CRYSTAL: ${crystalAngle}°`}
          value={crystalAngle} onChange={v => setCrystalAngle(clamp(safe(v, 0), 0, 359))}
          min={0} max={359} color={C.gold}
        />
        <div style={{ marginTop:8 }}>
          <Btn onClick={newSun} color={C.dim}>🔄 New Sun Position</Btn>
        </div>
      </div>
      <Formula label="Calcite Birefringence (measured, 589 nm)">{`Ordinary index n_o ≈ 1.658
Extraordinary index n_e ≈ 1.486
Birefringence Δn = n_e − n_o ≈ −0.172

Rayleigh sky polarization maximum at 90° from the sun:
P(θ) = sin²θ / (1 + cos²θ)

Historical accuracy: experimental reconstructions suggest ±3–5° under overcast skies
(see Ropars et al., 2012 — Proc. R. Soc. A).`}</Formula>
      <Disclaimer>
        Whether Vikings actually used calcite ("sólarsteinn") for navigation is debated among historians.
        The optical principle is sound; archaeological direct evidence is limited.
      </Disclaimer>
      <DeepScience moduleKey="sunstone" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 4. LORENZ ATTRACTOR (Butterfly Effect)
// ═══════════════════════════════════════════════════
function LorenzAttractor() {
  const canvasRef = useRef(null);
  const [pert, setPert] = useState(-6);
  const stateRef = useRef(null);

  // Reset simulation when perturbation changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setupCanvas(canvas);
    stateRef.current = {
      s1: { x: 1, y: 1, z: 1 },
      s2: { x: 1 + Math.pow(10, pert), y: 1, z: 1 },
      // Circular buffers (fixed-size, no shift())
      trail1: new Float32Array(3000 * 2),
      trail2: new Float32Array(3000 * 2),
      head: 0, count: 0,
      step: 0,
      initialCleared: false,
    };
  }, [pert]);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    const st = stateRef.current;
    if (!canvas || !st) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W < 10 || H < 10) return;

    // RK4 integration (more stable than Euler for chaotic systems)
    const sigma = 10, rho = 28, beta = 8 / 3, dt = 0.006;
    const deriv = (s) => ({
      dx: sigma * (s.y - s.x),
      dy: s.x * (rho - s.z) - s.y,
      dz: s.x * s.y - beta * s.z,
    });
    const rk4 = (s) => {
      const k1 = deriv(s);
      const s2 = { x: s.x + k1.dx * dt / 2, y: s.y + k1.dy * dt / 2, z: s.z + k1.dz * dt / 2 };
      const k2 = deriv(s2);
      const s3 = { x: s.x + k2.dx * dt / 2, y: s.y + k2.dy * dt / 2, z: s.z + k2.dz * dt / 2 };
      const k3 = deriv(s3);
      const s4 = { x: s.x + k3.dx * dt, y: s.y + k3.dy * dt, z: s.z + k3.dz * dt };
      const k4 = deriv(s4);
      return {
        x: s.x + (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) * dt / 6,
        y: s.y + (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) * dt / 6,
        z: s.z + (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz) * dt / 6,
      };
    };

    const scale = Math.min(W, H) * 0.018;
    const proj = (s) => ({
      x: W * 0.5 + (s.x - s.y) * 0.7 * scale,
      y: H * 0.7 - s.z * scale
    });

    for (let i = 0; i < 4; i++) {
      st.s1 = rk4(st.s1);
      st.s2 = rk4(st.s2);
      const p1 = proj(st.s1);
      const p2 = proj(st.s2);
      const idx = (st.head % 3000) * 2;
      st.trail1[idx] = p1.x; st.trail1[idx + 1] = p1.y;
      st.trail2[idx] = p2.x; st.trail2[idx + 1] = p2.y;
      st.head++;
      if (st.count < 3000) st.count++;
      st.step++;
    }

    // Fade background
    if (!st.initialCleared) {
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      st.initialCleared = true;
    } else {
      ctx.fillStyle = "rgba(6,7,16,0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw trails (from oldest to newest)
    // Pre-computed color constants (avoid per-frame string allocation)
    const TRAIL1_COL = C.cyan + "90";
    const TRAIL2_COL = C.red + "90";
    const drawTrail = (arr, color) => {
      ctx.beginPath();
      const start = st.count < 3000 ? 0 : st.head;
      let first = true;
      for (let k = 0; k < st.count; k++) {
        const idx = ((start + k) % 3000) * 2;
        const x = arr[idx], y = arr[idx + 1];
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    drawTrail(st.trail1, TRAIL1_COL);
    drawTrail(st.trail2, TRAIL2_COL);

    // Divergence measurement
    const dx = st.s1.x - st.s2.x, dy = st.s1.y - st.s2.y, dz = st.s1.z - st.s2.z;
    const div = Math.sqrt(dx * dx + dy * dy + dz * dz);

    ctx.font = `13px ${F.m}`;
    ctx.fillStyle = C.text;
    ctx.textAlign = "left";
    ctx.fillText(`Divergence: ${div.toFixed(4)}`, 15, 22);
    ctx.fillText(`Δ₀ (initial): ${Math.pow(10, pert).toExponential(1)}`, 15, 40);
    ctx.fillText(`Lyapunov λ ≈ 0.9056`, 15, 58);
    if (div > 5) {
      ctx.fillStyle = C.red;
      ctx.fillText(`⚡ Trajectories have diverged`, 15, 76);
    }
  });

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Lorenz attractor showing two trajectories with slightly different initial conditions diverging over time."
        style={{ width:"100%", height:340, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ marginTop:12 }}>
        <Slider
          label={`INITIAL PERTURBATION: 10^${pert} = ${Math.pow(10, pert).toExponential(1)}`}
          value={pert} onChange={v => setPert(clamp(Math.round(safe(v, -6)), -10, -1))}
          min={-10} max={-1} color={C.red}
        />
      </div>
      <Formula label="Lorenz (1963) — Canonical Parameters">{`dx/dt = σ(y − x)
dy/dt = x(ρ − z) − y
dz/dt = xy − β z      with σ=10, ρ=28, β=8/3

Largest Lyapunov exponent λ ≈ 0.9056 (dimensionless, per time unit)
Trajectories separate exponentially: |Δ(t)| ≈ |Δ₀|·e^(λt)

Integration: 4th-order Runge-Kutta, dt = 0.006`}</Formula>
      <Disclaimer>
        The Lorenz system is a simplified 3-variable model of atmospheric convection. Real weather forecasts
        involve millions of variables; the ~2-week horizon is a broader estimate from operational NWP, not from λ alone.
      </Disclaimer>
      <DeepScience moduleKey="chaos" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 5. DNA ENCODER (3D helix)
// ═══════════════════════════════════════════════════
function DNAEncoder() {
  const [text, setText] = useState("ANCIENTQ");
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneObjRef = useRef(null);

  // Sanitize: strip control chars, limit length, uppercase ASCII+digits+space
  const safeText = useMemo(() => {
    return (text || "")
      .replace(/[\x00-\x1F\x7F]/g, "") // control chars
      .toUpperCase()
      .slice(0, 40);
  }, [text]);

  const encoded = useMemo(() => {
    const bin = safeText.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join("");
    const bases = [];
    const map = { "00": "A", "01": "T", "10": "C", "11": "G" };
    for (let i = 0; i < bin.length; i += 2) {
      bases.push(map[bin.substr(i, 2)] || "A");
    }
    return { bin, bases, bytes: safeText.length, nucs: bases.length };
  }, [safeText]);

  // Three.js setup — dispose everything on unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new Scene();
    const W = canvas.clientWidth || 300;
    const H = 280;
    const camera = new PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 12);

    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      // WebGL unavailable — silent fallback
      return;
    }
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, 2));
    rendererRef.current = renderer;

    // Handle WebGL context loss
    const onContextLost = (e) => { e.preventDefault(); };
    canvas.addEventListener("webglcontextlost", onContextLost);

    scene.add(new AmbientLight(0x404060, 1));
    const dl = new DirectionalLight(0xffeedd, 1.5);
    dl.position.set(5, 5, 5);
    scene.add(dl);

    const group = new Group();
    scene.add(group);

    const baseColors = { A: 0xff4d4d, T: 0x00e09e, C: 0x3b82f6, G: 0xffa500 };
    const n = Math.min(encoded.bases.length, 70);
    const sharedBackbone = new SphereGeometry(0.08, 10, 10);
    const backboneMat = new MeshStandardMaterial({ color: 0xD4A843, emissive: 0xD4A843, emissiveIntensity: 0.2 });
    const disposables = [sharedBackbone, backboneMat];

    for (let i = 0; i < n; i++) {
      const t = i * 0.25;
      const y = (i - n / 2) * 0.22;
      const r = 1.8;
      [t, t + Math.PI].forEach(a => {
        const s = new Mesh(sharedBackbone, backboneMat);
        s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        group.add(s);
      });
      if (i % 2 === 0) {
        const base = encoded.bases[i] || "A";
        const p1 = new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
        const p2 = new Vector3(Math.cos(t + Math.PI) * r, y, Math.sin(t + Math.PI) * r);
        const len = p1.distanceTo(p2);
        const cg = new CylinderGeometry(0.05, 0.05, len, 6);
        const cm = new MeshStandardMaterial({
          color: baseColors[base], emissive: baseColors[base],
          emissiveIntensity: 0.4, transparent: true, opacity: 0.85
        });
        disposables.push(cg, cm);
        const conn = new Mesh(cg, cm);
        conn.position.lerpVectors(p1, p2, 0.5);
        conn.lookAt(p2);
        conn.rotateX(Math.PI / 2);
        group.add(conn);
      }
    }

    sceneObjRef.current = { scene, camera, group, disposables };

    let frameId = 0;
    let active = true;
    let time = 0;
    const animate = () => {
      if (!active) return;
      frameId = requestAnimationFrame(animate);
      if (document.hidden) return;
      time += 0.008;
      group.rotation.y = time;
      try { renderer.render(scene, camera); } catch (e) { /* context lost */ }
    };
    animate();

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // Dispose all geometries/materials
      disposables.forEach(d => {
        try { d.dispose && d.dispose(); } catch (e) {}
      });
      // Clear scene graph to release references
      try { scene.clear && scene.clear(); } catch (e) {}
      renderer.dispose();
      rendererRef.current = null;
      sceneObjRef.current = null;
    };
  }, [safeText]);

  const baseColorMap = { A: "#ff6b6b", T: "#51cf66", C: "#74c0fc", G: "#ffa94d" };

  return (
    <div>
      <input
        value={text}
        onChange={e => setText(e.target.value.toUpperCase().slice(0, 40))}
        placeholder="TYPE TEXT..."
        aria-label="Text to encode into DNA bases"
        maxLength={40}
        style={{
          width:"100%", padding:"12px 16px", background:C.bg2,
          border:`1px solid ${C.gold}40`, borderRadius:8,
          color:C.text, fontFamily:F.m, fontSize:14,
          outline:"none", marginBottom:12, boxSizing:"border-box",
          minHeight:44
        }}
      />
      <div style={{
        padding:10, background:`${C.green}08`, borderRadius:8,
        marginBottom:12, fontFamily:F.m, fontSize:12, lineHeight:1.7,
        wordBreak:"break-all"
      }}>
        {encoded.bases.length === 0
          ? <span style={{ color:C.dim }}>Enter text above…</span>
          : encoded.bases.map((b, i) => (
              <span key={i} style={{ color: baseColorMap[b], fontWeight:600 }}>{b}</span>
            ))
        }
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`3D DNA double helix encoded from input text, ${encoded.nucs} bases`}
        style={{ width:"100%", height:280, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
        <Stat label="Bytes" value={encoded.bytes} color={C.gold}/>
        <Stat label="DNA Bases" value={encoded.nucs} color={C.green}/>
        <Stat label="Strand Length" value={`${(encoded.nucs * 0.34).toFixed(1)} nm`} color={C.cyan}/>
        <Stat label="Theoretical density" value="~10⁹ GB/g" color={C.purple}/>
      </div>
      <Formula label="Simplified 2-bit encoding (pedagogical)">{`ASCII byte → 8 bits → 4 DNA bases
00→A, 01→T, 10→C, 11→G   (one of many possible mappings)

Real DNA storage systems (DNA Fountain, Church lab) use:
 • Error-correcting codes (Reed-Solomon, fountain codes)
 • GC-balance constraints (avoid ambiguous sequences)
 • Primer + address schemes for random access
 • Redundancy for read/write error tolerance`}</Formula>
      <Disclaimer>
        This is a teaching encoding, not production DNA storage. Real systems achieve lower effective density
        due to error correction and must avoid homopolymer runs that break sequencing.
      </Disclaimer>
      <DeepScience moduleKey="dna" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 6. ANTIKYTHERA ECLIPSE CALCULATOR
// ═══════════════════════════════════════════════════
const SYN_MONTH = 29.530589;  // days, per IAU
const SAROS = 223;             // synodic months
function AntikytheraCalc() {
  const [crank, setCrank] = useState(0);
  const canvasRef = useRef(null);

  const moonPhase = ((crank / 360) * SAROS) % SAROS;
  const lunarLong = ((moonPhase / SAROS) * 360) % 360;
  // Approx: sun completes 1 full cycle per year; 19 years Metonic = 19 sun cycles per 235 lunations
  const solarLong = ((crank / 360) * 360 / 19) % 360;
  const eclProx = Math.abs(((lunarLong - solarLong + 180) % 360) - 180);
  const isEcl = eclProx < 12;
  const years = (crank / 360) * SAROS * SYN_MONTH / 365.25;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, W, H } = setup;

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.35;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Main gear (rotates with crank)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(crank * Math.PI / 180 * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = "#2A2318";
    ctx.fill();
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Teeth (64 for cleaner rendering)
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2));
      ctx.lineTo(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8));
      ctx.strokeStyle = `${C.gold}60`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Sun
    const sunA = solarLong * Math.PI / 180 - Math.PI / 2;
    const sunX = cx + Math.cos(sunA) * R * 0.6;
    const sunY = cy + Math.sin(sunA) * R * 0.6;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD700";
    ctx.fill();

    // Moon
    const moonA = lunarLong * Math.PI / 180 - Math.PI / 2;
    const moonX = cx + Math.cos(moonA) * R * 0.75;
    const moonY = cy + Math.sin(moonA) * R * 0.75;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 10, 0, Math.PI * 2);
    ctx.fillStyle = isEcl ? C.red : "#C0C0C0";
    ctx.fill();

    if (isEcl) {
      ctx.font = `bold 18px ${F.u}`;
      ctx.fillStyle = C.red;
      ctx.textAlign = "center";
      ctx.fillText("⚫ ECLIPSE CONDITION", cx, cy + R + 30);
    }

    // Center HUD
    ctx.font = `14px ${F.m}`;
    ctx.fillStyle = C.gold;
    ctx.textAlign = "center";
    ctx.fillText(`Saros: ${Math.floor(moonPhase)} / ${SAROS}`, cx, cy - 8);
    ctx.fillText(`${years.toFixed(1)} years elapsed`, cx, cy + 12);
  }, [crank, lunarLong, solarLong, isEcl, moonPhase, years]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Antikythera mechanism gear simulation with Sun and Moon positions and eclipse detection."
        style={{ width:"100%", height:340, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ marginTop:12 }}>
        <Slider
          label={`CRANK: ${crank}° → ${years.toFixed(2)} years elapsed`}
          value={crank}
          onChange={v => setCrank(clamp(Math.round(safe(v, 0)), 0, 7200))}
          min={0} max={7200} color={C.gold}
        />
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
        <Stat label="Saros Phase" value={`${Math.floor(moonPhase)}/${SAROS}`} color={C.gold}/>
        <Stat label="Sun λ" value={`${solarLong.toFixed(1)}°`} color="#FFD700"/>
        <Stat label="Moon λ" value={`${lunarLong.toFixed(1)}°`} color="#C0C0C0"/>
        <Stat label="Eclipse?" value={isEcl ? "YES ⚫" : "No"} color={isEcl ? C.red : C.dim}/>
      </div>
      <Formula label="Astronomical Cycles">{`Synodic Month: 29.530589 days (IAU)
Saros Cycle:  223 synodic months ≈ 6,585.32 days ≈ 18 y 11 d
Metonic:      235 lunations ≈ 19 solar years
Callippic:    4 × Metonic ≈ 76 years
Exeligmos:    3 × Saros ≈ 54 y 33 d (same-geometry eclipses)

Simplified eclipse condition: Moon-Sun ecliptic longitude opposite/aligned ± node tolerance`}</Formula>
      <Disclaimer>
        Simplified 2D visualization. The real Antikythera Mechanism (Freeth et al., 2021) modeled
        ecliptic inclination, anomaly, and planetary motion with pin-and-slot epicyclic gearing.
      </Disclaimer>
      <DeepScience moduleKey="antikythera" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 7. DAMASCUS NANO ZOOM
// ═══════════════════════════════════════════════════
function DamascusZoom() {
  const [zoom, setZoom] = useState(0);
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, W, H } = setup;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    if (zoom < 33) {
      ctx.fillStyle = "#4A4A50";
      ctx.fillRect(30, H * 0.35, W - 60, H * 0.3);
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        const y = H * 0.35 + i * (H * 0.3 / 60);
        ctx.moveTo(30, y);
        for (let x = 30; x < W - 30; x += 4) {
          ctx.lineTo(x, y + Math.sin(x * 0.008 + i * 0.4) * 6 * Math.sin(x * 0.003) * 2);
        }
        ctx.strokeStyle = `rgba(180,180,190,${0.15 + Math.sin(i * 0.3) * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.font = `16px ${F.u}`;
      ctx.fillStyle = C.gold;
      ctx.textAlign = "center";
      ctx.fillText("MACRO — Damascus Pattern (~1×)", W / 2, H * 0.18);
    } else if (zoom < 66) {
      ctx.fillStyle = "#3A3A42";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 25; i++) {
        const y = i * (H / 25);
        ctx.fillStyle = `rgba(200,200,210,${0.3 + Math.sin(i * 0.5) * 0.15})`;
        for (let x = 0; x < W; x += 3) {
          ctx.fillRect(x, y + Math.sin(x * 0.01 + i) * 6, 2, 3);
        }
      }
      ctx.font = `16px ${F.u}`;
      ctx.fillStyle = C.gold;
      ctx.textAlign = "center";
      ctx.fillText("MICRO — Cementite (Fe₃C) banding (~500×)", W / 2, 28);
    } else {
      ctx.fillStyle = "#1A1A22";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 28; i++) {
        const cx = 60 + Math.random() * (W - 120);
        const cy = 60 + Math.random() * (H - 120);
        const len = 50 + Math.random() * 150;
        const ang = Math.random() * Math.PI;
        const dia = 10 + Math.random() * 14;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.strokeStyle = `rgba(0,229,255,${0.4 + Math.random() * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-len / 2, -dia / 2);
        ctx.lineTo(len / 2, -dia / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-len / 2, dia / 2);
        ctx.lineTo(len / 2, dia / 2);
        ctx.stroke();
        if (i % 3 === 0) {
          ctx.strokeStyle = "rgba(255,165,0,0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-len / 2 + 10, 0);
          ctx.lineTo(len / 2 - 10, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.font = `16px ${F.u}`;
      ctx.fillStyle = C.cyan;
      ctx.textAlign = "center";
      ctx.fillText("NANO — Carbon nanotubes / cementite nanowires (TEM)", W / 2, 28);
    }
  }, [zoom]);

  const stage = zoom < 33 ? "MACRO (~1×)" : zoom < 66 ? "MICRO (~500×)" : "NANO (TEM)";
  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Damascus steel visualization at ${stage} magnification`}
        style={{ width:"100%", height:320, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ marginTop:12 }}>
        <Slider
          label={`ZOOM: ${stage}`}
          value={zoom}
          onChange={v => setZoom(clamp(safe(v, 0), 0, 100))}
          min={0} max={100} color={C.cyan}
        />
      </div>
      <Formula label="Reibold, Paufler et al., Nature 444, 286 (2006)">{`TEM of a 17th-century Damascus sabre revealed:
 • Carbon nanotubes (~10–20 nm diameter)
 • Cementite (Fe₃C) nanowires
 • Likely catalyzed by trace V, Mn, Cr in Wootz steel during thermomechanical cycling

The technique was lost around ~1750 CE when source ore composition changed.`}</Formula>
      <Disclaimer>
        Visualization is schematic. Actual TEM images show more complex microstructure and
        the "nanotubes" interpretation has been discussed (see also Kürten et al. follow-ups).
      </Disclaimer>
      <DeepScience moduleKey="damascus" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 8. ATOM INTERFEROMETER (Quantum Compass)
// ═══════════════════════════════════════════════════
function AtomInterferometer() {
  const [temp, setTemp] = useState(100);     // nK
  const [intT, setIntT] = useState(50);      // ms
  const [atoms, setAtoms] = useState(1e6);
  const canvasRef = useRef(null);
  const stateRef = useRef({ time: 0 });

  // De Broglie λ = h / p = ℏ × 2π / √(2 m kT)
  // Using ℏ (reduced Planck): correct expression is λ = h/√(2mkT) with h = 2πℏ
  const h = PHYS.hbar * 2 * Math.PI;
  const T_K = Math.max(1e-12, temp * 1e-9);   // convert nK to K, avoid 0
  const lDB = h / Math.sqrt(2 * PHYS.mRb87 * PHYS.kB * T_K);

  const tau = Math.max(1e-6, intT * 1e-3);  // ms → s
  const N = Math.max(1, atoms);
  const sens = PHYS.hbar * PHYS.kEffRb / (PHYS.mRb87 * tau * tau * Math.sqrt(N));
  const sensG = sens / PHYS.g;
  const advantage = 1e-6 / Math.max(sensG, 1e-20);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setupCanvas(canvas);
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W < 10 || H < 10) return;
    const s = stateRef.current;
    s.time += 0.03;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const midY = H / 2;
    const sX = 40, eX = W - 60;
    const spX = sX + (eX - sX) * 0.25;
    const mX = sX + (eX - sX) * 0.5;
    const rX = sX + (eX - sX) * 0.75;
    const sep = 24 + (intT / 100) * 50;

    const drawWave = (x1, y1, x2, y2, col, amp, fr) => {
      ctx.beginPath();
      for (let x = x1; x <= x2; x += 2) {
        const p = (x - x1) / (x2 - x1);
        const env = Math.sin(p * Math.PI);
        const y = y1 + (y2 - y1) * p + Math.sin((x - x1) * fr * 0.02 + s.time) * amp * env;
        if (x === x1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawWave(sX, midY, spX, midY, `${C.gold}80`, 12, 3);
    drawWave(spX, midY, mX, midY - sep, `${C.cyan}90`, 10, 4);
    drawWave(mX, midY - sep, rX, midY, `${C.cyan}90`, 10, 4);
    drawWave(spX, midY, mX, midY + sep, `${C.purple}90`, 10, 4.2);
    drawWave(mX, midY + sep, rX, midY, `${C.purple}90`, 10, 4.2);

    // Fringe pattern
    for (let i = 0; i < 30; i++) {
      const y = midY - 60 + i * 4;
      const I = Math.cos(i * 0.5 + s.time * 0.5) ** 2;
      ctx.fillStyle = `rgba(0,229,255,${I * 0.8})`;
      ctx.fillRect(rX + 20, y, 40 * I, 3);
    }

    // HUD (kept concise to fit mobile widths)
    ctx.font = `12px ${F.m}`;
    ctx.fillStyle = C.cyan;
    ctx.textAlign = "left";
    ctx.fillText(`λ_dB = ${(lDB * 1e9).toFixed(2)} nm`, 12, 22);
    ctx.fillText(`δa = ${sensG.toExponential(1)} g/√Hz`, 12, 40);
    ctx.fillText(`≈ ${advantage.toExponential(1)}× MEMS`, 12, 58);
  });

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Mach-Zehnder style atom interferometer showing coherent beam splitting, free evolution, and recombination with interference fringes."
        style={{ width:"100%", height:280, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginTop:12 }}>
        <Slider label={`TEMP: ${temp} nK`} value={temp}
          onChange={v => setTemp(clamp(Math.round(safe(v, 100)), 1, 1000))}
          min={1} max={1000} color={C.cyan}/>
        <Slider label={`INTERROGATION τ: ${intT} ms`} value={intT}
          onChange={v => setIntT(clamp(Math.round(safe(v, 50)), 1, 200))}
          min={1} max={200} color={C.purple}/>
        <Slider label={`ATOMS N: ${atoms.toLocaleString()}`} value={atoms}
          onChange={v => setAtoms(clamp(safe(v, 1e6), 1000, 1e7))}
          min={1000} max={1e7} step={1000} color={C.green}/>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
        <Stat label="De Broglie λ" value={`${(lDB * 1e9).toFixed(2)} nm`} color={C.cyan}/>
        <Stat label="Sensitivity" value={`${sensG.toExponential(1)}`} sub="g/√Hz" color={C.green}/>
        <Stat label="vs classical" value={`${advantage.toExponential(1)}×`} color={C.purple}/>
      </div>
      <Formula label="Atom Interferometry (⁸⁷Rb, D2 line 780.241 nm)">{`De Broglie wavelength:
  λ_dB = h / √(2 m_Rb k_B T)
  h = 2π·ℏ = 6.6261 × 10⁻³⁴ J·s

Shot-noise-limited acceleration sensitivity:
  δa = ℏ k_eff / (m τ² √N)
  k_eff = 2 × (2π / λ_laser) ≈ 1.612 × 10⁷ m⁻¹

CODATA 2018 constants used:
  ℏ = 1.054572 × 10⁻³⁴ J·s
  k_B = 1.380649 × 10⁻²³ J/K
  m(⁸⁷Rb) = 1.443161 × 10⁻²⁵ kg`}</Formula>
      <Disclaimer>
        Shot-noise-limited formula. Real devices are additionally limited by vibration,
        laser phase noise, and magnetic gradients.
      </Disclaimer>
      <DeepScience moduleKey="atom" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 9. QUANTUM ADVANTAGE CALCULATOR
// ═══════════════════════════════════════════════════
function QuantumAdvantage() {
  const [N, setN] = useState(1000);
  const [qubits, setQubits] = useState(50);
  const canvasRef = useRef(null);

  const classicalT = Math.pow(N, 3);
  const quantumT = Math.max(1, Math.pow(Math.log2(Math.max(2, N)), 2) * 10);
  const speedup = classicalT / quantumT;
  const hilbertExp = qubits; // just show as 2^qubits

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, W, H } = setup;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const m = { l: 60, r: 20, t: 40, b: 40 };
    const gW = W - m.l - m.r;
    const gH = H - m.t - m.b;

    ctx.strokeStyle = `${C.dim}60`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.l, m.t);
    ctx.lineTo(m.l, H - m.b);
    ctx.lineTo(W - m.r, H - m.b);
    ctx.stroke();

    ctx.font = `11px ${F.m}`;
    ctx.fillStyle = C.dim;
    ctx.textAlign = "center";
    ctx.fillText("Problem size N →", W / 2, H - 10);
    ctx.save();
    ctx.translate(14, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("log₁₀(ops)", 0, 0);
    ctx.restore();

    const Nmax = Math.max(10, N);
    const maxLog = Math.log10(Math.pow(Nmax, 3)) + 0.5;

    const plot = (fn, color, label) => {
      ctx.beginPath();
      for (let i = 1; i <= 100; i++) {
        const n = Math.max(2, (i / 100) * Nmax);
        const v = Math.log10(Math.max(1, fn(n)));
        const x = m.l + (i / 100) * gW;
        const y = (H - m.b) - clamp(v / maxLog, 0, 1) * gH;
        if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // End label
      const lv = Math.log10(Math.max(1, fn(Nmax)));
      const ly = (H - m.b) - clamp(lv / maxLog, 0, 1) * gH;
      ctx.fillStyle = color;
      ctx.font = `bold 11px ${F.u}`;
      ctx.textAlign = "right";
      ctx.fillText(label, W - m.r - 4, ly - 6);
    };

    plot(n => Math.pow(n, 3), C.red, "O(N³) classical");
    plot(n => Math.pow(n, 2), C.orange, "O(N²)");
    plot(n => Math.pow(Math.log2(n), 2) * 10, C.cyan, "O(log²N) HHL*");
    plot(n => Math.sqrt(n), C.green, "O(√N) Grover");

    ctx.font = `13px ${F.u}`;
    ctx.fillStyle = C.gold;
    ctx.textAlign = "center";
    ctx.fillText(`N=${N.toLocaleString()} · asymptotic speedup: ${speedup.toExponential(1)}×`, W / 2, 24);
  }, [N, speedup]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Log-scale plot comparing classical O(N³) vs quantum O(log²N) complexity curves."
        style={{ width:"100%", height:320, borderRadius:12, background:C.bg, display:"block" }}
      />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        <Slider label={`N: ${N.toLocaleString()}`} value={N}
          onChange={v => setN(clamp(Math.round(safe(v, 1000)), 10, 100000))}
          min={10} max={100000} step={10} color={C.cyan}/>
        <Slider label={`QUBITS: ${qubits} → 2^${hilbertExp} states`} value={qubits}
          onChange={v => setQubits(clamp(Math.round(safe(v, 50)), 2, 300))}
          min={2} max={300} color={C.purple}/>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:16 }}>
        <Stat label="Classical" value={classicalT.toExponential(1)} sub="ops" color={C.red}/>
        <Stat label="Quantum (asymp.)" value={quantumT.toFixed(0)} sub="ops" color={C.cyan}/>
        <Stat label="Asymp. speedup" value={`${speedup.toExponential(1)}×`} color={C.green}/>
        <Stat label="State space"
          value={`2^${qubits}`}
          sub={qubits >= 266 ? "> atoms in universe" : "states"}
          color={C.purple}/>
      </div>
      <Formula label="Complexity (asymptotic, per well-known bounds)">{`Classical matrix inversion:      O(N³)     (Gauss-Jordan)
HHL quantum algorithm (*):       O(log²N · poly(κ, 1/ε))
Grover unstructured search:      O(√N)
Classical search (unstructured): O(N)

(*) HHL has strong caveats: sparse matrices, state-preparation, readout cost.
Real-world end-to-end quantum advantage for practical problems is an active research area.`}</Formula>
      <Disclaimer>
        Asymptotic curves omit constant factors, error-correction overhead, decoherence, and I/O costs.
        Actual near-term quantum advantage requires careful problem matching.
      </Disclaimer>
      <DeepScience moduleKey="quantum_adv" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 10. LOSS IMPACT DASHBOARD
// ═══════════════════════════════════════════════════
function LossImpact() {
  const [yr, setYr] = useState(50);
  const data = [
    {
      icon:"🏭",
      label:"Hypothetical CO₂ saved",
      value:`${(yr * 4.4e9 * 0.15 / 1e9).toFixed(1)} Gt`,
      detail:"If Roman mix partially displaced Portland cement (at a conservative 15% reduction)",
      color:C.green
    },
    {
      icon:"🏗",
      label:"Hypothetical maintenance savings",
      value:`$${(yr * 100e9 / 1e12).toFixed(1)}T`,
      detail:"Assuming extended lifespan reduces global repair costs",
      color:C.gold
    },
    {
      icon:"📚",
      label:"Estimated knowledge-transmission gap",
      value:"~centuries",
      detail:"Some Babylonian techniques rediscovered in Europe ~1,500 years later (not uncontested)",
      color:C.red
    },
    {
      icon:"✈️",
      label:"GPS denial incidents (real, present-day)",
      value:`~${(yr * 365 * 1000 / 1e6).toFixed(1)}M`,
      detail:"Based on >1,000 flights/day affected today (industry estimate)",
      color:C.orange
    },
    {
      icon:"📜",
      label:"Ancient manuscripts lost (historic)",
      value:"Many millions",
      detail:"Alexandria, Nalanda, Baghdad, Pergamum (exact counts debated)",
      color:C.purple
    },
    {
      icon:"🧪",
      label:"Technologies lost / rediscovered",
      value:"Multiple",
      detail:"Concrete, Damascus steel, Greek Fire, Antikythera mechanism, etc.",
      color:C.pink
    },
  ];
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <Slider label={`PROJECTION HORIZON: ${yr} years`} value={yr}
          onChange={v => setYr(clamp(Math.round(safe(v, 50)), 1, 200))}
          min={1} max={200} color={C.cyan}/>
      </div>
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:10
      }}>
        {data.map((d, i) => (
          <div key={i} style={{
            padding:16,
            background:`${d.color}06`, border:`1px solid ${d.color}18`,
            borderRadius:10
          }}>
            <div style={{
              display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:6
            }}>
              <span style={{ fontSize:22 }} aria-hidden="true">{d.icon}</span>
              <span style={{
                fontFamily:F.m, fontSize:18, fontWeight:700, color:d.color
              }}>{d.value}</span>
            </div>
            <div style={{ fontFamily:F.u, fontSize:12, color:C.text, fontWeight:600 }}>
              {d.label}
            </div>
            <div style={{ fontFamily:F.u, fontSize:11, color:C.dim, marginTop:4, lineHeight:1.5 }}>
              {d.detail}
            </div>
          </div>
        ))}
      </div>
      <Disclaimer>
        All figures are thought-experiment projections for discussion, not economic forecasts.
        Assumptions are deliberately conservative; no specific policy recommendations are made.
      </Disclaimer>
      <DeepScience moduleKey="impact" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 11. "WHAT IF" TIMELINE
// ═══════════════════════════════════════════════════
function WhatIfTimeline() {
  const events = [
    { year:-350, real:"Babylonian astronomers use trapezoidal rule for Jupiter (Ossendrijver, 2016)",
      alt:"If widely transmitted, geometric integration could have entered Greek/Roman curricula earlier",
      color:C.orange },
    { year:-100, real:"Antikythera mechanism built (37+ gears known, Freeth et al.)",
      alt:"Had the engineering tradition persisted, complex mechanisms may have appeared sooner in medieval Europe",
      color:C.gold },
    { year:-48, real:"Library of Alexandria damaged (multiple events over centuries)",
      alt:"With better preservation, Hellenistic texts could have reached the Renaissance in more complete form",
      color:C.red },
    { year:79, real:"Vesuvius preserves Roman concrete work-site (Pompeii, Herculaneum)",
      alt:"Wider documentation would have made the 'hot-mixing' method transparent much earlier",
      color:C.green },
    { year:1193, real:"Nalanda Mahavihara destroyed (Bakhtiyar Khilji)",
      alt:"Preservation of its libraries could have kept ancient Indian mathematical and medical traditions alive",
      color:C.purple },
    { year:1258, real:"Siege of Baghdad, House of Wisdom ruined",
      alt:"Preserved translations and originals could have shortened the medieval European scientific recovery",
      color:C.cyan },
    { year:1750, real:"Damascus (Wootz) crucible steel technique lost",
      alt:"Understanding V/Mn catalysis earlier could have influenced alloy design centuries sooner",
      color:C.orange },
    { year:2006, real:"Carbon nanotubes identified in Damascus steel (Reibold et al., Nature)",
      alt:"Real: ancient composites recognized as unintentional nanotechnology",
      color:C.green },
    { year:2023, real:"MIT clarifies Roman concrete 'hot mixing' (Seymour et al., Science Advances)",
      alt:"Real: commercial efforts now testing modern self-healing concrete formulations",
      color:C.green },
    { year:2025, real:"Quantum magnetic navigation field-validated in airborne trials",
      alt:"Real: GPS-denied routing demonstrated with centimeter-level accuracy",
      color:C.cyan },
    { year:2026, real:"Superextensive quantum-battery prototype (Hymas et al., Light: Sci. Appl.)",
      alt:"Real: first end-to-end quantum energy storage demonstration",
      color:C.purple },
  ];
  return (
    <div>
      <div style={{ position:"relative", paddingLeft:30 }}>
        <div style={{
          position:"absolute", left:14, top:0, bottom:0, width:2,
          background:`linear-gradient(180deg,${C.gold},${C.cyan},${C.purple})`
        }}/>
        {events.map((e, i) => (
          <div key={i} style={{ position:"relative", marginBottom:18, paddingLeft:24 }}>
            <div style={{
              position:"absolute", left:-22, top:4, width:16, height:16,
              borderRadius:"50%", background:C.bg,
              border:`2px solid ${e.color}`
            }}/>
            <div style={{ fontFamily:F.m, fontSize:11, color:e.color, fontWeight:700 }}>
              {e.year > 0 ? `${e.year} CE` : `${Math.abs(e.year)} BCE`}
            </div>
            <div style={{ fontFamily:F.u, fontSize:13, color:C.text, marginTop:2 }}>
              {e.real}
            </div>
            <div style={{
              fontFamily:F.u, fontSize:12, color:C.dim, marginTop:2,
              fontStyle:"italic", paddingLeft:10, borderLeft:`2px solid ${e.color}30`
            }}>
              ↳ {e.alt}
            </div>
          </div>
        ))}
      </div>
      <Disclaimer>
        Counterfactual history is inherently speculative. These are thought experiments for reflection,
        not academic claims. Historians debate the actual impact of knowledge loss.
      </Disclaimer>
      <DeepScience moduleKey="whatif" />
    </div>  );
}

// ═══════════════════════════════════════════════════
// 12. REFERENCES
// ═══════════════════════════════════════════════════
function References() {
  const refs = [
    { id:1, a:"Seymour LM, Maragh J, Sabatini P, Di Tommaso M, Weaver JC, Masic A.",
      t:"Hot mixing: Mechanistic insights into the durability of ancient Roman concrete.",
      j:"Science Advances", y:2023, doi:"10.1126/sciadv.add1602" },
    { id:2, a:"Jackson MD, Mulcahy SR, Chen H, Li Y, Li Q, Cappelletti P, Wenk H-R.",
      t:"Phillipsite and Al-tobermorite mineral cements produced through low-temperature water-rock reactions in Roman marine concrete.",
      j:"American Mineralogist", y:2017, doi:"10.2138/am-2017-5993CCBY" },
    { id:3, a:"Assawaworrarit S, Yu X, Fan S.",
      t:"Robust wireless power transfer using a nonlinear parity-time-symmetric circuit.",
      j:"Nature", y:2017, doi:"10.1038/nature22404" },
    { id:4, a:"Hotta M.",
      t:"Quantum measurement information as a key to energy extraction from local vacuums.",
      j:"Physical Review D", y:2008, doi:"10.1103/PhysRevD.78.045006" },
    { id:5, a:"Ropars G, Gorre G, Le Floch A, Enoch J, Lakshminarayanan V.",
      t:"A depolarizer as a possible precise sunstone for Viking navigation by polarized skylight.",
      j:"Proc. R. Soc. A", y:2012, doi:"10.1098/rspa.2011.0369" },
    { id:6, a:"Reibold M, Paufler P, Levin AA, Kochmann W, Pätzke N, Meyer DC.",
      t:"Carbon nanotubes in an ancient Damascus sabre.",
      j:"Nature", y:2006, doi:"10.1038/444286a" },
    { id:7, a:"Ossendrijver M.",
      t:"Ancient Babylonian astronomers calculated Jupiter's position from the area under a time-velocity graph.",
      j:"Science", y:2016, doi:"10.1126/science.aad8085" },
    { id:8, a:"Freeth T, Higgon D, Dacanalis A, MacDonald L, Georgakopoulou M, Wojcik A.",
      t:"A Model of the Cosmos in the ancient Greek Antikythera Mechanism.",
      j:"Scientific Reports", y:2021, doi:"10.1038/s41598-021-84310-w" },
    { id:9, a:"Grass RN, Heckel R, Puddu M, Paunescu D, Stark WJ.",
      t:"Robust chemical preservation of digital information on DNA in silica with error-correcting codes.",
      j:"Angewandte Chemie Int. Ed.", y:2015, doi:"10.1002/anie.201411378" },
    { id:10, a:"Erlich Y, Zielinski D.",
      t:"DNA Fountain enables a robust and efficient storage architecture.",
      j:"Science", y:2017, doi:"10.1126/science.aaj2038" },
    { id:11, a:"Kasevich M, Chu S.",
      t:"Atomic interferometry using stimulated Raman transitions.",
      j:"Physical Review Letters", y:1991, doi:"10.1103/PhysRevLett.67.181" },
    { id:12, a:"Harrow AW, Hassidim A, Lloyd S.",
      t:"Quantum algorithm for linear systems of equations (HHL).",
      j:"Physical Review Letters", y:2009, doi:"10.1103/PhysRevLett.103.150502" },
    { id:13, a:"Grover LK.",
      t:"A fast quantum mechanical algorithm for database search.",
      j:"Proc. 28th Annual ACM STOC", y:1996, doi:"10.1145/237814.237866" },
    { id:14, a:"Lorenz EN.",
      t:"Deterministic Nonperiodic Flow.",
      j:"Journal of the Atmospheric Sciences", y:1963, doi:"10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2" },
  ];
  return (
    <div>
      <p style={{ marginBottom:16, lineHeight:1.7, fontSize:14, color:C.text }}>
        AncientQ simulations use established physics constants (NIST/CODATA 2018) and are inspired by the
        peer-reviewed sources below. Figures and visualizations are original schematic interpretations —
        not reproductions of published figures.
      </p>
      {refs.map((r, i) => (
        <div key={i} style={{
          padding:12, marginBottom:6, background:C.bg2,
          border:`1px solid ${C.muted}`, borderRadius:8,
          display:"flex", gap:10
        }}>
          <div style={{
            fontFamily:F.m, fontSize:11, color:C.gold,
            fontWeight:700, minWidth:24
          }}>[{r.id}]</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:F.u, fontSize:12, color:C.text }}>{r.a} ({r.y})</div>
            <div style={{ fontFamily:F.u, fontSize:12, color:C.dim, fontStyle:"italic", marginTop:2 }}>
              {r.t}
            </div>
            <div style={{ fontFamily:F.u, fontSize:11, color:C.dim, marginTop:2 }}>{r.j}</div>
            <div style={{ fontFamily:F.m, fontSize:10, color:C.cyan, marginTop:3, wordBreak:"break-all" }}>
              DOI: {r.doi}
            </div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop:20, padding:14,
        background:`${C.dim}08`, border:`1px solid ${C.muted}`,
        borderRadius:8, fontFamily:F.u, fontSize:11, color:C.dim, lineHeight:1.7
      }}>
        <strong>Note:</strong> AncientQ is an educational application. It does not reproduce full text,
        figures, or data from the cited works. All interpretations are simplified for pedagogy.
        For authoritative information, consult the original publications.
        Institutional names appear solely in standard academic citation format and do not
        imply endorsement, affiliation, or sponsorship.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
const TABS = [
  { id:"concrete",   label:"Concrete Lab",   icon:"🏛", color:C.gold,
    desc:"Tap the concrete to crack it, then trigger self-healing chemistry (Seymour et al., 2023)." },
  { id:"tesla",      label:"Tesla / Schumann", icon:"⚡", color:C.purple,
    desc:"Tune into Earth-ionosphere cavity resonances (measured frequencies)." },
  { id:"sunstone",   label:"Viking Sunstone", icon:"🔆", color:C.orange,
    desc:"Find a hidden sun by matching calcite birefringence rays." },
  { id:"lorenz",     label:"Butterfly Effect", icon:"🦋", color:C.red,
    desc:"Lorenz attractor with RK4 integration — two near-identical starts diverge." },
  { id:"dna",        label:"DNA Encoder",     icon:"🧬", color:C.green,
    desc:"Type text → 2-bit binary → A/T/C/G → rotating 3D double helix." },
  { id:"antikythera",label:"Antikythera",     icon:"⚙", color:C.goldBr,
    desc:"Turn the crank — Saros cycle logic flags potential eclipses." },
  { id:"damascus",   label:"Damascus Nano",   icon:"⚔", color:C.pink,
    desc:"Zoom from blade surface to cementite banding to nanotubes (Reibold 2006)." },
  { id:"atom",       label:"Atom Compass",    icon:"🧭", color:C.cyan,
    desc:"⁸⁷Rb Mach-Zehnder interferometer with NIST constants." },
  { id:"advantage",  label:"Quantum Scaling", icon:"📊", color:C.cyan,
    desc:"Asymptotic complexity: classical O(N³) vs HHL O(log²N) vs Grover O(√N)." },
  { id:"impact",     label:"Loss Impact",     icon:"⚠", color:C.red,
    desc:"Thought-experiment projections of preservation-loss costs." },
  { id:"whatif",     label:"What If",         icon:"🔮", color:C.purple,
    desc:"Counterfactual timeline — speculative reflection, not history." },
  { id:"refs",       label:"References",      icon:"📄", color:C.dim,
    desc:"14 peer-reviewed sources with DOIs." },
];

export default function App() {
  const [tab, setTab] = useState("concrete");
  const cur = TABS.find(t => t.id === tab) || TABS[0];

  // Keyboard navigation for tabs
  const onKeyDown = useCallback((e) => {
    const idx = TABS.findIndex(t => t.id === tab);
    if (e.key === "ArrowRight") setTab(TABS[(idx + 1) % TABS.length].id);
    else if (e.key === "ArrowLeft") setTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
  }, [tab]);

  return (
    <div style={{
      minHeight:"100vh", background:C.bg, color:C.text, fontFamily:F.b,
    }}>
      <header style={{
        padding:"20px 20px 14px", textAlign:"center",
        borderBottom:`1px solid ${C.muted}`,
        background:`linear-gradient(180deg,${C.bg2},${C.bg})`
      }}>
        <h1 style={{
          fontFamily:F.t, fontSize:"clamp(26px,5vw,40px)",
          fontWeight:700,
          background:`linear-gradient(135deg,${C.goldBr},${C.gold},${C.goldDim})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text",
          margin:0, letterSpacing:".08em"
        }}>AncientQ</h1>
        <p style={{
          fontFamily:F.u, fontSize:10, color:C.cyan, marginTop:6,
          letterSpacing:".3em", textTransform:"uppercase"
        }}>Ancient Principles, Quantum Frontiers</p>
      </header>

      <nav
        role="tablist"
        aria-label="AncientQ simulation modules"
        onKeyDown={onKeyDown}
        style={{
          display:"flex", gap:3, padding:"8px 8px 0",
          overflowX:"auto", WebkitOverflowScrolling:"touch",
          background:C.bg2, borderBottom:`1px solid ${C.muted}`
        }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{
              padding:"10px 12px",
              borderRadius:"6px 6px 0 0",
              cursor:"pointer",
              background: tab === t.id ? C.bg : "transparent",
              border: tab === t.id ? `1px solid ${C.muted}` : "1px solid transparent",
              borderBottom: tab === t.id ? `1px solid ${C.bg}` : "none",
              color: tab === t.id ? t.color : C.dim,
              fontFamily:F.u, fontSize:10,
              fontWeight: tab === t.id ? 700 : 500,
              whiteSpace:"nowrap",
              marginBottom:-1,
              minHeight:44
            }}
          ><span style={{ marginRight:4 }} aria-hidden="true">{t.icon}</span>{t.label}</button>
        ))}
      </nav>

      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        style={{ maxWidth:960, margin:"0 auto", padding:"18px 14px" }}
      >
        <div style={{ marginBottom:18 }}>
          <h2 style={{ fontFamily:F.t, fontSize:22, color:cur.color, margin:0 }}>
            <span aria-hidden="true">{cur.icon}</span> {cur.label}
          </h2>
          <p style={{ fontFamily:F.u, fontSize:12, color:C.dim, marginTop:4, lineHeight:1.5 }}>
            {cur.desc}
          </p>
        </div>
        {tab === "concrete"    && <ModuleErrorBoundary><ConcreteSimulation/></ModuleErrorBoundary>}
        {tab === "tesla"       && <ModuleErrorBoundary><TeslaResonance/></ModuleErrorBoundary>}
        {tab === "sunstone"    && <ModuleErrorBoundary><SunstoneSimulator/></ModuleErrorBoundary>}
        {tab === "lorenz"      && <ModuleErrorBoundary><LorenzAttractor/></ModuleErrorBoundary>}
        {tab === "dna"         && <ModuleErrorBoundary><DNAEncoder/></ModuleErrorBoundary>}
        {tab === "antikythera" && <ModuleErrorBoundary><AntikytheraCalc/></ModuleErrorBoundary>}
        {tab === "damascus"    && <ModuleErrorBoundary><DamascusZoom/></ModuleErrorBoundary>}
        {tab === "atom"        && <ModuleErrorBoundary><AtomInterferometer/></ModuleErrorBoundary>}
        {tab === "advantage"   && <ModuleErrorBoundary><QuantumAdvantage/></ModuleErrorBoundary>}
        {tab === "impact"      && <ModuleErrorBoundary><LossImpact/></ModuleErrorBoundary>}
        {tab === "whatif"      && <ModuleErrorBoundary><WhatIfTimeline/></ModuleErrorBoundary>}
        {tab === "refs"        && <ModuleErrorBoundary><References/></ModuleErrorBoundary>}
      </main>

      <footer style={{
        textAlign:"center", padding:"20px 16px 24px",
        borderTop:`1px solid ${C.muted}`, marginTop:30
      }}>
        <div style={{
          fontFamily:F.u, fontSize:10, color:C.dim,
          letterSpacing:".1em", lineHeight:1.7
        }}>
          AncientQ · Educational simulations · NIST/CODATA 2018 constants · No data collection
          <br/>
          All simulations are schematic; they are not production-grade scientific tools.
          <br/>
          Built with React and Three.js (MIT License). See THIRD-PARTY-NOTICES for attribution.
        </div>
      </footer>
    </div>
  );
}
