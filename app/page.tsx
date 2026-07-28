"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "./lib/supabase";

type Images = string[];
type Course = { id: string; title: string; category: string; day: number; time: string; homework: string; done: boolean; images?: Images; audios?: string[]; reminder_at?: string | null };
type Task = { id: string; title: string; subject: string; due: string; done: boolean; images?: Images; audios?: string[]; reminder_at?: string | null };
type Health = { id: string; illness: string; hospital: string; date: string; plan: string; follow_up: string | null; effect: string; images?: Images; audios?: string[] };
type DeskData = { courses: Course[]; tasks: Task[]; health: Health[] };
type Login = { token: string; family_id: string; username: string };
type Modal = "task" | "course" | "health" | null;
type Editable = { type: Exclude<Modal, null>; record: Task | Course | Health };

const storageKey = "tangtang-family-session";
const today = new Date().toISOString().slice(0, 10);
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const emptyData: DeskData = { courses: [], tasks: [], health: [] };

function imagesOf(record: { images?: Images }) { return Array.isArray(record.images) ? record.images : []; }
function audiosOf(record: { audios?: string[] }) { return Array.isArray(record.audios) ? record.audios : []; }
function reminderText(value?: string | null) { return value ? new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; }
function notify(title: string, body: string, setNotice: (text: string) => void) {
  setNotice(`⏰ ${title}：${body}`);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.svg" });
  navigator.vibrate?.([180, 100, 180]);
}

