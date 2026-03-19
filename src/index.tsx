import { useState, useEffect, useRef, useCallback } from "react";
import * as echarts from "echarts";

// ── Constants ──────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TABS = ["Team & Hiring","Compensation","Infrastructure","Legal & Ops","Summary","Revenue","Cash Burn"];
const YEARS = ["Year 1", "Year 2", "Year 3"];
const C6 = "#2E86C1";
const C1 = "#534AB7", C2 = "#1D9E75", C3 = "#D85A30", C4 = "#BA7517", C5 = "#888780";

// ── Types ──────────────────────────────────────────────────────────────
interface RoleDef {
  id: string;
  label: string;
  salary: number;
  startMonth: number;
  include: boolean;
  fixed: boolean;
}

interface MonthlyData {
  pc: number;
  ai: number;
  lo: number;
  rc: number;
  tot: number;
}

interface CalcResult {
  hc: number;
  pb: number;
  ps: number;
  pbo: number;
  pcost: number;
  fr: number;
  tr: number;
  rcost: number;
  ic: number;
  lc: number;
  sub: number;
  cont: number;
  total: number;
  monthly: MonthlyData[];
  cumulative: number[];
}

interface RevenueState {
  baseY1: number;
  baseY2: number;
  baseY3: number;
  stretchY1: number;
  stretchY2: number;
  stretchY3: number;
}

interface SliderState {
  socialPct: number;
  bonusPct: number;
  vsopSetup: number;
  founderAgencyPct: number;
  teamAgencyPct: number;
  referralBonus: number;
  aiTokens: number;
  cloud: number;
  db: number;
  cicd: number;
  secTools: number;
  saas: number;
  equipment: number;
  cowork: number;
  entitySetup: number;
  hrLegal: number;
  ipAssign: number;
  patents: number;
  gdpr: number;
  legalRetainer: number;
  finance: number;
  insurance: number;
  travel: number;
  research: number;
  contingencyPct: number;
}

// ── Defaults ───────────────────────────────────────────────────────────
const DEFAULT_ROLES: RoleDef[] = [
  { id: "founder",  label: "Labs Founder / CEO",        salary: 210000, startMonth: 1,  include: true,  fixed: true },
  { id: "lead_eng", label: "Lead Engineer / CTO-equiv", salary: 155000, startMonth: 3,  include: true,  fixed: false },
  { id: "ai_eng1",  label: "Senior AI/ML Engineer #1",  salary: 135000, startMonth: 4,  include: true,  fixed: false },
  { id: "ai_eng2",  label: "Senior AI/ML Engineer #2",  salary: 135000, startMonth: 6,  include: false, fixed: false },
  { id: "prod_eng", label: "Senior Product Engineer",   salary: 125000, startMonth: 4,  include: true,  fixed: false },
  { id: "pm",       label: "Product Manager / Designer",salary: 105000, startMonth: 5,  include: true,  fixed: false },
  { id: "gtm",      label: "GTM / Growth (H2 hire)",    salary: 100000, startMonth: 9,  include: false, fixed: false },
];

const DEFAULT_REVENUE: RevenueState = {
  baseY1: 0, baseY2: 350000, baseY3: 1200000,
  stretchY1: 250000, stretchY2: 750000, stretchY3: 2000000,
};

const DEFAULT_SLIDERS: SliderState = {
  socialPct: 22, bonusPct: 15, vsopSetup: 7500,
  founderAgencyPct: 23, teamAgencyPct: 18, referralBonus: 15000,
  aiTokens: 55000, cloud: 70000, db: 20000, cicd: 15000, secTools: 12000,
  saas: 12000, equipment: 3500, cowork: 90000,
  entitySetup: 12000, hrLegal: 15000, ipAssign: 7500, patents: 25000, gdpr: 15000,
  legalRetainer: 36000, finance: 22000, insurance: 15000, travel: 30000, research: 15000,
  contingencyPct: 10,
};

// ── Formatters ─────────────────────────────────────────────────────────
const fmt  = (n: number) => "€" + Math.round(n).toLocaleString("de-DE");
const fmtK = (n: number) => "€" + Math.round(n / 1000).toLocaleString("de-DE") + "k";
const pct  = (n: number) => (n * 100).toFixed(1) + "%";

