import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════════════
//  ⚙️  在這裡填入你的 Apps Script Web App 網址
// ══════════════════════════════════════════════════════════
const API_URL = "https://script.google.com/macros/s/【貼上你的部署網址】/exec";

// ══════════════════════════════════════════════════════════

const DEPARTMENTS = [
  { id: "jide_la", label: "記得辣", emoji: "🌶️", color: "#ef4444" },
  { id: "central", label: "央廚",   emoji: "🍳", color: "#f97316" },
  { id: "lade_ji", label: "辣得記", emoji: "🏮", color: "#eab308" },
];

const EXP_CATEGORIES = [
  { id: "business", label: "營業支出", emoji: "🏢", color: "#f97316", hasDept: true },
  { id: "invest",   label: "投資",     emoji: "📈", color: "#22c55e" },
  { id: "daily",    label: "日常",     emoji: "🛒", color: "#3b82f6" },
  { id: "pet",      label: "寵物",     emoji: "🐾", color: "#ec4899" },
  { id: "food",     label: "餐飲",     emoji: "🍜", color: "#a855f7" },
  { id: "other",    label: "其他",     emoji: "📦", color: "#64748b" },
];

const INC_CATEGORIES = [
  { id: "salary",    label: "薪資",     emoji: "💼", color: "#22c55e" },
  { id: "bonus",     label: "獎金",     emoji: "🎁", color: "#f59e0b" },
  { id: "reimburse", label: "報帳返還", emoji: "🔄", color: "#06b6d4" },
  { id: "invest_in", label: "投資收益", emoji: "📈", color: "#10b981" },
  { id: "other_in",  label: "其他收入", emoji: "💰", color: "#8b5cf6" },
];

// LocalStorage 作為離線緩存
const CACHE_KEY = "ledger_cache_v2";
function loadCache()  { try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveCache(d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {} }

function fmt(n) { return Number(n).toLocaleString("zh-TW"); }

function getRange(period) {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7)); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    return { start: mon, end: sun };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
}

function getReturnDate(fromDate) {
  const d = new Date(fromDate);
  const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  return new Date(y, (d.getMonth() + 1) % 12, 10);
}

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

// ── 圖表元件 ────────────────────────────────────────────────
function DonutChart({ data, center }) {
  const size = 110, r = 42, cx = 55, cy = 55, circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const seg = { ...d, dash: (d.value / total) * circ, offset };
    offset += seg.dash; return seg;
  });
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={14} />
        {segs.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${seg.dash} ${circ}`} strokeDashoffset={-seg.offset}
            style={{ transition: "all 0.5s ease" }} />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{center}</div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
      {data.map(d => (
        <div key={d.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 8, color: "#6b7280" }}>{d.value > 0 ? fmt(d.value) : ""}</span>
          <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${Math.max((d.value / max) * 52, d.value > 0 ? 4 : 0)}px`, background: d.color, transition: "height 0.5s ease" }} />
          <span style={{ fontSize: 9, color: "#6b7280" }}>{d.emoji}</span>
        </div>
      ))}
    </div>
  );
}

// ── 設定頁 ──────────────────────────────────────────────────
function SetupPage({ onSave }) {
  const [url, setUrl] = useState("");
  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#09101f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Noto Sans TC','PingFang TC',sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, textAlign: "center" }}>首次設定</div>
      <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 28, lineHeight: 1.7 }}>
        請先完成 Google Apps Script 部署，<br/>再將 Web App 網址貼在下方
      </div>
      <div style={{ width: "100%", background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #1e293b", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>APPS SCRIPT WEB APP 網址</div>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
          style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <button onClick={() => url.trim() && onSave(url.trim())} style={{ width: "100%", padding: 18, border: "none", borderRadius: 14, background: url ? "linear-gradient(135deg,#3b82f6,#8b5cf6)" : "#1e293b", color: url ? "#fff" : "#475569", fontSize: 16, fontWeight: 700, cursor: url ? "pointer" : "default" }}>
        儲存並開始使用
      </button>
      <div style={{ marginTop: 24, fontSize: 12, color: "#334155", textAlign: "left", width: "100%", lineHeight: 1.9 }}>
        <div style={{ color: "#64748b", fontWeight: 700, marginBottom: 6 }}>📋 部署步驟</div>
        <div>1. 開啟 Google Sheets，建立新試算表</div>
        <div>2. 點選「擴充功能」→「Apps Script」</div>
        <div>3. 貼上 Code.gs 的內容，儲存</div>
        <div>4. 點「部署」→「新增部署」</div>
        <div>5. 類型選「Web 應用程式」</div>
        <div>6. 執行身分：「我」／存取權：「任何人」</div>
        <div>7. 複製網址貼到上方即可</div>
      </div>
    </div>
  );
}