export default function Home() {
  const supabase = getSupabase();
  const [login, setLogin] = useState<Login | null>(null);
  const [data, setData] = useState<DeskData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "study" | "health" | "settings">("home");
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Editable | null>(null);
  const [notice, setNotice] = useState("");
  const dayCourses = useMemo(() => data.courses.filter((c) => c.day === new Date().getDay()), [data]);
  const openTasks = useMemo(() => data.tasks.filter((t) => !t.done), [data]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) { setLoading(false); return; }
    try { const next = JSON.parse(saved) as Login; setLogin(next); loadData(next); } catch { localStorage.removeItem(storageKey); setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!login) return;
    const reminders = [
      ...data.tasks.filter((task) => !task.done && task.reminder_at).map((task) => ({ title: "作业提醒", body: task.title, at: task.reminder_at! })),
      ...data.courses.filter((course) => !course.done && course.reminder_at).map((course) => ({ title: "课程提醒", body: course.title, at: course.reminder_at! })),
    ].filter((item) => new Date(item.at).getTime() > Date.now()).sort((a, b) => +new Date(a.at) - +new Date(b.at)).slice(0, 20);
    const timers = reminders.map((item) => window.setTimeout(() => notify(item.title, item.body, setNotice), Math.min(new Date(item.at).getTime() - Date.now(), 2_147_000_000)));
    return () => timers.forEach(window.clearTimeout);
  }, [data, login]);

  async function loadData(activeLogin = login) {
    if (!supabase || !activeLogin) return;
    const { data: response, error } = await supabase.rpc("tt_get_data", { p_token: activeLogin.token });
    if (error) { localStorage.removeItem(storageKey); setLogin(null); setNotice("登录已过期，请重新登录。"); setLoading(false); return; }
    setData(response as DeskData); setLoading(false);
  }
  const completeLogin = (next: Login) => { localStorage.setItem(storageKey, JSON.stringify(next)); setLogin(next); setLoading(true); loadData(next); };
  const quit = () => { localStorage.removeItem(storageKey); setLogin(null); setData(emptyData); setTab("home"); };
  const sync = async () => { await loadData(); setNotice("已同步最新记录"); window.setTimeout(() => setNotice(""), 1300); };

  async function save(kind: Exclude<Modal, null>, form: Record<string, string>, images: Images, audios: string[]) {
    if (!supabase || !login) return;
    const reminder = form.reminderAt ? new Date(form.reminderAt).toISOString() : null;
    const id = editing?.type === kind ? editing.record.id : undefined;
    const args = kind === "task"
      ? { p_token: login.token, ...(id ? { p_id: id } : {}), p_title: form.title, p_subject: form.subject || "作业", p_due: form.due, p_images: images, p_reminder_at: reminder, p_audios: audios }
      : kind === "course"
        ? { p_token: login.token, ...(id ? { p_id: id } : {}), p_title: form.title, p_category: form.category, p_day: Number(form.day), p_time: form.time, p_homework: form.homework || "", p_images: images, p_reminder_at: reminder, p_audios: audios }
        : { p_token: login.token, ...(id ? { p_id: id } : {}), p_illness: form.illness, p_hospital: form.hospital || "", p_date: form.date, p_plan: form.plan || "", p_follow_up: form.followUp || null, p_effect: form.effect || "", p_images: images, p_audios: audios };
    const fn = id ? (kind === "task" ? "tt_update_task" : kind === "course" ? "tt_update_course" : "tt_update_health") : (kind === "task" ? "tt_add_task" : kind === "course" ? "tt_add_course" : "tt_add_health");
    const { error } = await supabase.rpc(fn, args);
    if (error) return setNotice(error.message);
    setModal(null); setEditing(null); await sync();
  }
  const edit = (type: Exclude<Modal, null>, record: Task | Course | Health) => { setEditing({ type, record }); setModal(type); };
  async function remove(type: Exclude<Modal, null>, id: string) { if (!supabase || !login || !window.confirm("确定删除这条记录吗？删除后无法恢复。")) return; const { error } = await supabase.rpc("tt_delete_record", { p_token: login.token, p_kind: type, p_id: id }); if (error) setNotice(error.message); else { setNotice("已删除记录"); await sync(); } }
  async function toggle(kind: "task" | "course", id: string) {
    if (!supabase || !login) return;
    const { error } = await supabase.rpc(kind === "task" ? "tt_toggle_task" : "tt_toggle_course", { p_token: login.token, p_id: id });
    if (error) return setNotice(error.message); await sync();
  }
  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `糖糖工作台备份-${today}.json`; a.click(); URL.revokeObjectURL(a.href); };

  if (!supabase) return <main className="auth-shell"><section className="auth-card"><h1>正在配置家庭云端</h1><p className="auth-copy">请完成云端设置后再打开应用。</p></section></main>;
  if (loading) return <main className="auth-shell"><p>正在打开糖糖工作台…</p></main>;
  if (!login) return <AccountScreen onLogin={completeLogin} />;

  return <main className="app-shell">
    <header className="topbar"><div className="avatar">糖</div><div><p className="eyebrow">文博文 · 一年级暑假 <span className="sync-status">● 已连接云端</span></p><h1>糖糖的小小工作台</h1></div><button className="round-btn" aria-label="进入设置" onClick={() => setTab("settings")}>···</button></header>
    {notice && <div className="toast">{notice}</div>}
    {tab === "home" && <><section className="hero-card"><span className="sun">☀️</span><div><p>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p><h2>今天也一起慢慢长大</h2><small>学习有收获，身体有活力</small></div></section><section className="summary-grid"><button onClick={() => setTab("study")}><b>{openTasks.length}</b><span>待完成作业</span></button><button onClick={() => setTab("study")}><b>{dayCourses.length}</b><span>今日日程</span></button><button onClick={() => setTab("health")}><b>{data.health.length}</b><span>健康记录</span></button></section><section className="section"><div className="section-head"><h2>今日安排</h2><button className="text-btn" onClick={() => setTab("study")}>查看全部</button></div>{dayCourses.length ? dayCourses.map((c) => <div className="agenda" key={c.id}><time>{c.time}</time><i className={`dot ${c.category}`}></i><div><b>{c.title}</b><small>{c.category} · {c.homework || "暂无作业"}</small><RecordExtras images={imagesOf(c)} audios={audiosOf(c)} reminder={c.reminder_at} /></div></div>) : <Empty icon="🌿" text="今天没有安排，享受轻松时光吧！" />}</section><section className="section"><div className="section-head"><h2>待完成作业</h2><button className="text-btn" onClick={() => { setEditing(null); setModal("task"); }}>+ 新增</button></div>{openTasks.slice(0, 3).map((t) => <TaskRow key={t.id} task={t} onClick={() => toggle("task", t.id)} onEdit={() => edit("task", t)} onDelete={() => remove("task", t.id)} />)}{!openTasks.length && <Empty icon="🎉" text="全部完成，真棒！" />}</section></>}
    {tab === "study" && <Study data={data} addCourse={() => { setEditing(null); setModal("course"); }} addTask={() => { setEditing(null); setModal("task"); }} toggle={toggle} edit={edit} remove={remove} />}
    {tab === "health" && <Health records={data.health} add={() => { setEditing(null); setModal("health"); }} edit={edit} remove={remove} />}
    {tab === "settings" && <Settings username={login.username} sync={sync} exportData={exportData} quit={quit} setNotice={setNotice} />}
    <nav className="bottom-nav"><Nav active={tab === "home"} icon="⌂" label="首页" click={() => setTab("home")} /><Nav active={tab === "study"} icon="✎" label="学习" click={() => setTab("study")} /><Nav active={tab === "health"} icon="♡" label="健康" click={() => setTab("health")} /><Nav active={tab === "settings"} icon="⚙" label="设置" click={() => setTab("settings")} /></nav>
    {modal && <AddModal type={modal} initial={editing?.type === modal ? editing.record : undefined} close={() => { setModal(null); setEditing(null); }} save={(form, images, audios) => save(modal, form, images, audios)} />}
  </main>;
}

