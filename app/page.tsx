"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Course = { id: string; title: string; category: string; day: number; time: string; homework: string; done: boolean };
type Task = { id: string; title: string; subject: string; due: string; done: boolean };
type Health = { id: string; illness: string; hospital: string; date: string; plan: string; followUp: string; effect: string };
type Data = { courses: Course[]; tasks: Task[]; health: Health[] };

const key = "tangtang-desk-v1";
const today = new Date().toISOString().slice(0, 10);
const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const sample: Data = {
  courses: [
    { id: "c1", title: "语文阅读", category: "学校", day: 1, time: "09:00", homework: "阅读《安徒生童话》20分钟", done: false },
    { id: "c2", title: "数学思维", category: "课外辅导", day: 3, time: "14:00", homework: "完成练习册第 8 页", done: false },
    { id: "c3", title: "少儿芭蕾", category: "兴趣班", day: 6, time: "10:00", homework: "复习基本手位与脚位", done: false },
  ],
  tasks: [
    { id: "t1", title: "朗读课文《夏天》", subject: "语文", due: today, done: false },
    { id: "t2", title: "口算练习 20 题", subject: "数学", due: today, done: false },
  ],
  health: [],
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function Home() {
  const [data, setData] = useState<Data>(sample);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"home" | "study" | "health" | "data">("home");
  const [modal, setModal] = useState<"task" | "course" | "health" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setData(JSON.parse(saved));
    } catch { /* keep a usable fresh desk if a saved draft is malformed */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(data)); }, [data, ready]);

  const toggleTask = (id: string) => setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }));
  const toggleCourse = (id: string) => setData((d) => ({ ...d, courses: d.courses.map((c) => c.id === id ? { ...c, done: !c.done } : c) }));
  const todayCourses = useMemo(() => data.courses.filter((c) => c.day === new Date().getDay()).sort((a, b) => a.time.localeCompare(b.time)), [data]);
  const openTasks = data.tasks.filter((t) => !t.done);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `糖糖工作台备份-${today}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (parsed.courses && parsed.tasks && parsed.health) setData(parsed); else alert("这不是糖糖工作台的备份文件。"); } catch { alert("备份文件无法读取。"); } };
    reader.readAsText(file); event.target.value = "";
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="avatar">糖</div>
        <div><p className="eyebrow">文博文 · 一年级暑假</p><h1>糖糖的小小工作台</h1></div>
        <button className="round-btn" onClick={() => setTab("data")} aria-label="打开数据与备份">···</button>
      </header>

      {tab === "home" && <>
        <section className="hero-card">
          <span className="sun">☀</span><div><p>{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p><h2>今天也一起慢慢长大</h2><small>学习有收获，身体有活力</small></div>
        </section>
        <section className="summary-grid">
          <button onClick={() => setTab("study")}><b>{openTasks.length}</b><span>待完成作业</span></button>
          <button onClick={() => setTab("study")}><b>{todayCourses.length}</b><span>今日日程</span></button>
          <button onClick={() => setTab("health")}><b>{data.health.length}</b><span>健康记录</span></button>
        </section>
        <section className="section"><div className="section-head"><h2>今日安排</h2><button className="text-btn" onClick={() => setTab("study")}>查看全部</button></div>
          {todayCourses.length ? todayCourses.map((c) => <div className="agenda" key={c.id}><time>{c.time}</time><i className={`dot ${c.category}`}></i><div><b>{c.title}</b><small>{c.category} · {c.homework || "暂无作业"}</small></div></div>) : <Empty icon="🍉" text="今天没有安排，享受轻松时光吧！" />}
        </section>
        <section className="section"><div className="section-head"><h2>待完成作业</h2><button className="text-btn" onClick={() => setModal("task")}>+ 新增</button></div>
          {openTasks.slice(0, 3).map((t) => <TaskRow key={t.id} task={t} toggle={toggleTask} />)}
          {!openTasks.length && <Empty icon="🌟" text="全部完成，真棒！" />}
        </section>
      </>}

      {tab === "study" && <Study data={data} toggleTask={toggleTask} toggleCourse={toggleCourse} add={() => setModal("course")} addTask={() => setModal("task")} />}
      {tab === "health" && <Health records={data.health} add={() => setModal("health")} />}
      {tab === "data" && <DataPanel exportData={exportData} chooseImport={() => fileRef.current?.click()} reset={() => { if (confirm("确定清空本机所有记录吗？此操作无法恢复。")) setData({ courses: [], tasks: [], health: [] }); }} />}

      <nav className="bottom-nav">
        <NavButton active={tab === "home"} icon="⌂" label="首页" onClick={() => setTab("home")} />
        <NavButton active={tab === "study"} icon="✎" label="学习" onClick={() => setTab("study")} />
        <NavButton active={tab === "health"} icon="♡" label="健康" onClick={() => setTab("health")} />
        <NavButton active={tab === "data"} icon="▣" label="数据" onClick={() => setTab("data")} />
      </nav>
      <input ref={fileRef} className="hidden" type="file" accept="application/json" onChange={importData} />
      {modal && <AddModal type={modal} close={() => setModal(null)} save={(item) => { setData((d) => modal === "task" ? { ...d, tasks: [...d.tasks, item as Task] } : modal === "course" ? { ...d, courses: [...d.courses, item as Course] } : { ...d, health: [...d.health, item as Health] }); setModal(null); }} />}
    </main>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) { return <div className="empty"><span>{icon}</span>{text}</div>; }
function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button onClick={onClick} className={active ? "active" : ""}><b>{icon}</b><span>{label}</span></button>; }
function TaskRow({ task, toggle }: { task: Task; toggle: (id: string) => void }) { return <button className={`task-row ${task.done ? "done" : ""}`} onClick={() => toggle(task.id)}><span className="check">{task.done ? "✓" : ""}</span><span><b>{task.title}</b><small>{task.subject} · {task.due === today ? "今天" : task.due}</small></span></button>; }

function Study({ data, toggleTask, toggleCourse, add, addTask }: { data: Data; toggleTask: (id: string) => void; toggleCourse: (id: string) => void; add: () => void; addTask: () => void }) {
  const [week, setWeek] = useState(new Date().getDay());
  const courses = data.courses.filter((c) => c.day === week).sort((a, b) => a.time.localeCompare(b.time));
  return <div className="page"><div className="page-title"><div><p className="eyebrow">快乐学习，自主完成</p><h2>学习计划</h2></div><button className="add-btn" onClick={add}>+ 课程</button></div>
    <div className="weekbar">{weekday.map((w, i) => <button key={w} className={week === i ? "selected" : ""} onClick={() => setWeek(i)}>{w}</button>)}</div>
    <section className="section"><div className="section-head"><h2>{weekday[week]}课程</h2></div>{courses.length ? courses.map((c) => <button className={`course-card ${c.done ? "done" : ""}`} onClick={() => toggleCourse(c.id)} key={c.id}><time>{c.time}</time><div><span className={`tag ${c.category}`}>{c.category}</span><b>{c.title}</b><small>{c.homework ? `作业：${c.homework}` : "暂无作业"}</small></div><span className="check">{c.done ? "✓" : ""}</span></button>) : <Empty icon="📚" text="这天还没有课程，点右上角添加吧。" />}</section>
    <section className="section"><div className="section-head"><h2>作业清单</h2><button className="text-btn" onClick={addTask}>+ 新增</button></div>{data.tasks.map((t) => <TaskRow key={t.id} task={t} toggle={toggleTask} />)}{!data.tasks.length && <Empty icon="✏️" text="还没有作业记录。" />}</section>
  </div>;
}

function Health({ records, add }: { records: Health[]; add: () => void }) { return <div className="page"><div className="page-title"><div><p className="eyebrow">认真记录，安心陪伴</p><h2>健康档案</h2></div><button className="add-btn" onClick={add}>+ 记录</button></div>
  <section className="health-tip"><span>💚</span><div><b>日常健康小提示</b><small>保证充足睡眠、均衡饮食和每日户外活动。</small></div></section>
  <section className="section"><div className="section-head"><h2>就诊与健康记录</h2><span className="count">{records.length} 条</span></div>{records.length ? records.slice().reverse().map((r) => <article className="health-card" key={r.id}><div><time>{r.date}</time><span>{r.illness}</span></div><b>{r.hospital || "日常健康记录"}</b><p><strong>治疗方案：</strong>{r.plan || "未填写"}</p>{r.followUp && <p><strong>复诊时间：</strong>{r.followUp}</p>}{r.effect && <p><strong>治疗效果：</strong>{r.effect}</p>}</article>) : <Empty icon="🌿" text="暂时没有健康记录，希望一直健健康康！" />}</section>
 </div>; }

function DataPanel({ exportData, chooseImport, reset }: { exportData: () => void; chooseImport: () => void; reset: () => void }) { return <div className="page"><div className="page-title"><div><p className="eyebrow">数据只存于当前设备</p><h2>备份与设置</h2></div></div><section className="privacy"><span>🔒</span><div><b>你的记录是私密的</b><p>不需要注册，也不会上传。换手机前，请先导出备份文件。</p></div></section><section className="settings"><button onClick={exportData}><span>⇩</span><div><b>导出备份</b><small>保存全部学习与健康记录</small></div><em>›</em></button><button onClick={chooseImport}><span>⇧</span><div><b>导入备份</b><small>从以前导出的文件恢复数据</small></div><em>›</em></button><button className="danger" onClick={reset}><span>⌫</span><div><b>清空本机记录</b><small>此操作无法恢复</small></div><em>›</em></button></section></div>; }

function AddModal({ type, close, save }: { type: "task" | "course" | "health"; close: () => void; save: (value: Task | Course | Health) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ date: today, due: today, category: "学校", day: String(new Date().getDay()), time: "09:00" });
  const field = (name: string, label: string, placeholder = "", kind = "text") => <label>{label}<input type={kind} placeholder={placeholder} value={form[name] || ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></label>;
  const submit = () => { if (!form.title && !form.illness) return alert("请先填写名称或健康情况。"); const base = { id: uid() }; if (type === "task") save({ ...base, title: form.title, subject: form.subject || "作业", due: form.due, done: false }); else if (type === "course") save({ ...base, title: form.title, category: form.category, day: Number(form.day), time: form.time, homework: form.homework, done: false }); else save({ ...base, illness: form.illness, hospital: form.hospital, date: form.date, plan: form.plan, followUp: form.followUp, effect: form.effect }); };
  return <div className="modal-backdrop" onMouseDown={close}><form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(); }}><div className="modal-head"><h2>{type === "task" ? "新增作业" : type === "course" ? "新增课程" : "新增健康记录"}</h2><button type="button" onClick={close}>×</button></div>{type === "task" && <>{field("title", "作业内容", "例如：口算练习 20 题")}{field("subject", "科目", "例如：数学")}{field("due", "完成日期", "", "date")}</>}{type === "course" && <>{field("title", "课程名称", "例如：英语绘本")}<label>课程类型<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>学校</option><option>课外辅导</option><option>兴趣班</option></select></label><label>星期<select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>{weekday.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>{field("time", "上课时间", "", "time")}{field("homework", "课后作业", "可不填写")}</>}{type === "health" && <>{field("illness", "疾病 / 健康情况", "例如：感冒、常规体检")}{field("hospital", "就诊医院", "可不填写")}{field("date", "就诊时间", "", "date")}{field("plan", "治疗方案", "例如：遵医嘱用药、居家休息")}{field("followUp", "复诊时间", "可不填写", "date")}{field("effect", "治疗效果", "可不填写")}</>}<button className="save-btn" type="submit">保存记录</button></form></div>;
}