// ── 主 App ──────────────────────────────────────────────────
export default function App() {
  const [apiUrl, setApiUrl]       = useState(() => localStorage.getItem("ledger_api_url") || "");
  const [records, setRecords]     = useState(() => loadCache());
  const [loading, setLoading]     = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | ok | error
  const [type, setType]           = useState("expense");
  const [amount, setAmount]       = useState("");
  const [catId, setCatId]         = useState("daily");
  const [deptId, setDeptId]       = useState(null);
  const [isAdvance, setIsAdvance] = useState(false);
  const [note, setNote]           = useState("");
  const [view, setView]           = useState("add");
  const [period, setPeriod]       = useState("month");
  const [toast, setToast]         = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [copied, setCopied]       = useState(false);
  const amountRef = useRef();

  const effectiveUrl = apiUrl !== "SETUP" ? apiUrl : "";

  // ── 從 Sheets 載入資料 ──
  const fetchRecords = useCallback(async () => {
    if (!effectiveUrl || effectiveUrl.includes("【")) return;
    setLoading(true);
    try {
      const res = await fetch(effectiveUrl);
      const json = await res.json();
      if (json.success) {
        const sorted = [...json.data].sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecords(sorted);
        saveCache(sorted);
        setSyncStatus("ok");
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
      // 離線時使用緩存
    } finally {
      setLoading(false);
    }
  }, [effectiveUrl]);

  useEffect(() => { if (effectiveUrl) fetchRecords(); }, [fetchRecords]);

  // ── API 呼叫 ──
  async function apiPost(body) {
    const res = await fetch(effectiveUrl, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  }

  const cats = type === "expense" ? EXP_CATEGORIES : INC_CATEGORIES;
  const currentCat = cats.find(c => c.id === catId) || cats[0];
  const range = getRange(period);
  const filtered = records.filter(r => { const d = new Date(r.date); return d >= range.start && d <= range.end; });
  const expenses = filtered.filter(r => r.type === "expense");
  const incomes  = filtered.filter(r => r.type === "income");
  const totalExp = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalInc = incomes.reduce((s, r) => s + Number(r.amount), 0);
  const netFlow  = totalInc - totalExp;
  const advances = records.filter(r => r.isAdvance && r.type === "expense");
  const pendingAdv = advances.filter(r => !r.returned);
  const totalPending = pendingAdv.reduce((s, r) => s + Number(r.amount), 0);
  const expCatTotals = EXP_CATEGORIES.map(c => ({ ...c, value: expenses.filter(r => r.catId === c.id).reduce((s, r) => s + Number(r.amount), 0) }));
  const incCatTotals = INC_CATEGORIES.map(c => ({ ...c, value: incomes.filter(r => r.catId === c.id).reduce((s, r) => s + Number(r.amount), 0) }));

  async function addRecord() {
    const n = parseFloat(amount.replace(/,/g, ""));
    if (!n || n <= 0) { showToast("⚠️ 請輸入有效金額"); return; }
    if (currentCat?.hasDept && isAdvance && !deptId) { showToast("⚠️ 代墊請選擇部門"); return; }
    const now = new Date();
    const rec = {
      id: Date.now(), type, amount: n, catId,
      deptId: currentCat?.hasDept ? deptId : null,
      isAdvance: currentCat?.hasDept ? isAdvance : false,
      returnDate: (currentCat?.hasDept && isAdvance && deptId) ? getReturnDate(now).toISOString() : null,
      returned: false, note: note.trim(), date: now.toISOString(),
    };
    // 樂觀更新 UI
    setRecords(prev => { const next = [rec, ...prev]; saveCache(next); return next; });
    setAmount(""); setNote("");
    showToast("⏳ 儲存中...");
    setSyncing(true);
    try {
      const json = await apiPost({ action: "add", record: rec });
      if (json.success) {
        showToast(type === "expense" ? "✅ 支出已存入 Sheets！" : "✅ 收入已存入 Sheets！");
        setSyncStatus("ok");
      } else { showToast("⚠️ 儲存失敗，已暫存本機"); setSyncStatus("error"); }
    } catch { showToast("📴 離線模式，稍後自動同步"); setSyncStatus("error"); }
    setSyncing(false);
    amountRef.current?.focus();
  }

  async function deleteRecord(id) {
    setRecords(prev => { const next = prev.filter(r => r.id !== id); saveCache(next); return next; });
    try { await apiPost({ action: "delete", id }); setSyncStatus("ok"); }
    catch { setSyncStatus("error"); }
  }

  async function markReturned(id) {
    setRecords(prev => { const next = prev.map(r => r.id === id ? { ...r, returned: true } : r); saveCache(next); return next; });
    showToast("✅ 已標記返還完成！");
    try { await apiPost({ action: "markReturned", id }); setSyncStatus("ok"); }
    catch { setSyncStatus("error"); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function generateAnalysis() {
    const label = period === "week" ? "本週" : "本月";
    const dateStr = `${range.start.toLocaleDateString("zh-TW")} ~ ${range.end.toLocaleDateString("zh-TW")}`;
    const expLines = expCatTotals.filter(c => c.value > 0).map(c => `  ${c.emoji} ${c.label}：NT$ ${fmt(c.value)}（${totalExp ? ((c.value/totalExp)*100).toFixed(1) : 0}%）`).join("\n");
    const incLines = incCatTotals.filter(c => c.value > 0).map(c => `  ${c.emoji} ${c.label}：NT$ ${fmt(c.value)}`).join("\n");
    const advLines = pendingAdv.map(r => { const dept = DEPARTMENTS.find(d => d.id === r.deptId); return `  ${dept?.emoji}${dept?.label} | NT$ ${fmt(r.amount)} | 期限：${new Date(r.returnDate).toLocaleDateString("zh-TW")}${r.note ? " | " + r.note : ""}`; }).join("\n");
    const recLines = filtered.slice(0, 20).map(r => { const cat = [...EXP_CATEGORIES, ...INC_CATEGORIES].find(c => c.id === r.catId); const dept = DEPARTMENTS.find(d => d.id === r.deptId); const d = new Date(r.date); return `  ${d.toLocaleDateString("zh-TW")} | ${r.type === "income" ? "＋收" : "－支"} | ${cat?.emoji}${cat?.label}${dept ? "・" + dept.label : ""}${r.isAdvance ? "【代墊】" : ""} | NT$ ${fmt(r.amount)}${r.note ? " | " + r.note : ""}`; }).join("\n");
    setAnalysisText(`你是我的個人財務顧問，請根據以下${label}帳目，提供深度的財務洞察與具體建議。\n\n═══════════════════════════════\n📊 ${label}財務報表（${dateStr}）\n═══════════════════════════════\n\n【淨流量】NT$ ${netFlow >= 0 ? "+" : ""}${fmt(netFlow)}\n  總收入：NT$ ${fmt(totalInc)}\n  總支出：NT$ ${fmt(totalExp)}\n\n【支出分類】\n${expLines || "  （無資料）"}\n\n【收入分類】\n${incLines || "  （無資料）"}\n\n【待返還代墊款】共 NT$ ${fmt(totalPending)}\n${advLines || "  （無代墊）"}\n\n【明細（最近 20 筆）】\n${recLines || "  （無資料）"}\n\n═══════════════════════════════\n\n請分析：\n1. 💰 收支結構是否健康？有無異常？\n2. 🏢 營業支出代墊的風險管理建議？\n3. ⚠️ 需要注意或控制的支出項目？\n4. 💡 2~3 個可立即執行的優化方向。\n5. 📅 下期財務重點建議。\n\n請用台灣繁體中文，語氣專業但親切。`);
    setShowAnalysis(true);
  }

  function copyAnalysis() { navigator.clipboard.writeText(analysisText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }

  function saveApiUrl(url) { localStorage.setItem("ledger_api_url", url); setApiUrl(url); }

  // 尚未設定 API URL → 顯示設定頁
  if (!apiUrl || apiUrl.includes("【")) return <SetupPage onSave={saveApiUrl} />;

  // 樣式
  const card = { background: "#111827", borderRadius: 16, padding: 18, margin: "12px 14px 0", border: "1px solid #1e293b" };
  const lbl  = { fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "block" };
  const tog  = (active, col) => ({ flex: 1, padding: "9px", border: "none", borderRadius: 8, cursor: "pointer", background: active ? col : "transparent", color: active ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14, transition: "all 0.2s" });

  const syncDot = syncStatus === "ok" ? "#22c55e" : syncStatus === "error" ? "#ef4444" : "#64748b";

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#09101f", fontFamily: "'Noto Sans TC','PingFang TC',sans-serif", color: "#e2e8f0", paddingBottom: 84 }}>

      {/* Header */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>💰 智慧記帳</div>
              {/* 同步狀態指示燈 */}
              <div title={syncStatus === "ok" ? "已同步 Google Sheets" : syncStatus === "error" ? "同步失敗" : "未連線"} style={{ width: 8, height: 8, borderRadius: 4, background: syncDot, marginTop: 2 }} />
              {loading && <span style={{ fontSize: 11, color: "#64748b" }}>載入中...</span>}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
              {new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>本月淨流量</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: netFlow >= 0 ? "#22c55e" : "#ef4444" }}>
              {netFlow >= 0 ? "+" : ""}NT${fmt(netFlow)}
            </div>
          </div>
        </div>

        {/* 代墊提醒 */}
        {pendingAdv.length > 0 && (
          <button onClick={() => setView("advance")} style={{ width: "100%", marginTop: 10, background: "#7c2d12", border: "none", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 12, color: "#fed7aa" }}>📌 待返還代墊 {pendingAdv.length} 筆（點擊查看）</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fb923c" }}>NT${fmt(totalPending)}</span>
          </button>
        )}

        {/* 重新整理按鈕 */}
        <button onClick={fetchRecords} disabled={loading} style={{ marginTop: 8, background: "none", border: "1px solid #1e293b", borderRadius: 8, padding: "5px 12px", color: "#475569", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", animation: loading ? "spin 1s linear infinite" : "none" }}>🔄</span> 同步 Sheets
        </button>
      </div>

      {/* ── 記帳頁 ── */}
      {view === "add" && (
        <>
          <div style={{ ...card, padding: "10px" }}>
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 10, padding: 3 }}>
              <button onClick={() => { setType("expense"); setCatId("daily"); setDeptId(null); setIsAdvance(false); }} style={tog(type === "expense", "#7f1d1d")}>
                <span style={{ color: type === "expense" ? "#fca5a5" : "#475569" }}>－ 支出</span>
              </button>
              <button onClick={() => { setType("income"); setCatId("salary"); setDeptId(null); setIsAdvance(false); }} style={tog(type === "income", "#14532d")}>
                <span style={{ color: type === "income" ? "#86efac" : "#475569" }}>＋ 收入</span>
              </button>
            </div>
          </div>

          <div style={card}>
            <span style={lbl}>金額 (NT$)</span>
            <input ref={amountRef} type="number" inputMode="decimal" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && addRecord()}
              style={{ width: "100%", background: "#0f172a", border: `1px solid ${type === "expense" ? "#7f1d1d" : "#14532d"}`, borderRadius: 12, padding: "14px 16px", color: type === "expense" ? "#fca5a5" : "#86efac", fontSize: 32, fontWeight: 800, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={card}>
            <span style={lbl}>分類</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {cats.map(c => (
                <button key={c.id} onClick={() => { setCatId(c.id); if (!c.hasDept) { setDeptId(null); setIsAdvance(false); } }} style={{ background: catId === c.id ? c.color + "25" : "#0f172a", border: `2px solid ${catId === c.id ? c.color : "#1e293b"}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.15s" }}>
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <span style={{ fontSize: 11, color: catId === c.id ? c.color : "#64748b", fontWeight: 600 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {type === "expense" && currentCat?.hasDept && (
            <div style={card}>
              <span style={lbl}>部門</span>
              <div style={{ display: "flex", gap: 8 }}>
                {DEPARTMENTS.map(d => (
                  <button key={d.id} onClick={() => { setDeptId(deptId === d.id ? null : d.id); if (deptId === d.id) setIsAdvance(false); }} style={{ flex: 1, background: deptId === d.id ? d.color + "25" : "#0f172a", border: `2px solid ${deptId === d.id ? d.color : "#1e293b"}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.15s" }}>
                    <span style={{ fontSize: 20 }}>{d.emoji}</span>
                    <span style={{ fontSize: 11, color: deptId === d.id ? d.color : "#64748b", fontWeight: 600 }}>{d.label}</span>
                  </button>
                ))}
              </div>
              {deptId && (
                <div style={{ marginTop: 12, background: "#0f172a", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 600 }}>🧾 代墊款項</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>次月 10 日前返還</div>
                  </div>
                  <div onClick={() => setIsAdvance(!isAdvance)} style={{ width: 48, height: 26, borderRadius: 13, cursor: "pointer", background: isAdvance ? "#f97316" : "#1e293b", position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 3, left: isAdvance ? 25 : 3, transition: "left 0.2s" }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={card}>
            <span style={lbl}>備註（選填）</span>
            <textarea placeholder="例如：食材採購、廠商款..." value={note} onChange={e => setNote(e.target.value)} rows={2}
              style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none" }}
            />
          </div>

          <button onClick={addRecord} disabled={syncing} style={{ width: "calc(100% - 28px)", margin: "14px 14px 0", border: "none", borderRadius: 14, padding: "18px", background: syncing ? "#1e293b" : type === "expense" ? "linear-gradient(135deg,#dc2626,#9a3412)" : "linear-gradient(135deg,#16a34a,#0e7490)", color: syncing ? "#475569" : "#fff", fontSize: 17, fontWeight: 800, cursor: syncing ? "default" : "pointer" }}>
            {syncing ? "⏳ 儲存中..." : type === "expense" ? "－ 記錄支出" : "＋ 記錄收入"}
          </button>
        </>
      )}

      {/* ── 圖表頁 ── */}
      {view === "chart" && (
        <>
          <div style={{ ...card, padding: "10px" }}>
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 10, padding: 3 }}>
              <button onClick={() => setPeriod("week")} style={tog(period === "week", "#1d4ed8")}>本週</button>
              <button onClick={() => setPeriod("month")} style={tog(period === "month", "#1d4ed8")}>本月</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, margin: "12px 14px 0" }}>
            {[{ label: "收入", val: totalInc, color: "#22c55e", bg: "#052e16" }, { label: "支出", val: totalExp, color: "#ef4444", bg: "#450a0a" }].map(c => (
              <div key={c.label} style={{ flex: 1, background: c.bg, borderRadius: 14, padding: 14, border: `1px solid ${c.color}33` }}>
                <div style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color, marginTop: 4 }}>NT${fmt(c.val)}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <span style={lbl}>支出分布</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <DonutChart data={expCatTotals} center={<><div style={{ fontSize: 9, color: "#64748b" }}>支出</div><div style={{ fontSize: 13, fontWeight: 800, color: "#fca5a5" }}>{fmt(totalExp)}</div></>} />
              <div style={{ flex: 1 }}>
                {expCatTotals.filter(c => c.value > 0).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1" }}>{c.emoji} {c.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{totalExp ? ((c.value/totalExp)*100).toFixed(0) : 0}%</span>
                  </div>
                ))}
                {totalExp === 0 && <span style={{ fontSize: 13, color: "#334155" }}>尚無支出</span>}
              </div>
            </div>
            <BarChart data={expCatTotals} />
          </div>

          <div style={card}>
            <span style={lbl}>收入分布</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <DonutChart data={incCatTotals} center={<><div style={{ fontSize: 9, color: "#64748b" }}>收入</div><div style={{ fontSize: 13, fontWeight: 800, color: "#86efac" }}>{fmt(totalInc)}</div></>} />
              <div style={{ flex: 1 }}>
                {incCatTotals.filter(c => c.value > 0).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1" }}>{c.emoji} {c.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{totalInc ? ((c.value/totalInc)*100).toFixed(0) : 0}%</span>
                  </div>
                ))}
                {totalInc === 0 && <span style={{ fontSize: 13, color: "#334155" }}>尚無收入</span>}
              </div>
            </div>
          </div>

          <button onClick={generateAnalysis} style={{ width: "calc(100% - 28px)", margin: "14px 14px 0", border: "2px solid #3b82f6", borderRadius: 14, padding: "16px", background: "#0f172a", color: "#93c5fd", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span> 生成 Claude 分析文本
          </button>

          {showAnalysis && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", flexDirection: "column", padding: 14, boxSizing: "border-box" }}>
              <div style={{ background: "#111827", borderRadius: 16, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>🤖 Claude 分析 Prompt</span>
                  <button onClick={() => setShowAnalysis(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.7, color: "#94a3b8", fontFamily: "monospace", margin: 0 }}>{analysisText}</pre>
                </div>
                <div style={{ padding: 14, borderTop: "1px solid #1e293b" }}>
                  <button onClick={copyAnalysis} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: copied ? "#16a34a" : "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", transition: "background 0.3s" }}>
                    {copied ? "✅ 已複製！貼給 Claude 吧" : "📋 複製文本"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 明細頁 ── */}
      {view === "list" && (
        <>
          <div style={{ ...card, padding: "10px" }}>
            <div style={{ display: "flex", background: "#0f172a", borderRadius: 10, padding: 3 }}>
              <button onClick={() => setPeriod("week")} style={tog(period === "week", "#1d4ed8")}>本週</button>
              <button onClick={() => setPeriod("month")} style={tog(period === "month", "#1d4ed8")}>本月</button>
            </div>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: "center", color: "#334155", padding: "60px 0", fontSize: 14 }}><div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>此區間尚無記錄</div>}

          {filtered.map(rec => {
            const c = [...EXP_CATEGORIES, ...INC_CATEGORIES].find(x => x.id === rec.catId) || EXP_CATEGORIES[5];
            const dept = DEPARTMENTS.find(d => d.id === rec.deptId);
            const d = new Date(rec.date);
            const isInc = rec.type === "income";
            return (
              <div key={rec.id} style={{ ...card, marginTop: 8, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderLeft: `3px solid ${isInc ? "#22c55e" : "#ef4444"}` }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: c.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.label}</span>
                      {dept && <span style={{ fontSize: 10, background: dept.color + "22", color: dept.color, padding: "1px 5px", borderRadius: 5 }}>{dept.emoji}{dept.label}</span>}
                      {rec.isAdvance && <span style={{ fontSize: 10, background: "#7c2d1222", color: "#fb923c", padding: "1px 5px", borderRadius: 5 }}>代墊</span>}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: isInc ? "#22c55e" : "#f1f5f9", flexShrink: 0 }}>{isInc ? "+" : "-"}{fmt(rec.amount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.note || "—"}</span>
                    <span style={{ fontSize: 10, color: "#334155", flexShrink: 0, marginLeft: 6 }}>{d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })} {d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <button onClick={() => deleteRecord(rec.id)} style={{ background: "none", border: "none", color: "#374151", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>🗑</button>
              </div>
            );
          })}
        </>
      )}

      {/* ── 代墊頁 ── */}
      {view === "advance" && (
        <>
          <div style={{ ...card, background: pendingAdv.length > 0 ? "#1c0a00" : "#052e16", border: `1px solid ${pendingAdv.length > 0 ? "#7c2d12" : "#14532d"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: pendingAdv.length > 0 ? "#fb923c" : "#4ade80", fontWeight: 700 }}>
                  {pendingAdv.length > 0 ? "⏳ 待返還代墊" : "✅ 無待返還代墊"}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: pendingAdv.length > 0 ? "#f97316" : "#22c55e", marginTop: 4 }}>NT${fmt(totalPending)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>筆數</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>{pendingAdv.length}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {DEPARTMENTS.map(dept => {
                const sum = pendingAdv.filter(r => r.deptId === dept.id).reduce((s, r) => s + Number(r.amount), 0);
                return (
                  <div key={dept.id} style={{ flex: 1, background: sum > 0 ? dept.color + "18" : "#0f172a", borderRadius: 10, padding: "10px 6px", border: `1px solid ${sum > 0 ? dept.color + "44" : "#1e293b"}`, textAlign: "center" }}>
                    <div style={{ fontSize: 18 }}>{dept.emoji}</div>
                    <div style={{ fontSize: 10, color: dept.color, fontWeight: 700, marginTop: 3 }}>{dept.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: sum > 0 ? "#f1f5f9" : "#334155", marginTop: 2 }}>{sum > 0 ? fmt(sum) : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {pendingAdv.map(rec => {
            const dept = DEPARTMENTS.find(d => d.id === rec.deptId);
            const days = daysUntil(rec.returnDate);
            const overdue = days < 0;
            return (
              <div key={rec.id} style={{ ...card, marginTop: 10, background: overdue ? "#450a0a" : "#111827", border: `1px solid ${overdue ? "#991b1b" : "#1e293b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{dept?.emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: dept?.color }}>{dept?.label}</span>
                      {overdue
                        ? <span style={{ fontSize: 10, background: "#7f1d1d", color: "#fca5a5", padding: "2px 6px", borderRadius: 6 }}>已逾期 {Math.abs(days)} 天</span>
                        : <span style={{ fontSize: 10, background: "#1e3a2f", color: "#4ade80", padding: "2px 6px", borderRadius: 6 }}>{days === 0 ? "今日到期" : `${days} 天後`}</span>
                      }
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>期限：{new Date(rec.returnDate).toLocaleDateString("zh-TW")}</div>
                    {rec.note && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{rec.note}</div>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: overdue ? "#ef4444" : "#f97316" }}>NT${fmt(rec.amount)}</div>
                </div>
                <button onClick={() => markReturned(rec.id)} style={{ width: "100%", marginTop: 12, padding: "10px", border: "none", borderRadius: 10, background: "#1e3a2f", color: "#4ade80", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  ✅ 標記已返還
                </button>
              </div>
            );
          })}

          {advances.filter(r => r.returned).length > 0 && (
            <div style={{ margin: "16px 14px 0" }}>
              <span style={lbl}>已返還記錄</span>
              {advances.filter(r => r.returned).map(rec => {
                const dept = DEPARTMENTS.find(d => d.id === rec.deptId);
                return (
                  <div key={rec.id} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.55 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{dept?.emoji}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{dept?.label}{rec.note ? ` ・ ${rec.note}` : ""}</span>
                      <span style={{ fontSize: 10, background: "#1e3a2f", color: "#4ade80", padding: "1px 5px", borderRadius: 5 }}>已還</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>NT${fmt(rec.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {advances.length === 0 && <div style={{ textAlign: "center", color: "#334155", padding: "60px 0", fontSize: 14 }}><div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>目前沒有代墊記錄</div>}
        </>
      )}

      {/* 底部導航 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0f172a", borderTop: "1px solid #1e293b", display: "flex", padding: "8px 0 18px" }}>
        {[
          { key: "add",     icon: "➕", label: "記帳" },
          { key: "chart",   icon: "📊", label: "圖表" },
          { key: "list",    icon: "📋", label: "明細" },
          { key: "advance", icon: "🧾", label: "代墊", badge: pendingAdv.length },
        ].map(n => (
          <button key={n.key} onClick={() => setView(n.key)} style={{ flex: 1, background: "none", border: "none", color: view === n.key ? "#3b82f6" : "#475569", fontSize: 10, fontWeight: view === n.key ? 700 : 500, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", position: "relative" }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span>{n.label}</span>
            {n.badge > 0 && <div style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{n.badge}</div>}
          </button>
        ))}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#f1f5f9", padding: "11px 22px", borderRadius: 100, fontSize: 13, fontWeight: 600, border: "1px solid #334155", zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>{toast}</div>}
    </div>
  );
}