// ── Calculation ────────────────────────────────────────────────────────
function calc(roles: RoleDef[], S: SliderState): CalcResult {
  const active = roles.filter((r) => r.include);
  const hc = active.length;

  const monthly: MonthlyData[] = MONTHS.map((_, mi) => {
    const mo = mi + 1;
    let pc = 0;
    active.forEach((r) => {
      if (mo >= r.startMonth) pc += (r.salary / 12) * (1 + S.socialPct / 100 + S.bonusPct / 100);
    });
    const ir = mo <= 2 ? 0.4 : mo <= 5 ? 0.7 : 1.0;
    const ai = (S.aiTokens + S.cloud + S.db + S.cicd + S.secTools + S.saas + S.equipment * hc + S.cowork) / 12 * ir;
    const lo = (S.hrLegal + S.ipAssign + S.patents + S.gdpr + S.legalRetainer + S.finance + S.insurance + S.travel + S.research) / 12;
    const em = mo === 1 ? S.entitySetup : 0;
    let rc = 0;
    active.forEach((r) => {
      if (mo === r.startMonth) rc += r.id === "founder" ? r.salary * (S.founderAgencyPct / 100) : r.salary * (S.teamAgencyPct / 100);
    });
    if (mo === 1)  rc += S.referralBonus * 0.3;
    if (mo === 6)  rc += S.referralBonus * 0.4;
    if (mo === 10) rc += S.referralBonus * 0.3;
    return { pc, ai: ai + em, lo, rc, tot: pc + ai + em + lo + rc };
  });

  const pb = active.reduce((s, r) => s + r.salary * (13 - r.startMonth) / 12, 0);
  const ps = pb * (S.socialPct / 100);
  const pbo = pb * (S.bonusPct / 100);
  const pcost = pb + ps + pbo + S.vsopSetup;

  const founder = roles.find((r) => r.id === "founder")!;
  const fr = founder.salary * (S.founderAgencyPct / 100);
  const tr = active.filter((r) => r.id !== "founder").reduce((s, r) => s + r.salary * (S.teamAgencyPct / 100), 0);
  const rcost = fr + tr + S.referralBonus;

  const ic = S.aiTokens + S.cloud + S.db + S.cicd + S.secTools + S.saas + S.equipment * hc + S.cowork;
  const lc = S.entitySetup + S.hrLegal + S.ipAssign + S.patents + S.gdpr + S.legalRetainer + S.finance + S.insurance + S.travel + S.research;
  const sub = pcost + rcost + ic + lc;
  const cont = sub * (S.contingencyPct / 100);
  const total = sub + cont;

  let cum = 0;
  const cumulative = monthly.map((m) => { cum += m.tot; return cum; });

  return { hc, pb, ps, pbo, pcost, fr, tr, rcost, ic, lc, sub, cont, total, monthly, cumulative };
}

// ── Reusable components ────────────────────────────────────────────────
function Slider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  display?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="sl-row">
      <div className="sl-hd">
        <span>{label}</span>
        <strong>{display ? display(value) : String(value)}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