function AccountScreen({ onLogin }: { onLogin: (value: Login) => void }) {
  const supabase = getSupabase()!; const [mode, setMode] = useState<"login" | "create">("login"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [family, setFamily] = useState("糖糖家"); const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setNotice(""); const { data, error } = await supabase.rpc(mode === "login" ? "tt_login" : "tt_create_account", mode === "login" ? { p_username: username, p_password: password } : { p_username: username, p_password: password, p_family_name: family }); if (error) setNotice(error.message); else onLogin(data as Login); };
  return <main className="auth-shell"><section className="auth-card"><div className="auth-mark">糖</div><p className="eyebrow">爸爸妈妈共享的家庭记录本</p><h1>糖糖的小小工作台</h1><p className="auth-copy">在每台手机上输入同一个账号名和密码，学习与健康记录会自动同步。</p><form onSubmit={submit}><label>家庭账号名<input required minLength={4} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="例如：tangtang-family" autoCapitalize="none" /></label><label>密码<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" /></label>{mode === "create" && <label>家庭名称<input value={family} onChange={(e) => setFamily(e.target.value)} /></label>}{notice && <p className="form-note">{notice}</p>}<button className="save-btn" type="submit">{mode === "login" ? "登录工作台" : "创建家庭账号"}</button></form><button className="switch-btn" onClick={() => { setMode(mode === "login" ? "create" : "login"); setNotice(""); }}>{mode === "login" ? "第一次使用？创建一个家庭账号" : "已有账号？返回登录"}</button></section></main>;
}

