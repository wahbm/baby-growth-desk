"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "./lib/supabase";

type Course = { id: string; title: string; category: string; day: number; time: string; homework: string; done: boolean };
type Task = { id: string; title: string; subject: string; due: string; done: boolean };
type Health = { id: string; illness: string; hospital: string; date: string; plan: string; follow_up: string | null; effect: string };
type DeskData = { courses: Course[]; tasks: Task[]; health: Health[] };
type Login = { token: string; family_id: string; username: string };
type Modal = "task" | "course" | "health" | null;

const storageKey = "tangtang-family-session";
const today = new Date().toISOString().slice(0, 10);
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const emptyData: DeskData = { courses: [], tasks: [], health: [] };

export default function Home() {
  const supabase = getSupabase();
  const [login, setLogin] = useState<Login | null>(null);
  const [data, setData] = useState<DeskData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "study" | "health" | "settings">("home");
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) { setLoading(false); return; }
    try { const next = JSON.parse(saved) as Login; setLogin(next); loadData(next); } catch { localStorage.removeItem(storageKey); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(activeLogin = login) {
    if (!supabase || !activeLogin) return;
    const { data: response, error } = await supabase.rpc("tt_get_data", { p_token: activeLogin.token });
    if (error) { localStorage.removeItem(storageKey); setLogin(null); setNotice("登录已过期，请重新登录。"); setLoading(false); return; }
    setData(response as DeskData); setLoading(false);
  }
  const completeLogin = (next: Login) => { localStorage.setItem(storageKey, JSON.stringify(next)); setLogin(next); setLoading(true); loadData(next); };
  const quit = () => { localStorage.removeItem(storageKey); setLogin(null); setData(emptyData); setTab("home"); };
  const sync = async () => { await loadData(); setNotice("已同步最新记录"); window.setTimeout(() => setNotice(""), 1300); };

  async function save(kind: Exclude<Modal, null>, form: Record<string, string>) {
    if (!supabase || !login) return;
    const args = kind === "task" ? { p_token: login.token, p_title: form.title, p_subject: form.subject || "作业", p_due: form.due }
      : kind === "course" ? { p_token: login.token, p_title: form.title, p_category: form.category, p_day: Number(form.day), p_time: form.time, p_homework: form.homework || "" }
      : { p_token: login.token, p_illness: form.illness, p_hospital: form.hospital || "", p_date: form.date, p_plan: form.plan || "", p_follow_up: form.followUp || null, p_effect: form.effect || "" };
    const fn = kind === "task" ? "tt_add_task" : kind === "course" ? "tt_add_course" : "tt_add_health";
    const { error } = await supabase.rpc(fn, args);
    if (error) return setNotice(error.message);
    setModal(null); await sync();
  }
  async function toggle(kind: "task" | "course", id: string) {
    if (!supabase || !login) return;
    const { error } = await supabase.rpc(kind === "task" ? "tt_toggle_task" : "tt_toggle_course", { p_token: login.token, p_id: id });
    if (error) return setNotice(error.message); await sync();
  }
  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `糖糖工作台备份-${today}.json`; a.click(); URL.revokeObjectURL(a.href); };

  if (!supabase) return <main className="auth-shell"><section className="auth-card"><h1>正在配置家庭云端</h1><p className="auth-copy">请完成云端设置后再打开应用。</p></section></main>;
  if (loading) return <main className="auth-shell"><p>正在打开糖糖工作台…</p></main>;
  if (!login) return <AccountScreen onLogin={completeLogin} />;

  const dayCourses = useMemo(() => data.courses.filter((c) => c.day === new Date().getDay()), [data]);
  const openTasks = data.tasks.filter((t) => !t.done);
  return <main className="app-shell">
    <header className="topbar"><div className="avatar">糖</div><div><p className="eyebrow">文博文 · 一年级暑假 <span className="sync-status">● 已连接云端</span></p><h1>糖糖的小小工作台</h1></div><button className="round-btn" aria-label="进入设置" onClick={() => setTab("settings")}>···</button></header>
    {notice && <div className="toast">{notice}</div>}
    {tab === "home" && <><section className="hero-card"><span className="sun">☀</span><div><p>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p><h2>今天也一起慢慢长大</h2><small>学习有收获，身体有活力</small></div></section><section className="summary-grid"><button onClick={() => setTab("study")}><b>{openTasks.length}</b><span>待完成作业</span></button><button onClick={() => setTab("study")}><b>{dayCourses.length}</b><span>今日日程</span></button><button onClick={() => setTab("health")}><b>{data.health.length}</b><span>健康记录</span></button></section><section className="section"><div className="section-head"><h2>今日安排</h2><button className="text-btn" onClick={() => setTab("study")}>查看全部</button></div>{dayCourses.length ? dayCourses.map((c) => <div className="agenda" key={c.id}><time>{c.time}</time><i className={`dot ${c.category}`}></i><div><b>{c.title}</b><small>{c.category} · {c.homework || "暂无作业"}</small></div></div>) : <Empty icon="🍉" text="今天没有安排，享受轻松时光吧！" />}</section><section className="section"><div className="section-head"><h2>待完成作业</h2><button className="text-btn" onClick={() => setModal("task")}>+ 新增</button></div>{openTasks.slice(0, 3).map((t) => <TaskRow key={t.id} task={t} onClick={() => toggle("task", t.id)} />)}{!openTasks.length && <Empty icon="🌟" text="全部完成，真棒！" />}</section></>}
    {tab === "study" && <Study data={data} addCourse={() => setModal("course")} addTask={() => setModal("task")} toggle={toggle} />}
    {tab === "health" && <Health records={data.health} add={() => setModal("health")} />}
    {tab === "settings" && <Settings username={login.username} sync={sync} exportData={exportData} quit={quit} />}
    <nav className="bottom-nav"><Nav active={tab === "home"} icon="⌂" label="首页" click={() => setTab("home")} /><Nav active={tab === "study"} icon="✎" label="学习" click={() => setTab("study")} /><Nav active={tab === "health"} icon="♡" label="健康" click={() => setTab("health")} /><Nav active={tab === "settings"} icon="▣" label="设置" click={() => setTab("settings")} /></nav>
    {modal && <AddModal type={modal} close={() => setModal(null)} save={(form) => save(modal, form)} />}
  </main>;
}