function Row({ label, value, sub, hl }: { label: string; value: string; sub?: boolean; hl?: boolean }) {
  return (
    <div className={`row${hl ? " hl" : ""}`}>
      <span className={`rl${sub ? " sub" : ""}`}>{label}</span>
      <span className="rv">{value}</span>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="sec">
      <div className="sec-ttl" style={{ borderBottomColor: color || C1 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Tab panels ─────────────────────────────────────────────────────────
function TeamPanel({ roles, setRoles }: { roles: RoleDef[]; setRoles: (r: RoleDef[]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const updateRole = (id: string, patch: Partial<RoleDef>) => {
    setRoles(roles.map((r) => r.id === id ? { ...r, ...patch } : r));
  };
  const removeRole = (id: string) => {
    setRoles(roles.filter((r) => r.id !== id));
  };
  const addRole = () => {
    const label = newLabel.trim() || "New Role";
    const id = "custom_" + Date.now();
    setRoles([...roles, { id, label, salary: 100000, startMonth: 6, include: true, fixed: false }]);
    setNewLabel("");
  };
  const activeRoles = roles.filter((r) => r.include);

  return (
    <>
      <Section title="Role configuration">
        {roles.map((r) => (
          <div className="rc" key={r.id}>
            <div className="rh">
              <input type="checkbox" checked={r.include} disabled={r.fixed}
                onChange={(e) => updateRole(r.id, { include: e.target.checked })} />
              <span className={`rn${r.include ? "" : " off"}`}>{r.label}</span>
              <span className="rb">
                {r.include ? `Joins M${r.startMonth} · ${13 - r.startMonth}mo` : "Not hired"}
              </span>
              {!r.fixed && (
                <button className="rm-btn" onClick={() => removeRole(r.id)} title="Remove role">&times;</button>
              )}
            </div>
            {r.include && (
              <div className="rsl">
                <div>
                  <div className="sl-hd"><span>Base salary</span><strong>{fmt(r.salary)}</strong></div>
                  <input type="range" min={60000} max={300000} step={5000} value={r.salary}
                    onChange={(e) => updateRole(r.id, { salary: +e.target.value })} />
                </div>
                <div>
                  <div className="sl-hd"><span>Start month</span><strong>M{r.startMonth} ({MONTHS[r.startMonth - 1]})</strong></div>
                  <input type="range" min={1} max={12} step={1} value={r.startMonth}
                    onChange={(e) => updateRole(r.id, { startMonth: +e.target.value })} />
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="add-role">
          <input type="text" placeholder="Role title..." value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addRole(); }} />
          <button onClick={addRole}>+ Add role</button>
        </div>
      </Section>
      <Section title="Hiring timeline">
        <div style={{ overflowX: "auto" }}>
          <table className="gt">
            <tbody>
              <tr>
                <td />
                {MONTHS.map((m) => (
                  <td key={m} style={{ textAlign: "center", color: "var(--tx3)", fontSize: 10, paddingBottom: 3 }}>{m}</td>
                ))}
              </tr>
              {activeRoles.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--tx2)", paddingRight: 6, fontSize: 11, whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.label.split(" ").slice(0, 3).join(" ")}
                  </td>
                  {MONTHS.map((_, mi) => {
                    const mo = mi + 1;
                    const bg = mo >= r.startMonth ? (mo === r.startMonth ? C1 : "#CECBF6") : "var(--bg2)";
                    return <td key={mi}><div className="gc" style={{ background: bg }} /></td>;
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ fontSize: 11, fontWeight: 500, color: "var(--tx2)", paddingTop: 5 }}>Headcount</td>
                {MONTHS.map((_, mi) => {
                  const hc = roles.filter((r) => r.include && mi + 1 >= r.startMonth).length;
                  return <td key={mi} style={{ textAlign: "center", fontSize: 11, fontWeight: 500, paddingTop: 5 }}>{hc}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function CompPanel({ sliders, setSlider, c }: { sliders: SliderState; setSlider: (k: keyof SliderState, v: number) => void; c: CalcResult }) {
  return (
    <>
      <Section title="Compensation parameters" color={C1}>
        <Slider label="Employer social contributions" value={sliders.socialPct} min={15} max={30} step={1} display={(v) => v + "%"} onChange={(v) => setSlider("socialPct", v)} />
        <Slider label="Bonus pool (% of prorated base)" value={sliders.bonusPct} min={0} max={30} step={1} display={(v) => v + "%"} onChange={(v) => setSlider("bonusPct", v)} />
        <Slider label="VSOP / phantom equity setup" value={sliders.vsopSetup} min={0} max={25000} step={500} display={fmt} onChange={(v) => setSlider("vsopSetup", v)} />
      </Section>
      <Section title="Recruitment" color={C2}>
        <Slider label="Founder search — agency fee (%)" value={sliders.founderAgencyPct} min={15} max={30} step={1} display={(v) => v + "%"} onChange={(v) => setSlider("founderAgencyPct", v)} />
        <Slider label="Team hires — agency fee (% each)" value={sliders.teamAgencyPct} min={10} max={25} step={1} display={(v) => v + "%"} onChange={(v) => setSlider("teamAgencyPct", v)} />
        <Slider label="Referral bonuses (total pool)" value={sliders.referralBonus} min={0} max={60000} step={2500} display={fmt} onChange={(v) => setSlider("referralBonus", v)} />
      </Section>
      <Section title="People cost summary" color={C1}>
        <Row label="Prorated base salaries" value={fmt(c.pb)} />
        <Row label="Employer social" value={fmt(c.ps)} sub />
        <Row label="Bonus pool" value={fmt(c.pbo)} sub />
        <Row label="VSOP setup" value={fmt(sliders.vsopSetup)} sub />
        <Row label="Total recruitment cost" value={fmt(c.rcost)} />
        <Row label="Total people + recruitment" value={fmt(c.pcost + c.rcost)} hl />
      </Section>
    </>
  );
}

function InfraPanel({ sliders, setSlider, c }: { sliders: SliderState; setSlider: (k: keyof SliderState, v: number) => void; c: CalcResult }) {
  return (
    <>
      <Section title="AI & cloud" color={C3}>
        <Slider label="AI API tokens" value={sliders.aiTokens} min={5000} max={300000} step={5000} display={fmt} onChange={(v) => setSlider("aiTokens", v)} />
        <Slider label="Cloud hosting (AWS/GCP/Azure)" value={sliders.cloud} min={10000} max={300000} step={5000} display={fmt} onChange={(v) => setSlider("cloud", v)} />
        <Slider label="Database services" value={sliders.db} min={5000} max={100000} step={2500} display={fmt} onChange={(v) => setSlider("db", v)} />
        <Slider label="CI/CD & observability" value={sliders.cicd} min={2000} max={60000} step={2000} display={fmt} onChange={(v) => setSlider("cicd", v)} />
        <Slider label="Security tooling" value={sliders.secTools} min={2000} max={50000} step={2000} display={fmt} onChange={(v) => setSlider("secTools", v)} />
      </Section>
      <Section title="Workspace" color={C3}>
        <Slider label="SaaS stack (Slack, Notion, Linear)" value={sliders.saas} min={3000} max={40000} step={1000} display={fmt} onChange={(v) => setSlider("saas", v)} />
        <Slider label="Equipment per person" value={sliders.equipment} min={1500} max={6000} step={250} display={fmt} onChange={(v) => setSlider("equipment", v)} />
        <Slider label="Co-working / office (annual)" value={sliders.cowork} min={30000} max={200000} step={5000} display={fmt} onChange={(v) => setSlider("cowork", v)} />
      </Section>
      <Row label="Total infrastructure cost" value={fmt(c.ic)} hl />
      <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 8 }}>Infra ramps 40% to 70% to 100% in cash burn model.</p>
    </>
  );
}

function LegalPanel({ sliders, setSlider, c }: { sliders: SliderState; setSlider: (k: keyof SliderState, v: number) => void; c: CalcResult }) {
  return (
    <>
      <Section title="Legal & compliance" color={C4}>
        <Slider label="Entity setup (subsidiary)" value={sliders.entitySetup} min={5000} max={30000} step={1000} display={fmt} onChange={(v) => setSlider("entitySetup", v)} />
        <Slider label="Employment contracts & HR legal" value={sliders.hrLegal} min={5000} max={40000} step={1000} display={fmt} onChange={(v) => setSlider("hrLegal", v)} />
        <Slider label="IP assignment agreements" value={sliders.ipAssign} min={2000} max={20000} step={500} display={fmt} onChange={(v) => setSlider("ipAssign", v)} />
        <Slider label="Patent filings (provisional)" value={sliders.patents} min={0} max={100000} step={5000} display={fmt} onChange={(v) => setSlider("patents", v)} />
        <Slider label="GDPR / data compliance" value={sliders.gdpr} min={5000} max={40000} step={1000} display={fmt} onChange={(v) => setSlider("gdpr", v)} />
        <Slider label="Legal retainer (annual)" value={sliders.legalRetainer} min={10000} max={80000} step={2000} display={fmt} onChange={(v) => setSlider("legalRetainer", v)} />
      </Section>
      <Section title="Operations" color={C4}>
        <Slider label="Finance & accounting / payroll" value={sliders.finance} min={8000} max={50000} step={2000} display={fmt} onChange={(v) => setSlider("finance", v)} />
        <Slider label="Insurance (D&O, PI, cyber)" value={sliders.insurance} min={5000} max={40000} step={1000} display={fmt} onChange={(v) => setSlider("insurance", v)} />
        <Slider label="Travel & offsites" value={sliders.travel} min={5000} max={80000} step={2500} display={fmt} onChange={(v) => setSlider("travel", v)} />
        <Slider label="Research & intelligence" value={sliders.research} min={0} max={50000} step={2500} display={fmt} onChange={(v) => setSlider("research", v)} />
      </Section>
      <Row label="Total legal & ops cost" value={fmt(c.lc)} hl />
    </>
  );
}

function SummaryPanel({ sliders, setSlider, c }: { sliders: SliderState; setSlider: (k: keyof SliderState, v: number) => void; c: CalcResult }) {
  const maxM = Math.max(...c.monthly.map((m) => m.tot));
  const compares = [
    { label: "SoSafe Labs build (this model)", value: c.total, note: "Full control · AI-native · 12-mo ramp", color: C1 },
    { label: "Seed-stage acquihire", value: 10000000, note: "€5–15M midpoint · integration overhead", color: C5 },
    { label: "Series A acquisition", value: 40000000, note: "€20–60M midpoint · legacy constraints", color: "#B4B2A9" },
  ];

  return (
    <>
      <Section title="Full cost rollup" color={C1}>
        <Row label="People (prorated base + social + bonus + VSOP)" value={fmt(c.pcost)} />
        <Row label="  prorated base" value={fmt(c.pb)} sub />
        <Row label={`  employer social (${sliders.socialPct}%)`} value={fmt(c.ps)} sub />
        <Row label={`  bonus pool (${sliders.bonusPct}%)`} value={fmt(c.pbo)} sub />
        <Row label="Recruitment" value={fmt(c.rcost)} />
        <Row label="Infrastructure" value={fmt(c.ic)} />
        <Row label="Legal & ops" value={fmt(c.lc)} />
        <Row label="Subtotal before contingency" value={fmt(c.sub)} hl />
      </Section>
      <Section title="Contingency" color={C5}>
        <Slider label="Contingency buffer (%)" value={sliders.contingencyPct} min={0} max={25} step={1} display={(v) => v + "%"} onChange={(v) => setSlider("contingencyPct", v)} />
        <Row label={`Contingency (${sliders.contingencyPct}%)`} value={fmt(c.cont)} />
      </Section>
      <Section title="Year 1 totals" color={C1}>
        <Row label="Year 1 total investment" value={fmt(c.total)} hl />
        <Row label="Peak monthly burn" value={fmt(maxM)} />
        <Row label="Fully loaded cost per head" value={fmt(c.total / c.hc)} />
        <Row label="People % of total" value={pct(c.pcost / c.total)} />
        <Row label="Infrastructure % of total" value={pct(c.ic / c.total)} />
      </Section>
      <Section title="Build vs. acquire" color={C2}>
        {compares.map((d) => (
          <div key={d.label} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--bd)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13 }}>{d.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{fmt(d.value)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 4 }}>{d.note}</div>
            <div style={{ background: "var(--bg2)", borderRadius: 3, height: 6 }}>
              <div style={{ width: `${Math.min(100, (d.value / 40000000) * 100)}%`, height: "100%", background: d.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

function RevenuePanel({ rev, setRev, c }: { rev: RevenueState; setRev: (r: RevenueState) => void; c: CalcResult }) {
  const burnRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const setField = (k: keyof RevenueState, v: number) => setRev({ ...rev, [k]: v });

  // Cost projections: Y1 from model, Y2 grows 15%, Y3 grows 10%
  const costY1 = c.total;
  const costY2 = costY1 * 1.15;
  const costY3 = costY2 * 1.10;
  const costs = [costY1, costY2, costY3];

  const baseRev = [rev.baseY1, rev.baseY2, rev.baseY3];
  const stretchRev = [rev.stretchY1, rev.stretchY2, rev.stretchY3];
  const baseNet = baseRev.map((r, i) => r - costs[i]);
  const stretchNet = stretchRev.map((r, i) => r - costs[i]);
  const baseCumNet = baseNet.reduce<number[]>((acc, v) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + v], []);
  const stretchCumNet = stretchNet.reduce<number[]>((acc, v) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + v], []);

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme:dark)").matches;
    const ax = dark ? "#777" : "#bbb", lbl = dark ? "#aaa" : "#777";
    const tbg = dark ? "#2a2a2a" : "#fff", tbd = dark ? "#444" : "#ddd", ttx = dark ? "#eee" : "#111";

    if (burnRef.current) {
      chartRef.current?.dispose();
      const chart = echarts.init(burnRef.current);
      chartRef.current = chart;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis", backgroundColor: tbg, borderColor: tbd, textStyle: { color: ttx, fontSize: 12 },
          formatter: (params: any) => {
            let s = `<div style="font-size:12px;font-weight:500;margin-bottom:4px">${params[0].axisValue}</div>`;
            params.forEach((p: any) => { s += `<div>${p.marker}${p.seriesName}: <strong>${fmt(p.value)}</strong></div>`; });
            return s;
          },
        },
        legend: { bottom: 0, textStyle: { color: lbl, fontSize: 11 }, itemWidth: 14, itemHeight: 10 },
        grid: { left: 60, right: 12, top: 12, bottom: 40, containLabel: false },
        xAxis: { type: "category", data: YEARS, axisLine: { lineStyle: { color: ax } }, axisTick: { show: false }, axisLabel: { color: lbl, fontSize: 11 } },
        yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: dark ? "#333" : "#eee" } }, axisLabel: { color: lbl, fontSize: 11, formatter: (v: number) => fmtK(v) } },
        series: [
          { name: "Costs", type: "bar", data: costs.map(Math.round), itemStyle: { color: C5 } },
          { name: "Revenue (base)", type: "bar", data: baseRev.map(Math.round), itemStyle: { color: C1 } },
          { name: "Revenue (stretch)", type: "bar", data: stretchRev.map(Math.round), itemStyle: { color: C6 } },
        ],
      });
      const handleResize = () => chartRef.current?.resize();
      window.addEventListener("resize", handleResize);
      return () => { window.removeEventListener("resize", handleResize); chartRef.current?.dispose(); };
    }
  }, [rev, c]);

  return (
    <>
      <Section title="Revenue assumptions — base case" color={C1}>
        <p style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 8 }}>Conservative: Y1 build year (€0), first customers converting in Y2, repeatable motion in Y3.</p>
        <Slider label="Year 1 revenue" value={rev.baseY1} min={0} max={500000} step={25000} display={fmt} onChange={(v) => setField("baseY1", v)} />
        <Slider label="Year 2 revenue" value={rev.baseY2} min={0} max={2000000} step={25000} display={fmt} onChange={(v) => setField("baseY2", v)} />
        <Slider label="Year 3 revenue" value={rev.baseY3} min={0} max={5000000} step={50000} display={fmt} onChange={(v) => setField("baseY3", v)} />
      </Section>
      <Section title="Revenue assumptions — stretch case" color={C6}>
        <p style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 8 }}>Aspirational: early design-partner revenue in Y1, aggressive expansion in Y2–Y3.</p>
        <Slider label="Year 1 revenue" value={rev.stretchY1} min={0} max={1000000} step={25000} display={fmt} onChange={(v) => setField("stretchY1", v)} />
        <Slider label="Year 2 revenue" value={rev.stretchY2} min={0} max={3000000} step={25000} display={fmt} onChange={(v) => setField("stretchY2", v)} />
        <Slider label="Year 3 revenue" value={rev.stretchY3} min={0} max={5000000} step={100000} display={fmt} onChange={(v) => setField("stretchY3", v)} />
      </Section>
      <Section title="Revenue vs. cost" color={C1}>
        <div ref={burnRef} style={{ height: 280, width: "100%" }} />
      </Section>
      <Section title="3-year P&L overview" color={C5}>
        <div style={{ overflowX: "auto" }}>
          <table className="dt">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}></th>
                {YEARS.map((y) => <th key={y}>{y}</th>)}
                <th>3yr total</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Costs</td>{costs.map((v, i) => <td key={i}>{fmt(v)}</td>)}<td style={{ fontWeight: 500 }}>{fmt(costs.reduce((a, b) => a + b, 0))}</td></tr>
              <tr style={{ borderTop: "1px solid var(--bd)" }}>
                <td colSpan={5} style={{ fontWeight: 600, paddingTop: 8, paddingBottom: 4 }}>Base case</td>
              </tr>
              <tr><td style={{ paddingLeft: 12 }}>Revenue</td>{baseRev.map((v, i) => <td key={i}>{fmt(v)}</td>)}<td style={{ fontWeight: 500 }}>{fmt(baseRev.reduce((a, b) => a + b, 0))}</td></tr>
              <tr><td style={{ paddingLeft: 12 }}>Net</td>{baseNet.map((v, i) => <td key={i} style={{ color: v < 0 ? "#D85A30" : C2 }}>{fmt(v)}</td>)}<td style={{ fontWeight: 500, color: baseNet.reduce((a, b) => a + b, 0) < 0 ? "#D85A30" : C2 }}>{fmt(baseNet.reduce((a, b) => a + b, 0))}</td></tr>
              <tr><td style={{ paddingLeft: 12 }}>Cumulative</td>{baseCumNet.map((v, i) => <td key={i} style={{ color: v < 0 ? "#D85A30" : C2 }}>{fmt(v)}</td>)}<td /></tr>
              <tr style={{ borderTop: "1px solid var(--bd)" }}>
                <td colSpan={5} style={{ fontWeight: 600, paddingTop: 8, paddingBottom: 4 }}>Stretch case</td>
              </tr>
              <tr><td style={{ paddingLeft: 12 }}>Revenue</td>{stretchRev.map((v, i) => <td key={i}>{fmt(v)}</td>)}<td style={{ fontWeight: 500 }}>{fmt(stretchRev.reduce((a, b) => a + b, 0))}</td></tr>
              <tr><td style={{ paddingLeft: 12 }}>Net</td>{stretchNet.map((v, i) => <td key={i} style={{ color: v < 0 ? "#D85A30" : C2 }}>{fmt(v)}</td>)}<td style={{ fontWeight: 500, color: stretchNet.reduce((a, b) => a + b, 0) < 0 ? "#D85A30" : C2 }}>{fmt(stretchNet.reduce((a, b) => a + b, 0))}</td></tr>
              <tr><td style={{ paddingLeft: 12 }}>Cumulative</td>{stretchCumNet.map((v, i) => <td key={i} style={{ color: v < 0 ? "#D85A30" : C2 }}>{fmt(v)}</td>)}<td /></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 10 }}>Cost projection assumes Y2 +15% and Y3 +10% growth over the modelled Y1 total. Adjust revenue sliders to test scenarios.</p>
      </Section>
    </>
  );
}

