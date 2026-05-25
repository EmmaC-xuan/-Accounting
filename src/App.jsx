import { useState, useRef, useCallback } from "react";

const DEFAULT_CATEGORIES = ["餐飲", "交通", "購物", "娛樂", "醫療", "住房", "教育", "旅遊", "保險", "其他"];
const INCOME_CATEGORIES = ["薪資", "獎金", "股票", "其他"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const C = {
  bg: "#0f1117", card: "#1a1d27", card2: "#22263a", border: "#2e3350",
  accent: "#6c63ff", green: "#22c55e", red: "#ef4444", yellow: "#f59e0b",
  blue: "#3b82f6", text: "#e2e8f0", muted: "#94a3b8", tag: "#2d3149",
};

const inputStyle = { background:"#22263a", border:"1px solid #2e3350", borderRadius:10, color:"#e2e8f0", padding:"10px 14px", width:"100%", fontSize:15, boxSizing:"border-box", outline:"none" };
const labelStyle = { fontSize:12, color:"#94a3b8", marginBottom:6, display:"block" };


function UField({ label, refKey, refs, placeholder }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={labelStyle}>{label}</label>
      <input ref={refs[refKey]} style={inputStyle} type="text" inputMode="decimal" placeholder={placeholder} />
    </div>
  );
}

const PAY_TYPES = [
  { id: "cash", label: "現金", icon: "💵", color: C.green },
  { id: "account", label: "帳戶", icon: "🏦", color: C.blue },
  { id: "credit", label: "信用卡", icon: "💳", color: C.yellow },
];

function autoClassify(desc) {
  const d = desc.toLowerCase();
  if (/超商|7-eleven|全家|萊爾富|ok|便利/.test(d)) return "購物";
  if (/餐|飯|麵|咖啡|早餐|午餐|晚餐|食|吃|飲|小吃|拉麵|火鍋|燒烤/.test(d)) return "餐飲";
  if (/捷運|公車|計程車|uber|taxi|停車|加油|高鐵|火車|機票/.test(d)) return "交通";
  if (/netflix|youtube|電影|遊戲|ktv|演唱會|展覽/.test(d)) return "娛樂";
  if (/醫院|診所|藥局|藥|掛號|健保/.test(d)) return "醫療";
  if (/房租|水電|瓦斯|管理費/.test(d)) return "住房";
  if (/學費|書|課程|補習/.test(d)) return "教育";
  if (/旅館|hotel|機票|旅遊/.test(d)) return "旅遊";
  return null;
}

function fmt(n) { return "NT$ " + Number(n).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}); }
function fmtN(n) { return Number(n).toFixed(1); }
function getMonthKey(y, m) { return `${y}-${String(m+1).padStart(2,"0")}`; }
const today = () => new Date().toISOString().slice(0,10);

const initState = () => {
  try { const s = localStorage.getItem("budget_app_v3"); if (s) return JSON.parse(s); } catch {}
  return { transactions: [], creditBills: [], customCategories: [] };
};

// Utility result state only (no controlled inputs)
const initResult = () => ({ elec: null, water: null, gas: null });