function AccountScreen({ onLogin }: { onLogin: (value: Login) => void }) {
  const supabase = getSupabase()!; const [mode, setMode] = useState<"login" | "create">("login"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [family, setFamily] = useState("糖糖家"); const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setNotice(""); const { data, error } = await supabase.rpc(mode === "login" ? "tt_login" : "tt_create_account", mode === "login" ? { p_username: username, p_password: password } : { p_username: username, p_password: password, p_family_name: family }); if (error) setNotice(error.message); else onLogin(data as Login); };
  return <main className="auth-shell"><section className="auth-card"><div className="auth-mark">糖</div><p className="eyebrow">爸爸妈妈共享的家庭记录本</p><h1>糖糖的小小工作台</h1><p className="auth-copy">在每台手机上输入同一个账号名和密码，学习与健康记录会自动同步。</p><form onSubmit={submit}><label>家庭账号名<input required minLength={4} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="例如：tangtang-family" autoCapitalize="none" /></label><label>密码<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" /></label>{mode === "create" && <label>家庭名称<input value={family} onChange={(e) => setFamily(e.target.value)} /></label>}{notice && <p className="form-note">{notice}</p>}<button className="save-btn" type="submit">{mode === "login" ? "登录工作台" : "创建家庭账号"}</button></form><button className="switch-btn" onClick={() => { setMode(mode === "login" ? "create" : "login"); setNotice(""); }}>{mode === "login" ? "第一次使用？创建一个家庭账号" : "已有账号？返回登录"}</button></section></main>;
}