function BurnPanel({ c }: { c: CalcResult }) {
  const burnRef = useRef<HTMLDivElement>(null);
  const cumRef = useRef<HTMLDivElement>(null);
  const burnChartRef = useRef<echarts.ECharts | null>(null);
  const cumChartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme:dark)").matches;
    const ax = dark ? "#777" : "#bbb", lbl = dark ? "#aaa" : "#777";
    const tbg = dark ? "#2a2a2a" : "#fff", tbd = dark ? "#444" : "#ddd", ttx = dark ? "#eee" : "#111";
    const baseGrid = { left: 54, right: 12, top: 8, bottom: 28, containLabel: false };
    const baseXAxis = { type: "category" as const, data: MONTHS, axisLine: { lineStyle: { color: ax } }, axisTick: { show: false }, axisLabel: { color: lbl, fontSize: 11 } };
    const baseYAxis = { type: "value" as const, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: dark ? "#333" : "#eee" } }, axisLabel: { color: lbl, fontSize: 11, formatter: (v: number) => fmtK(v) } };

    if (burnRef.current) {
      burnChartRef.current?.dispose();
      const chart = echarts.init(burnRef.current);
      burnChartRef.current = chart;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis", backgroundColor: tbg, borderColor: tbd, textStyle: { color: ttx, fontSize: 12 },
          formatter: (params: any) => {
            let s = `<div style="font-size:12px;font-weight:500;margin-bottom:4px">${params[0].axisValue}</div>`;
            let tot = 0;
            params.forEach((p: any) => { if (p.value) { s += `<div>${p.marker}${p.seriesName}: <strong>${fmtK(p.value)}</strong></div>`; tot += p.value; } });
            s += `<div style="margin-top:4px;border-top:1px solid ${tbd};padding-top:4px">Total: <strong>${fmtK(tot)}</strong></div>`;
            return s;
          },
        },
        grid: baseGrid, xAxis: baseXAxis, yAxis: baseYAxis,
        series: [
          { name: "People", type: "bar", stack: "b", data: c.monthly.map((m) => Math.round(m.pc)), itemStyle: { color: C1 } },
          { name: "Recruitment", type: "bar", stack: "b", data: c.monthly.map((m) => Math.round(m.rc)), itemStyle: { color: C2 } },
          { name: "Infra & setup", type: "bar", stack: "b", data: c.monthly.map((m) => Math.round(m.ai)), itemStyle: { color: C3 } },
          { name: "Legal & Ops", type: "bar", stack: "b", data: c.monthly.map((m) => Math.round(m.lo)), itemStyle: { color: C4, borderRadius: [3, 3, 0, 0] } },
        ],
      });
    }

    if (cumRef.current) {
      cumChartRef.current?.dispose();
      const chart = echarts.init(cumRef.current);
      cumChartRef.current = chart;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis", backgroundColor: tbg, borderColor: tbd, textStyle: { color: ttx, fontSize: 12 },
          formatter: (params: any) => `<div style="font-size:12px"><strong>${params[0].axisValue}</strong><br>Cumulative: <strong>${fmt(params[0].value)}</strong></div>`,
        },
        grid: baseGrid, xAxis: baseXAxis, yAxis: baseYAxis,
        series: [{
          name: "Cumulative", type: "line", smooth: true,
          data: c.cumulative.map((v) => Math.round(v)),
          itemStyle: { color: C1 }, lineStyle: { color: C1, width: 2 },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: C1 + "55" }, { offset: 1, color: C1 + "08" }] } },
          symbol: "circle", symbolSize: 5,
        }],
      });
    }

    const handleResize = () => { burnChartRef.current?.resize(); cumChartRef.current?.resize(); };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      burnChartRef.current?.dispose();
      cumChartRef.current?.dispose();
    };
  }, [c]);

  const legends: [string, string][] = [["People", C1], ["Recruitment", C2], ["Infra & setup", C3], ["Legal & Ops", C4]];
  let cum = 0;

  return (
    <>
      <Section title="Monthly cash burn by category" color={C3}>
        <div className="leg">
          {legends.map(([name, color]) => (
            <div className="leg-i" key={name}><div className="leg-d" style={{ background: color }} />{name}</div>
          ))}
        </div>
        <div ref={burnRef} style={{ height: 260, width: "100%" }} />
      </Section>
      <Section title="Cumulative cash burn" color={C1}>
        <div ref={cumRef} style={{ height: 200, width: "100%" }} />
      </Section>
      <Section title="Monthly detail" color={C5}>
        <div style={{ overflowX: "auto" }}>
          <table className="dt">
            <thead>
              <tr>
                {["Month", "People", "Recruit", "Infra", "Legal/Ops", "Total", "Cumulative"].map((s, i) => (
                  <th key={s} style={i === 0 ? { textAlign: "left" } : undefined}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.monthly.map((m, i) => {
                cum += m.tot;
                return (
                  <tr key={i}>
                    <td>{MONTHS[i]}</td>
                    <td>{fmtK(m.pc)}</td>
                    <td style={{ color: m.rc > 0 ? C2 : "var(--tx3)" }}>{m.rc > 0 ? fmtK(m.rc) : "—"}</td>
                    <td>{fmtK(m.ai)}</td>
                    <td>{fmtK(m.lo)}</td>
                    <td style={{ fontWeight: 500 }}>{fmtK(m.tot)}</td>
                    <td style={{ color: "var(--tx2)" }}>{fmtK(cum)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

// ── Main app ───────────────────────────────────────────────────────────
export default function CostModel() {
  const [tab, setTab] = useState(0);
  const [roles, setRoles] = useState<RoleDef[]>(DEFAULT_ROLES);
  const [sliders, setSliders] = useState<SliderState>(DEFAULT_SLIDERS);
  const [revenue, setRevenue] = useState<RevenueState>(DEFAULT_REVENUE);

  const setSlider = useCallback((key: keyof SliderState, value: number) => {
    setSliders((prev) => ({ ...prev, [key]: value }));
  }, []);

  const c = calc(roles, sliders);
  const maxM = Math.max(...c.monthly.map((m) => m.tot));

  const breakdownItems: [string, number, string][] = [
    ["People", c.pcost, C1], ["Recruitment", c.rcost, C2], ["Infra", c.ic, C3], ["Legal & Ops", c.lc, C4], ["Contingency", c.cont, C5],
  ];
  const mx = Math.max(...breakdownItems.map((i) => i[1]));

  return (
    <>
      {/* Metrics */}
      <div className="metrics">
        <div className="mc"><div className="mc-lbl">Year 1 total</div><div className="mc-val">{fmt(c.total)}</div><div className="mc-sub">{c.hc} active roles</div></div>
        <div className="mc"><div className="mc-lbl">People cost</div><div className="mc-val">{fmt(c.pcost)}</div><div className="mc-sub">{pct(c.pcost / c.total)} of total</div></div>
        <div className="mc"><div className="mc-lbl">Peak monthly burn</div><div className="mc-val">{fmt(maxM)}</div><div className="mc-sub">at full ramp</div></div>
        <div className="mc"><div className="mc-lbl">Cost per head</div><div className="mc-val">{fmt(c.total / c.hc)}</div><div className="mc-sub">fully loaded</div></div>
      </div>

      {/* Breakdown bars */}
      <div className="mbars">
        {breakdownItems.map(([label, value, color]) => (
          <div className="mbar" key={label}>
            <div className="mbar-lbl">{label}</div>
            <div className="mbar-trk"><div className="mbar-fil" style={{ width: `${Math.max(2, (value / mx) * 100)}%`, background: color }} /></div>
            <div className="mbar-v">{fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`tab${tab === i ? " on" : ""}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && <TeamPanel roles={roles} setRoles={setRoles} />}
      {tab === 1 && <CompPanel sliders={sliders} setSlider={setSlider} c={c} />}
      {tab === 2 && <InfraPanel sliders={sliders} setSlider={setSlider} c={c} />}
      {tab === 3 && <LegalPanel sliders={sliders} setSlider={setSlider} c={c} />}
      {tab === 4 && <SummaryPanel sliders={sliders} setSlider={setSlider} c={c} />}
      {tab === 5 && <RevenuePanel rev={revenue} setRev={setRevenue} c={c} />}
      {tab === 6 && <BurnPanel c={c} />}
    </>
  );
}