export default function App() {
  const now = new Date();
  const [state, setState] = useState(initState);
  const [view, setView] = useState("dashboard");
  const [utilTab, setUtilTab] = useState("elec");
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [form, setForm] = useState({ type:"expense", payType:"cash", amount:"", desc:"", category:"餐飲", incomeCategory:"薪資", date:today(), autocat:false });
  const [billForm, setBillForm] = useState({ amount:"", date:today(), card:"信用卡", note:"" });
  const [newCat, setNewCat] = useState("");
  const [results, setResults] = useState(initResult);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Refs for utility inputs (uncontrolled)
  const eRef = {
    totalBill: useRef(), flowElec: useRef(), totalKwh: useRef(),
    pubElec: useRef(), prevMeter: useRef(), curMeter: useRef(),
    date: useRef(), note: useRef(),
  };
  const wRef = { totalBill: useRef(), date: useRef(), note: useRef() };
  const gRef = { totalBill: useRef(), date: useRef(), note: useRef() };

  const allCats = [...DEFAULT_CATEGORIES, ...state.customCategories];
  const save = (s) => { try { localStorage.setItem("budget_app_v3", JSON.stringify(s)); } catch {} };

  function showToast(msg, color=C.green) {
    setToast({ msg, color });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  function handleDescChange(val) {
    const cat = autoClassify(val);
    setForm(f => ({ ...f, desc:val, category:cat||f.category, autocat:!!cat }));
  }

  function addTransaction(override) {
    const t = override || form;
    if (!t.amount || isNaN(t.amount) || Number(t.amount) <= 0) { showToast("請輸入正確金額", C.red); return false; }
    if (!override && !t.desc.trim()) { showToast("請輸入描述", C.red); return false; }
    const rec = { id: Date.now()+Math.random(), ...t, amount:Number(t.amount) };
    setState(s => { const ns={...s, transactions:[rec,...s.transactions]}; save(ns); return ns; });
    if (!override) setForm(f => ({ ...f, amount:"", desc:"", autocat:false }));
    showToast("已新增記錄 ✓");
    return true;
  }

  function addBill() {
    if (!billForm.amount || isNaN(billForm.amount) || Number(billForm.amount)<=0) { showToast("請輸入正確帳單金額", C.red); return; }
    const b = { id:Date.now(), ...billForm, amount:Number(billForm.amount) };
    setState(s => { const ns={...s, creditBills:[b,...s.creditBills]}; save(ns); return ns; });
    setBillForm(f => ({ ...f, amount:"", note:"" }));
    showToast("帳單已記錄 ✓");
  }

  function deleteTransaction(id) {
    setState(s => { const ns={...s, transactions:s.transactions.filter(t=>t.id!==id)}; save(ns); return ns; });
    showToast("已刪除", C.red);
  }
  function deleteBill(id) {
    setState(s => { const ns={...s, creditBills:s.creditBills.filter(b=>b.id!==id)}; save(ns); return ns; });
    showToast("已刪除", C.red);
  }
  function addCategory() {
    const c = newCat.trim();
    if (!c || allCats.includes(c)) { showToast("分類已存在或無效", C.red); return; }
    setState(s => { const ns={...s, customCategories:[...s.customCategories,c]}; save(ns); return ns; });
    setNewCat(""); showToast("分類已新增 ✓");
  }

  function calcElec() {
    const v = k => parseFloat(eRef[k].current?.value);
    const [totalBill,flowElec,totalKwh,pubElec,prevMeter,curMeter] = ["totalBill","flowElec","totalKwh","pubElec","prevMeter","curMeter"].map(v);
    if ([totalBill,flowElec,totalKwh,pubElec,prevMeter,curMeter].some(isNaN)) { showToast("電費資料不完整", C.red); return; }
    if (curMeter<=prevMeter) { showToast("本次錶數須大於上次錶數", C.red); return; }
    const pricePerKwh = flowElec/totalKwh;
    const theirKwh = curMeter-prevMeter;
    const theirElec = theirKwh*pricePerKwh + pubElec/2;
    const myElec = totalBill-theirElec;
    setResults(r => ({ ...r, elec:{ pricePerKwh, theirKwh, theirElec, myElec, totalBill, flowElec, totalKwh, pubElec, prevMeter, curMeter, date: eRef.date.current?.value||today(), note: eRef.note.current?.value||"" } }));
  }

  function calcWater() {
    const totalBill = parseFloat(wRef.totalBill.current?.value);
    if (isNaN(totalBill)||totalBill<=0) { showToast("請輸入正確水費金額", C.red); return; }
    setResults(r => ({ ...r, water:{ totalBill, myWater:totalBill/2, theirWater:totalBill/2, date: wRef.date.current?.value||today(), note: wRef.note.current?.value||"" } }));
  }

  function calcGas() {
    const totalBill = parseFloat(gRef.totalBill.current?.value);
    if (isNaN(totalBill)||totalBill<=0) { showToast("請輸入正確瓦斯費金額", C.red); return; }
    setResults(r => ({ ...r, gas:{ totalBill, myGas:totalBill/2, theirGas:totalBill/2, date: gRef.date.current?.value||today(), note: gRef.note.current?.value||"" } }));
  }

  function recordElec() {
    const r = results.elec; if (!r) return;
    addTransaction({ type:"expense", payType:"account", category:"住房", date:r.date, desc:`電費${r.note?`（${r.note}）`:""}`, amount:r.myElec, incomeCategory:"薪資", autocat:false });
  }
  function recordWater() {
    const r = results.water; if (!r) return;
    addTransaction({ type:"expense", payType:"account", category:"住房", date:r.date, desc:`水費${r.note?`（${r.note}）`:""}`, amount:r.myWater, incomeCategory:"薪資", autocat:false });
  }
  function recordGas() {
    const r = results.gas; if (!r) return;
    addTransaction({ type:"expense", payType:"account", category:"住房", date:r.date, desc:`瓦斯費${r.note?`（${r.note}）`:""}`, amount:r.myGas, incomeCategory:"薪資", autocat:false });
  }

  const mk = getMonthKey(selYear, selMonth);
  const monthTxs = state.transactions.filter(t => t.date.startsWith(mk));
  const monthBills = state.creditBills.filter(b => b.date.startsWith(mk));
  const income = monthTxs.filter(t=>t.type==="income").reduce((a,t)=>a+t.amount,0);
  const cashExp = monthTxs.filter(t=>t.type==="expense"&&t.payType==="cash").reduce((a,t)=>a+t.amount,0);
  const accountExp = monthTxs.filter(t=>t.type==="expense"&&t.payType==="account").reduce((a,t)=>a+t.amount,0);
  const creditBillTotal = monthBills.reduce((a,b)=>a+b.amount,0);
  const totalExp = cashExp+accountExp+creditBillTotal;
  const balance = income-totalExp;

  const catBreakdown = {};
  monthTxs.filter(t=>t.type==="expense"&&t.payType!=="credit").forEach(t => { catBreakdown[t.category]=(catBreakdown[t.category]||0)+t.amount; });
  const catList = Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]);
  const catTotal = catList.reduce((a,c)=>a+c[1],0)||1;
  const catColors = ["#6c63ff","#22c55e","#f59e0b","#3b82f6","#ec4899","#14b8a6","#f97316","#8b5cf6","#ef4444"];

  const s = {
    app: { background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Segoe UI',system-ui,sans-serif", paddingBottom:80 },
    header: { background:C.card, borderBottom:`1px solid ${C.border}`, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" },
    nav: { position:"fixed", bottom:0, left:0, right:0, background:C.card, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-around", padding:"10px 0 12px" },
    navBtn: (a) => ({ background:"none", border:"none", color:a?C.accent:C.muted, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:10, fontWeight:a?700:400 }),
    card: { background:C.card, borderRadius:16, padding:"18px", marginBottom:14, border:`1px solid ${C.border}` },
    label: { fontSize:12, color:C.muted, marginBottom:6, display:"block" },
    input: { background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, padding:"10px 14px", width:"100%", fontSize:15, boxSizing:"border-box", outline:"none" },
    btn: (color=C.accent) => ({ background:color, border:"none", borderRadius:10, color:"#fff", padding:"12px 0", width:"100%", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:8 }),
    tag: (a,color=C.accent) => ({ background:a?color:C.tag, border:`1px solid ${a?color:C.border}`, borderRadius:8, color:a?"#fff":C.muted, padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:a?700:400 }),
    statCard: (color) => ({ background:C.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.border}`, borderLeft:`4px solid ${color}`, flex:1, minWidth:0 }),
    row: { display:"flex", gap:10 },
    rRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", fontSize:14 },
    divider: { height:1, background:C.border, margin:"10px 0" },
  };



  const ResultSummary = ({ myAmt, theirAmt, onRecord, onReset }) => (
    <>
      <div style={{ background:"#1a1340", borderRadius:12, padding:"16px", border:`1px solid ${C.accent}`, marginTop:12 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.accent }}>💰 分攤結果</div>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1, background:C.card2, borderRadius:10, padding:"12px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>對方應付</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.yellow }}>{fmt(theirAmt)}</div>
          </div>
          <div style={{ flex:1, background:C.card2, borderRadius:10, padding:"12px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>我的份額</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.green }}>{fmt(myAmt)}</div>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:10 }}>
        <button style={{ ...s.btn(C.card2), flex:1, border:`1px solid ${C.border}`, marginTop:0 }} onClick={onReset}>← 重算</button>
        <button style={{ ...s.btn(C.green), flex:1, marginTop:0 }} onClick={onRecord}>記入帳本 ✓</button>
      </div>
    </>
  );

  return (
    <div style={s.app}>
      {toast && (
        <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:toast.color, color:"#fff", borderRadius:10, padding:"10px 22px", fontWeight:600, zIndex:9999, fontSize:14, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}

      <div style={s.header}>
        <span style={{ fontSize:20, fontWeight:700, letterSpacing:1 }}>💰 記帳本</span>
        <span style={{ color:C.muted, fontSize:13 }}>{selYear} / {MONTHS[selMonth]}</span>
      </div>

      <div style={{ padding:"16px 16px 0" }}>

        {view==="dashboard" && (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
              <button onClick={()=>{ let m=selMonth-1,y=selYear; if(m<0){m=11;y--;} setSelMonth(m);setSelYear(y); }} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"6px 14px", cursor:"pointer", fontSize:16 }}>‹</button>
              <div style={{ flex:1, textAlign:"center", fontWeight:700, fontSize:16 }}>{selYear} 年 {MONTHS[selMonth]}</div>
              <button onClick={()=>{ let m=selMonth+1,y=selYear; if(m>11){m=0;y++;} setSelMonth(m);setSelYear(y); }} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"6px 14px", cursor:"pointer", fontSize:16 }}>›</button>
            </div>
            <div style={{ ...s.row, marginBottom:10 }}>
              <div style={s.statCard(C.green)}><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>收入</div><div style={{ fontSize:17, fontWeight:700, color:C.green }}>{fmt(income)}</div></div>
              <div style={s.statCard(C.red)}><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>支出</div><div style={{ fontSize:17, fontWeight:700, color:C.red }}>{fmt(totalExp)}</div></div>
            </div>
            <div style={{ ...s.card, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:C.muted, fontSize:13 }}>結餘</span>
                <span style={{ fontSize:22, fontWeight:800, color:balance>=0?C.green:C.red }}>{fmt(balance)}</span>
              </div>
              <div style={{ marginTop:10, display:"flex", gap:12, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, color:C.muted }}>💵 現金 <b style={{color:C.text}}>{fmt(cashExp)}</b></span>
                <span style={{ fontSize:12, color:C.muted }}>🏦 帳戶 <b style={{color:C.text}}>{fmt(accountExp)}</b></span>
                <span style={{ fontSize:12, color:C.muted }}>💳 帳單 <b style={{color:C.text}}>{fmt(creditBillTotal)}</b></span>
              </div>
            </div>
            {catList.length>0 && (
              <div style={s.card}>
                <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>支出分類</div>
                {catList.map(([cat,amt],i) => (
                  <div key={cat} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:3 }}>
                      <span>{cat}</span><span style={{ color:C.muted }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ background:C.card2, borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{ width:`${(amt/catTotal)*100}%`, background:catColors[i%catColors.length], height:"100%", borderRadius:4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontWeight:700, fontSize:14, margin:"14px 0 8px" }}>最近記錄</div>
            {state.transactions.slice(0,5).map(t => (
              <div key={t.id} style={{ ...s.card, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{t.desc}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{t.type==="income"?(t.incomeCategory||"收入"):t.category} · {t.date} · {PAY_TYPES.find(p=>p.id===t.payType)?.label}</div>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:t.type==="income"?C.green:(t.payType==="credit"?C.yellow:C.red) }}>
                  {t.type==="income"?"+":"-"}{fmt(t.amount)}
                </div>
              </div>
            ))}
            {state.transactions.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:30, fontSize:14 }}>尚無記錄，點下方 ＋ 開始記帳</div>}
          </>
        )}

        {view==="add" && (
          <div style={s.card}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>新增記錄</div>
            <label style={s.label}>類型</label>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              {[["income","收入"],["expense","支出"]].map(([v,l]) => (
                <button key={v} style={s.tag(form.type===v, v==="income"?C.green:C.red)} onClick={()=>setForm(f=>({...f,type:v}))}>{l}</button>
              ))}
            </div>
            {form.type==="income" && (
              <>
                <label style={s.label}>收入分類</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  {INCOME_CATEGORIES.map(c => (
                    <button key={c} style={s.tag(form.incomeCategory===c, C.green)} onClick={()=>setForm(f=>({...f,incomeCategory:c}))}>{c}</button>
                  ))}
                </div>
              </>
            )}
            {form.type==="expense" && (
              <>
                <label style={s.label}>付款方式</label>
                <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                  {PAY_TYPES.map(p => (
                    <button key={p.id} style={s.tag(form.payType===p.id, p.color)} onClick={()=>setForm(f=>({...f,payType:p.id}))}>{p.icon} {p.label}</button>
                  ))}
                </div>
                {form.payType==="credit" && (
                  <div style={{ background:"#2a2200", border:`1px solid ${C.yellow}`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.yellow, marginBottom:14 }}>
                    💡 信用卡消費不計入當月支出，請至「帳單」頁繳費時再記錄帳單金額。
                  </div>
                )}
              </>
            )}
            <label style={s.label}>金額 (NT$)</label>
            <input style={{ ...s.input, marginBottom:14 }} type="number" placeholder="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
            <label style={s.label}>描述 {form.autocat && <span style={{ color:C.accent, fontSize:11 }}>✨ 自動分類: {form.category}</span>}</label>
            <input style={{ ...s.input, marginBottom:14 }} placeholder="例：麥當勞、捷運、Netflix..." value={form.desc} onChange={e=>handleDescChange(e.target.value)} />
            {form.type==="expense" && (
              <>
                <label style={s.label}>分類</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  {allCats.map(c => (
                    <button key={c} style={s.tag(form.category===c)} onClick={()=>setForm(f=>({...f,category:c,autocat:false}))}>{c}</button>
                  ))}
                </div>
              </>
            )}
            <label style={s.label}>日期</label>
            <input style={{ ...s.input, marginBottom:16 }} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
            <button style={s.btn()} onClick={()=>addTransaction()}>＋ 新增</button>
          </div>
        )}

        {view==="bills" && (
          <>
            <div style={s.card}>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>💳 繳信用卡帳單</div>
              <label style={s.label}>卡別</label>
              <input style={{ ...s.input, marginBottom:14 }} placeholder="例：玉山信用卡" value={billForm.card} onChange={e=>setBillForm(f=>({...f,card:e.target.value}))} />
              <label style={s.label}>帳單金額 (NT$)</label>
              <input style={{ ...s.input, marginBottom:14 }} type="number" placeholder="0" value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))} />
              <label style={s.label}>繳款日期</label>
              <input style={{ ...s.input, marginBottom:14 }} type="date" value={billForm.date} onChange={e=>setBillForm(f=>({...f,date:e.target.value}))} />
              <label style={s.label}>備註</label>
              <input style={{ ...s.input, marginBottom:16 }} placeholder="選填" value={billForm.note} onChange={e=>setBillForm(f=>({...f,note:e.target.value}))} />
              <button style={s.btn(C.yellow)} onClick={addBill}>記錄帳單繳費</button>
            </div>
            <div style={{ fontWeight:700, fontSize:14, margin:"8px 0 10px" }}>帳單記錄</div>
            {state.creditBills.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:24, fontSize:14 }}>尚無帳單記錄</div>}
            {state.creditBills.map(b => (
              <div key={b.id} style={{ ...s.card, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{b.card}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{b.date}{b.note?` · ${b.note}`:""}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16, fontWeight:700, color:C.yellow }}>-{fmt(b.amount)}</span>
                  <button onClick={()=>deleteBill(b.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16 }}>🗑</button>
                </div>
              </div>
            ))}
          </>
        )}

        {view==="utility" && (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[["elec","⚡","電費"],["water","💧","水費"],["gas","🔥","瓦斯"]].map(([k,icon,label]) => (
                <button key={k} style={{ ...s.tag(utilTab===k), flex:1, textAlign:"center" }} onClick={()=>setUtilTab(k)}>{icon} {label}</button>
              ))}
            </div>

            {/* ELECTRIC */}
            {utilTab==="elec" && (
              !results.elec ? (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>⚡ 電費計算</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>對方有獨立電表，依度數比例分攤</div>
                  <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>帳單日期</label>
                      <input ref={eRef.date} defaultValue={today()} style={s.input} type="date" />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>備註（幾月帳單）</label>
                      <input ref={eRef.note} style={s.input} placeholder="例：5月帳單" />
                    </div>
                  </div>
                  <UField label="帳單總金額 (NT$)" refKey="totalBill" refs={eRef} placeholder="例：6000" />
                  <UField label="流動電費 (NT$)" refKey="flowElec" refs={eRef} placeholder="例：5562" />
                  <UField label="本期總度數 (度)" refKey="totalKwh" refs={eRef} placeholder="例：1645" />
                  <UField label="公共電費 (NT$)" refKey="pubElec" refs={eRef} placeholder="例：142.2" />
                  <div style={s.divider} />
                  <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>對方獨立電表</div>
                  <UField label="上次錶數 (度)" refKey="prevMeter" refs={eRef} placeholder="例：32440" />
                  <UField label="本次錶數 (度)" refKey="curMeter" refs={eRef} placeholder="例：33655" />
                  <button style={s.btn(C.accent)} onClick={calcElec}>計算電費分攤</button>
                </div>
              ) : (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:2 }}>⚡ 電費明細</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>{results.elec.date}{results.elec.note ? ` · ${results.elec.note}` : ""}</div>
                  <div style={{ background:C.card2, borderRadius:12, padding:14 }}>
                    <div style={s.rRow}><span style={{ color:C.muted }}>帳單總金額</span><span style={{ fontWeight:700 }}>{fmt(results.elec.totalBill)}</span></div>
                    <div style={s.rRow}><span style={{ color:C.muted }}>流動電費</span><span style={{ fontWeight:700 }}>{fmt(results.elec.flowElec)}</span></div>
                    <div style={s.rRow}><span style={{ color:C.muted }}>本期總度數</span><span style={{ fontWeight:700 }}>{results.elec.totalKwh} 度</span></div>
                    <div style={s.rRow}><span style={{ color:C.muted }}>一度電費</span><span style={{ fontWeight:700 }}>NT$ {fmtN(results.elec.pricePerKwh)}</span></div>
                    <div style={s.divider} />
                    <div style={s.rRow}><span style={{ color:C.muted }}>對方本期用電</span><span style={{ fontWeight:700 }}>{fmtN(results.elec.theirKwh)} 度（{results.elec.curMeter} - {results.elec.prevMeter}）</span></div>
                    <div style={s.rRow}><span style={{ color:C.muted }}>公共電費各半</span><span style={{ fontWeight:700 }}>NT$ {fmtN(results.elec.pubElec/2)}</span></div>
                    <div style={s.divider} />
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>對方電費</span><span style={{ color:C.yellow, fontWeight:800, fontSize:17 }}>{fmt(results.elec.theirElec)}</span></div>
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>我的電費</span><span style={{ color:C.green, fontWeight:800, fontSize:17 }}>{fmt(results.elec.myElec)}</span></div>
                  </div>
                  <ResultSummary myAmt={results.elec.myElec} theirAmt={results.elec.theirElec} onRecord={recordElec} onReset={()=>setResults(r=>({...r,elec:null}))} />
                </div>
              )
            )}

            {/* WATER */}
            {utilTab==="water" && (
              !results.water ? (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>💧 水費計算</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>帳單總額各付一半</div>
                  <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>帳單日期</label>
                      <input ref={wRef.date} defaultValue={today()} style={s.input} type="date" />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>備註（幾月帳單）</label>
                      <input ref={wRef.note} style={s.input} placeholder="例：5月帳單" />
                    </div>
                  </div>
                  <UField label="帳單總金額 (NT$)" refKey="totalBill" refs={wRef} placeholder="例：600" />
                  <button style={s.btn(C.blue)} onClick={calcWater}>計算水費分攤</button>
                </div>
              ) : (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:2 }}>💧 水費明細</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>{results.water.date}{results.water.note ? ` · ${results.water.note}` : ""}</div>
                  <div style={{ background:C.card2, borderRadius:12, padding:14 }}>
                    <div style={s.rRow}><span style={{ color:C.muted }}>帳單總金額</span><span style={{ fontWeight:700 }}>{fmt(results.water.totalBill)}</span></div>
                    <div style={s.divider} />
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>對方水費</span><span style={{ color:C.yellow, fontWeight:800, fontSize:17 }}>{fmt(results.water.theirWater)}</span></div>
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>我的水費</span><span style={{ color:C.green, fontWeight:800, fontSize:17 }}>{fmt(results.water.myWater)}</span></div>
                  </div>
                  <ResultSummary myAmt={results.water.myWater} theirAmt={results.water.theirWater} onRecord={recordWater} onReset={()=>setResults(r=>({...r,water:null}))} />
                </div>
              )
            )}

            {/* GAS */}
            {utilTab==="gas" && (
              !results.gas ? (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>🔥 瓦斯費計算</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>帳單總額各付一半</div>
                  <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>帳單日期</label>
                      <input ref={gRef.date} defaultValue={today()} style={s.input} type="date" />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={s.label}>備註（幾月帳單）</label>
                      <input ref={gRef.note} style={s.input} placeholder="例：5月帳單" />
                    </div>
                  </div>
                  <UField label="帳單總金額 (NT$)" refKey="totalBill" refs={gRef} placeholder="例：800" />
                  <button style={s.btn(C.red)} onClick={calcGas}>計算瓦斯費分攤</button>
                </div>
              ) : (
                <div style={s.card}>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:2 }}>🔥 瓦斯費明細</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>{results.gas.date}{results.gas.note ? ` · ${results.gas.note}` : ""}</div>
                  <div style={{ background:C.card2, borderRadius:12, padding:14 }}>
                    <div style={s.rRow}><span style={{ color:C.muted }}>帳單總金額</span><span style={{ fontWeight:700 }}>{fmt(results.gas.totalBill)}</span></div>
                    <div style={s.divider} />
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>對方瓦斯費</span><span style={{ color:C.yellow, fontWeight:800, fontSize:17 }}>{fmt(results.gas.theirGas)}</span></div>
                    <div style={s.rRow}><span style={{ color:C.text, fontWeight:600 }}>我的瓦斯費</span><span style={{ color:C.green, fontWeight:800, fontSize:17 }}>{fmt(results.gas.myGas)}</span></div>
                  </div>
                  <ResultSummary myAmt={results.gas.myGas} theirAmt={results.gas.theirGas} onRecord={recordGas} onReset={()=>setResults(r=>({...r,gas:null}))} />
                </div>
              )
            )}
          </>
        )}

        {view==="history" && (
          <>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:14 }}>所有記錄</div>
            {state.transactions.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:40, fontSize:14 }}>尚無記錄</div>}
            {state.transactions.map(t => (
              <div key={t.id} style={{ ...s.card, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{t.desc}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {t.type==="income"?(t.incomeCategory||"收入"):t.category} · {t.date} · {PAY_TYPES.find(p=>p.id===t.payType)?.icon}{PAY_TYPES.find(p=>p.id===t.payType)?.label}
                    {t.payType==="credit" && <span style={{ color:C.yellow, marginLeft:4 }}>（不計入支出）</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginLeft:8 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:t.type==="income"?C.green:(t.payType==="credit"?C.yellow:C.red), whiteSpace:"nowrap" }}>
                    {t.type==="income"?"+":"-"}{fmt(t.amount)}
                  </span>
                  <button onClick={()=>deleteTransaction(t.id)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16 }}>🗑</button>
                </div>
              </div>
            ))}
          </>
        )}

      </div>

      <nav style={s.nav}>
        {[["dashboard","📊","總覽"],["add","➕","記帳"],["bills","💳","帳單"],["utility","💡","水電"],["history","📋","記錄"]].map(([v,icon,label]) => (
          <button key={v} style={s.navBtn(view===v)} onClick={()=>setView(v)}>
            <span style={{ fontSize:20 }}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}