function Empty({ icon, text }: { icon: string; text: string }) { return <div className="empty"><span>{icon}</span>{text}</div>; }
function Nav({ active, icon, label, click }: { active: boolean; icon: string; label: string; click: () => void }) { return <button className={active ? "active" : ""} onClick={click}><b>{icon}</b><span>{label}</span></button>; }
function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) { return <button className={`task-row ${task.done ? "done" : ""}`} onClick={onClick}><span className="check">{task.done ? "✓" : ""}</span><span><b>{task.title}</b><small>{task.subject} · {task.due === today ? "今天" : task.due}</small></span></button>; }
function Study({ data, addCourse, addTask, toggle }: { data: DeskData; addCourse: () => void; addTask: () => void; toggle: (kind: "task" | "course", id: string) => void }) { const [week, setWeek] = useState(new Date().getDay()); const courses = data.courses.filter((c) => c.day === week); return <div className="page"><div className="page-title"><div><p className="eyebrow">快乐学习，自主完成</p><h2>学习计划</h2></div><button className="add-btn" onClick={addCourse}>+ 课程</button></div><div className="weekbar">{weekdays.map((day, i) => <button key={day} className={week === i ? "selected" : ""} onClick={() => setWeek(i)}>{day}</button>)}</div><section className="section"><div className="section-head"><h2>{weekdays[week]}课程</h2></div>{courses.length ? courses.map((c) => <button className={`course-card ${c.done ? "done" : ""}`} onClick={() => toggle("course", c.id)} key={c.id}><time>{c.time}</time><div><span className={`tag ${c.category}`}>{c.category}</span><b>{c.title}</b><small>{c.homework ? `作业：${c.homework}` : "暂无作业"}</small></div><span className="check">{c.done ? "✓" : ""}</span></button>) : <Empty icon="📚" text="这天还没有课程，点右上角添加吧。" />}</section><section className="section"><div className="section-head"><h2>作业清单</h2><button className="text-btn" onClick={addTask}>+ 新增</button></div>{data.tasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => toggle("task", t.id)} />)}{!data.tasks.length && <Empty icon="✏️" text="还没有作业记录。" />}</section></div>; }
function Health({ records, add }: { records: Health[]; add: () => void }) { return <div className="page"><div className="page-title"><div><p className="eyebrow">认真记录，安心陪伴</p><h2>健康档案</h2></div><button className="add-btn" onClick={add}>+ 记录</button></div><section className="health-tip"><span>💚</span><div><b>日常健康小提示</b><small>保证充足睡眠、均衡饮食和每日户外活动。</small></div></section><section className="section"><div className="section-head"><h2>就诊与健康记录</h2><span className="count">{records.length} 条</span></div>{records.length ? records.map((r) => <article className="health-card" key={r.id}><div><time>{r.date}</time><span>{r.illness}</span></div><b>{r.hospital || "日常健康记录"}</b><p><strong>治疗方案：</strong>{r.plan || "未填写"}</p>{r.follow_up && <p><strong>复诊时间：</strong>{r.follow_up}</p>}{r.effect && <p><strong>治疗效果：</strong>{r.effect}</p>}</article>) : <Empty icon="🌿" text="暂时没有健康记录，希望一直健健康康！" />}</section></div>; }
function Settings({ username, sync, exportData, quit }: { username: string; sync: () => void; exportData: () => void; quit: () => void }) { return <div className="page"><div className="page-title"><div><p className="eyebrow">同一账号，多台手机同步</p><h2>家庭与备份</h2></div></div><section className="privacy"><span>🔒</span><div><b>家庭账号已保护</b><p>当前账号：{username}。请只与糖糖的爸爸妈妈共享账号和密码。</p></div></section><section className="settings"><button onClick={sync}><span>↻</span><div><b>立即同步</b><small>刷新云端的最新记录</small></div><em>›</em></button><button onClick={exportData}><span>⇩</span><div><b>导出备份</b><small>保存全部学习与健康记录</small></div><em>›</em></button><button className="danger" onClick={quit}><span>↪</span><div><b>退出家庭账号</b><small>不会删除云端记录</small></div><em>›</em></button></section></div>; }
function AddModal({ type, close, save }: { type: Exclude<Modal, null>; close: () => void; save: (form: Record<string, string>) => void }) { const [form, setForm] = useState<Record<string, string>>({ date: today, due: today, category: "学校", day: String(new Date().getDay()), time: "09:00" }); const field = (name: string, label: string, placeholder = "", kind = "text") => <label>{label}<input type={kind} placeholder={placeholder} value={form[name] || ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></label>; return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.title && !form.illness) return alert("请先填写名称或健康情况。"); save(form); }}><div className="modal-head"><h2>{type === "task" ? "新增作业" : type === "course" ? "新增课程" : "新增健康记录"}</h2><button type="button" onClick={close}>×</button></div>{type === "task" && <>{field("title", "作业内容", "例如：口算练习 20 题")}{field("subject", "科目", "例如：数学")}{field("due", "完成日期", "", "date")}</>}{type === "course" && <>{field("title", "课程名称", "例如：英语绘本")}<label>课程类型<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>学校</option><option>课外辅导</option><option>兴趣班</option></select></label><label>星期<select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{weekdays.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>{field("time", "上课时间", "", "time")}{field("homework", "课后作业", "可不填写")}</>}{type === "health" && <>{field("illness", "疾病 / 健康情况", "例如：感冒、常规体检")}{field("hospital", "就诊医院", "可不填写")}{field("date", "就诊时间", "", "date")}{field("plan", "治疗方案", "例如：遵医嘱用药、居家休息")}{field("followUp", "复诊时间", "可不填写", "date")}{field("effect", "治疗效果", "可不填写")}</>}<button className="save-btn" type="submit">保存并同步</button></form></div>; }