function Empty({ icon, text }: { icon: string; text: string }) { return <div className="empty"><span>{icon}</span>{text}</div>; }
function Nav({ active, icon, label, click }: { active: boolean; icon: string; label: string; click: () => void }) { return <button className={active ? "active" : ""} onClick={click}><b>{icon}</b><span>{label}</span></button>; }
function RecordExtras({ images, audios, reminder }: { images: Images; audios?: string[]; reminder?: string | null }) { return <div className="record-extras">{images.length > 0 && <span className="photo-count">📷 {images.length} 张照片</span>}{audiosOf({ audios }).length > 0 && <span className="audio-count">🎙️ 语音</span>}{reminder && <span className="reminder-pill">⏰ {reminderText(reminder)}</span>}</div>; }
function ImageStrip({ images }: { images: Images }) { return images.length ? <div className="image-strip">{images.map((src, index) => <img key={`${src.slice(-16)}-${index}`} src={src} alt={`记录图片 ${index + 1}`} />)}</div> : null; }
function AudioStrip({ audios }: { audios: string[] }) { return audios.length ? <div className="audio-strip">{audios.map((src, index) => <audio key={`${src.slice(-16)}-${index}`} controls src={src}>你的浏览器不支持播放录音。</audio>)}</div> : null; }
function TaskRow({ task, onClick, onEdit, onDelete }: { task: Task; onClick: () => void; onEdit: () => void; onDelete: () => void }) { return <div className={`task-row ${task.done ? "done" : ""}`}><button className="task-main" onClick={onClick}><span className="check">{task.done ? "✓" : ""}</span><span><b>{task.title}</b><small>{task.subject} · {task.due === today ? "今天" : task.due}</small><RecordExtras images={imagesOf(task)} audios={audiosOf(task)} reminder={task.reminder_at} /></span></button><button className="icon-action" aria-label="修改作业" onClick={onEdit}>✎</button><button className="icon-action delete" aria-label="删除作业" onClick={onDelete}>×</button></div>; }
function SearchBar({ keyword, setKeyword, from, setFrom, to, setTo }: { keyword: string; setKeyword: (value: string) => void; from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void }) { return <div className="search-bar"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索名称、科目、医院、治疗方案…" /><div><input aria-label="开始日期" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>至</span><input aria-label="结束日期" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>; }
function Study({ data, addCourse, addTask, toggle, edit, remove }: { data: DeskData; addCourse: () => void; addTask: () => void; toggle: (kind: "task" | "course", id: string) => void; edit: (type: Exclude<Modal, null>, record: Task | Course | Health) => void; remove: (type: Exclude<Modal, null>, id: string) => void }) { const [week, setWeek] = useState(new Date().getDay()); const [keyword, setKeyword] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const includes = (text: string) => text.toLowerCase().includes(keyword.trim().toLowerCase()); const courses = data.courses.filter((c) => c.day === week && includes(`${c.title} ${c.category} ${c.homework}`)); const tasks = data.tasks.filter((t) => includes(`${t.title} ${t.subject}`) && (!from || t.due >= from) && (!to || t.due <= to)); return <div className="page"><div className="page-title"><div><p className="eyebrow">快乐学习，自主完成</p><h2>学习计划</h2></div><button className="add-btn" onClick={addCourse}>+ 课程</button></div><SearchBar keyword={keyword} setKeyword={setKeyword} from={from} setFrom={setFrom} to={to} setTo={setTo} /><div className="weekbar">{weekdays.map((day, i) => <button key={day} className={week === i ? "selected" : ""} onClick={() => setWeek(i)}>{day}</button>)}</div><section className="section"><div className="section-head"><h2>{weekdays[week]}课程</h2></div>{courses.length ? courses.map((c) => <div className={`course-card ${c.done ? "done" : ""}`} key={c.id}><button className="course-main" onClick={() => toggle("course", c.id)}><time>{c.time}</time><div><span className={`tag ${c.category}`}>{c.category}</span><b>{c.title}</b><small>{c.homework ? `作业：${c.homework}` : "暂无作业"}</small><RecordExtras images={imagesOf(c)} audios={audiosOf(c)} reminder={c.reminder_at} /></div><span className="check">{c.done ? "✓" : ""}</span></button><button className="icon-action" aria-label="修改课程" onClick={() => edit("course", c)}>✎</button><button className="icon-action delete" aria-label="删除课程" onClick={() => remove("course", c.id)}>×</button></div>) : <Empty icon="📎" text="没有符合条件的课程。" />}</section><section className="section"><div className="section-head"><h2>作业清单</h2><button className="text-btn" onClick={addTask}>+ 新增</button></div>{tasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => toggle("task", t.id)} onEdit={() => edit("task", t)} onDelete={() => remove("task", t.id)} />)}{!tasks.length && <Empty icon="✅" text="没有符合条件的作业记录。" />}</section></div>; }
function Health({ records, add, edit, remove }: { records: Health[]; add: () => void; edit: (type: Exclude<Modal, null>, record: Task | Course | Health) => void; remove: (type: Exclude<Modal, null>, id: string) => void }) { const [keyword, setKeyword] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const visible = records.filter((r) => `${r.illness} ${r.hospital} ${r.plan} ${r.effect}`.toLowerCase().includes(keyword.trim().toLowerCase()) && (!from || r.date >= from) && (!to || r.date <= to)); return <div className="page"><div className="page-title"><div><p className="eyebrow">认真记录，安心陪伴</p><h2>健康档案</h2></div><button className="add-btn" onClick={add}>+ 记录</button></div><section className="health-tip"><span>🩺</span><div><b>日常健康小提示</b><small>保证充足睡眠、均衡饮食和每日户外活动。</small></div></section><SearchBar keyword={keyword} setKeyword={setKeyword} from={from} setFrom={setFrom} to={to} setTo={setTo} /><section className="section"><div className="section-head"><h2>就诊与健康记录</h2><span className="count">{visible.length} 条</span></div>{visible.length ? visible.map((r) => <article className="health-card" key={r.id}><div><time>{r.date}</time><span>{r.illness}</span></div><b>{r.hospital || "日常健康记录"}</b><p><strong>治疗方案：</strong>{r.plan || "未填写"}</p>{r.follow_up && <p><strong>复诊时间：</strong>{r.follow_up}</p>}{r.effect && <p><strong>治疗效果：</strong>{r.effect}</p>}<ImageStrip images={imagesOf(r)} /><AudioStrip audios={audiosOf(r)} /><div className="card-actions"><button onClick={() => edit("health", r)}>修改</button><button className="delete" onClick={() => remove("health", r.id)}>删除</button></div></article>) : <Empty icon="🐼" text="没有符合条件的健康记录。" />}</section></div>; }
function Settings({ username, sync, exportData, quit, setNotice }: { username: string; sync: () => void; exportData: () => void; quit: () => void; setNotice: (text: string) => void }) {
  const askNotification = async () => { if (typeof Notification === "undefined") return setNotice("这台设备暂不支持浏览器通知。"); const result = await Notification.requestPermission(); setNotice(result === "granted" ? "提醒通知已开启。" : "未开启通知；请在手机浏览器设置中允许通知。"); };
  return <div className="page"><div className="page-title"><div><p className="eyebrow">同一账号，多台手机同步</p><h2>家庭与备份</h2></div></div><section className="privacy"><span>🔒</span><div><b>家庭账号已保护</b><p>当前账号：{username}。请只与糖糖的爸爸妈妈共享账号和密码。</p></div></section><section className="reminder-note"><b>⏰ 关于提醒</b><p>先点“开启提醒通知”。手机浏览器打开工作台时会在设定时间提醒；若网页被完全关闭，iPhone 不能保证像系统闹钟一样响铃。</p></section><section className="settings"><button onClick={askNotification}><span>⏰</span><div><b>开启提醒通知</b><small>允许浏览器显示课程和作业提醒</small></div><em>›</em></button><button onClick={sync}><span>↻</span><div><b>立即同步</b><small>刷新云端的最新记录</small></div><em>›</em></button><button onClick={exportData}><span>⇩</span><div><b>导出备份</b><small>保存全部学习与健康记录</small></div><em>›</em></button><button className="danger" onClick={quit}><span>↪</span><div><b>退出家庭账号</b><small>不会删除云端记录</small></div><em>›</em></button></section></div>;
}
async function compressImage(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("照片读取失败")); reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error("照片格式不支持")); image.onload = () => { const max = 1280; const scale = Math.min(1, max / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.78)); }; image.src = reader.result as string; }; reader.readAsDataURL(file); }); }
function toDatetimeLocal(value?: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function formFor(type: Exclude<Modal, null>, initial?: Task | Course | Health): Record<string, string> { if (!initial) return { date: today, due: today, category: "学校", day: String(new Date().getDay()), time: "09:00" }; if (type === "task") { const item = initial as Task; return { title: item.title, subject: item.subject, due: item.due, reminderAt: toDatetimeLocal(item.reminder_at) }; } if (type === "course") { const item = initial as Course; return { title: item.title, category: item.category, day: String(item.day), time: item.time, homework: item.homework, reminderAt: toDatetimeLocal(item.reminder_at) }; } const item = initial as Health; return { illness: item.illness, hospital: item.hospital, date: item.date, plan: item.plan, followUp: item.follow_up || "", effect: item.effect }; }
function AddModal({ type, initial, close, save }: { type: Exclude<Modal, null>; initial?: Task | Course | Health; close: () => void; save: (form: Record<string, string>, images: Images, audios: string[]) => void }) {
  const [form, setForm] = useState<Record<string, string>>(() => formFor(type, initial)); const [images, setImages] = useState<Images>(() => initial ? imagesOf(initial) : []); const [audios, setAudios] = useState<string[]>(() => initial ? audiosOf(initial) : []); const [photoNotice, setPhotoNotice] = useState("");
  const field = (name: string, label: string, placeholder = "", kind = "text") => <label>{label}<input type={kind} placeholder={placeholder} value={form[name] || ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></label>;
  const pick = async (files: FileList | null) => { if (!files) return; const chosen = Array.from(files).slice(0, 3 - images.length); if (!chosen.length) return setPhotoNotice("每条记录最多保存 3 张照片。"); try { const converted = await Promise.all(chosen.map(compressImage)); setImages((old) => [...old, ...converted]); setPhotoNotice(""); } catch (error) { setPhotoNotice(error instanceof Error ? error.message : "照片添加失败"); } };
  const voiceField = type === "task" ? "title" : type === "course" ? "homework" : "plan";
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.title && !form.illness) return alert("请先填写名称或健康情况。"); save(form, images, audios); }}><div className="modal-head"><h2>{initial ? "修改记录" : type === "task" ? "新增作业" : type === "course" ? "新增课程" : "新增健康记录"}</h2><button type="button" onClick={close}>×</button></div>{type === "task" && <>{field("title", "作业内容", "例如：口算练习 20 题")}{field("subject", "科目", "例如：数学")}{field("due", "完成日期", "", "date")}{field("reminderAt", "提醒时间（可不填）", "", "datetime-local")}</>}{type === "course" && <>{field("title", "课程名称", "例如：英语绘本")}<label>课程类型<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>学校</option><option>课外辅导</option><option>兴趣班</option></select></label><label>星期<select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{weekdays.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>{field("time", "上课时间", "", "time")}{field("homework", "课后作业", "可不填写")}{field("reminderAt", "提醒时间（可不填）", "", "datetime-local")}</>}{type === "health" && <>{field("illness", "疾病 / 健康情况", "例如：感冒、常规体检")}{field("hospital", "就诊医院", "可不填写")}{field("date", "就诊时间", "", "date")}{field("plan", "治疗方案", "例如：遵医嘱用药、居家休息")}{field("followUp", "复诊时间", "可不填写", "date")}{field("effect", "治疗效果", "可不填写")}</>}<VoiceTools onText={(text) => setForm((old) => ({ ...old, [voiceField]: [old[voiceField], text].filter(Boolean).join(" ") }))} audio={audios[0] || ""} onAudio={(audio) => setAudios(audio ? [audio] : [])} /><section className="image-picker"><div><b>📷 添加照片</b><small>可上传作业、课表、处方或就诊单；每条最多 3 张，会自动压缩。</small></div><label className="photo-button">选择照片<input hidden type="file" accept="image/*" multiple onChange={(e) => pick(e.target.files)} /></label>{photoNotice && <p>{photoNotice}</p>}<div className="photo-preview">{images.map((src, index) => <div key={`${src.slice(-16)}-${index}`}><img src={src} alt={`已添加照片 ${index + 1}`} /><button type="button" aria-label="删除照片" onClick={() => setImages(images.filter((_, i) => i !== index))}>×</button></div>)}</div></section><button className="save-btn" type="submit">保存并同步</button></form></div>;
}

function VoiceTools({ onText, audio, onAudio }: { onText: (text: string) => void; audio: string; onAudio: (audio: string) => void }) {
  const [listening, setListening] = useState(false); const [recording, setRecording] = useState(false); const [notice, setNotice] = useState(""); const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null);
  const transcribe = () => { const VoiceRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!VoiceRecognition) return setNotice("此浏览器暂不支持语音转文字，可先用录音功能。"); const recognition = new VoiceRecognition(); recognition.lang = "zh-CN"; recognition.continuous = false; recognition.interimResults = false; recognition.onstart = () => { setListening(true); setNotice("正在听，请说话…"); }; recognition.onerror = () => { setListening(false); setNotice("语音识别未完成，请检查麦克风权限或网络。"); }; recognition.onend = () => setListening(false); recognition.onresult = (event: any) => { const text = Array.from(event.results).map((item: any) => item[0].transcript).join("").trim(); if (text) { onText(text); setNotice("已转成文字并填入表单。"); } }; recognition.start(); };
  const record = async () => { if (recorder.current && recording) { recorder.current.stop(); return; } try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks: Blob[] = []; const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((item) => MediaRecorder.isTypeSupported(item)); const next = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined); recorder.current = next; next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; next.onstop = () => { const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" }); const reader = new FileReader(); reader.onload = () => { onAudio(reader.result as string); setNotice("录音已保存（最长 60 秒）。"); }; reader.readAsDataURL(blob); stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; recorder.current = null; setRecording(false); }; next.start(); setRecording(true); setNotice("正在录音，再点一次即可结束。"); window.setTimeout(() => { if (recorder.current === next && next.state === "recording") next.stop(); }, 60_000); } catch { setNotice("无法使用麦克风，请在浏览器中允许麦克风权限。"); } };
  return <section className="voice-tools"><div><b>🎙️ 语音记录</b><small>语音转文字需要网络；录音最长 60 秒。</small></div><div className="voice-actions"><button type="button" onClick={transcribe}>{listening ? "正在听…" : "语音转文字"}</button><button type="button" className={recording ? "recording" : ""} onClick={record}>{recording ? "结束录音" : "开始录音"}</button></div>{notice && <p>{notice}</p>}{audio && <div className="audio-draft"><audio controls src={audio}>你的浏览器不支持播放录音。</audio><button type="button" onClick={() => onAudio("")}>删除录音</button></div>}</section>;
}
