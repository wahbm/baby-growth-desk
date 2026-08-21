"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Section = "study" | "health";
type StudyCategory = "学校课程" | "课外辅导" | "兴趣班";
type StudyRecord = {
  id: string;
  category: StudyCategory;
  course: string;
  date: string;
  start: string;
  end: string;
  location: string;
  homework: string;
  done: boolean;
};
type HealthRecord = {
  id: string;
  condition: string;
  hospital: string;
  visitAt: string;
  treatment: string;
  followUp: string;
  result: string;
};
type DeskData = { study: StudyRecord[]; health: HealthRecord[] };
type Editor = { kind: Section; id?: string } | null;

const STORAGE_KEY = "tangtang-local-desk-v1";
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function localDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  return new Date(value + "T12:00:00");
}

function moveDate(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function weekFor(value: string) {
  const selected = parseDate(value);
  const mondayOffset = (selected.getDay() + 6) % 7;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return localDateKey(day);
  });
}

function makeId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function seedData(today: string): DeskData {
  return {
    study: [
      { id: "seed-reading", category: "学校课程", course: "语文 · 暑假阅读", date: today, start: "09:00", end: "09:40", location: "家里", homework: "把最喜欢的一段读给爸爸妈妈听", done: true },
      { id: "seed-math", category: "课外辅导", course: "思维数学", date: today, start: "10:30", end: "11:30", location: "社区学习中心", homework: "完成练习册第 8 页", done: false },
      { id: "seed-dance", category: "兴趣班", course: "舞蹈基础班", date: today, start: "16:30", end: "17:30", location: "星星舞蹈教室", homework: "压腿 10 分钟，复习上节课动作", done: false },
    ],
    health: [
      { id: "seed-dental", condition: "牙齿常规检查", hospital: "上海市儿童医院", visitAt: moveDate(today, -9) + "T14:30", treatment: "继续认真刷牙，使用儿童牙线", followUp: moveDate(today, 82) + "T14:30", result: "情况良好，没有发现龋齿" },
    ],
  };
}

function valueOf(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function categoryClass(category: StudyCategory) {
  if (category === "兴趣班") return "interest";
  if (category === "课外辅导") return "tutor";
  return "school";
}

function formatVisit(value: string) {
  if (!value) return "未填写";
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const today = localDateKey();
  const [section, setSection] = useState<Section>("study");
  const [selectedDate, setSelectedDate] = useState(today);
  const [healthDayOnly, setHealthDayOnly] = useState(false);
  const [data, setData] = useState<DeskData>(() => seedData(today));
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DeskData;
        if (Array.isArray(parsed.study) && Array.isArray(parsed.health)) setData(parsed);
      }
    } catch {
      setNotice("本地记录读取失败，已先打开示例内容。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      setNotice("离线功能暂未启用，请保持网络后重新打开一次。");
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setNotice("当前浏览器无法继续保存，请先导出备份。");
    }
  }, [data, ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const week = useMemo(() => weekFor(selectedDate), [selectedDate]);
  const dayStudy = useMemo(
    () => data.study.filter((item) => item.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)),
    [data.study, selectedDate],
  );
  const completed = dayStudy.filter((item) => item.done).length;
  const progress = dayStudy.length ? Math.round((completed / dayStudy.length) * 100) : 0;
  const healthRecords = useMemo(() => {
    const records = healthDayOnly ? data.health.filter((item) => item.visitAt.slice(0, 10) === selectedDate) : data.health;
    return [...records].sort((a, b) => b.visitAt.localeCompare(a.visitAt));
  }, [data.health, healthDayOnly, selectedDate]);
  const nextFollowUp = useMemo(
    () => data.health.filter((item) => item.followUp && item.followUp >= today + "T00:00").sort((a, b) => a.followUp.localeCompare(b.followUp))[0],
    [data.health, today],
  );
  const editingStudy = editor?.kind === "study" ? data.study.find((item) => item.id === editor.id) : undefined;
  const editingHealth = editor?.kind === "health" ? data.health.find((item) => item.id === editor.id) : undefined;

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    if (section === "health") setHealthDayOnly(true);
  };

  const goTo = (next: Section) => {
    setSection(next);
    if (next === "health") setHealthDayOnly(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveStudy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: StudyRecord = {
      id: editingStudy?.id || makeId("study"),
      category: valueOf(form, "category") as StudyCategory,
      course: valueOf(form, "course"),
      date: valueOf(form, "date"),
      start: valueOf(form, "start"),
      end: valueOf(form, "end"),
      location: valueOf(form, "location"),
      homework: valueOf(form, "homework"),
      done: editingStudy?.done || false,
    };
    setData((current) => ({ ...current, study: editingStudy ? current.study.map((item) => item.id === editingStudy.id ? next : item) : [...current.study, next] }));
    setSelectedDate(next.date);
    setSection("study");
    setEditor(null);
    setNotice(editingStudy ? "学习记录已更新" : "学习记录已保存到本机");
  };

  const saveHealth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: HealthRecord = {
      id: editingHealth?.id || makeId("health"),
      condition: valueOf(form, "condition"),
      hospital: valueOf(form, "hospital"),
      visitAt: valueOf(form, "visitAt"),
      treatment: valueOf(form, "treatment"),
      followUp: valueOf(form, "followUp"),
      result: valueOf(form, "result"),
    };
    setData((current) => ({ ...current, health: editingHealth ? current.health.map((item) => item.id === editingHealth.id ? next : item) : [...current.health, next] }));
    setSection("health");
    setHealthDayOnly(false);
    setEditor(null);
    setNotice(editingHealth ? "健康记录已更新" : "健康记录已保存到本机");
  };

  const removeStudy = (id: string) => {
    if (!window.confirm("确定删除这条学习记录吗？")) return;
    setData((current) => ({ ...current, study: current.study.filter((item) => item.id !== id) }));
    setNotice("学习记录已删除");
  };

  const removeHealth = (id: string) => {
    if (!window.confirm("确定删除这条健康记录吗？")) return;
    setData((current) => ({ ...current, health: current.health.filter((item) => item.id !== id) }));
    setNotice("健康记录已删除");
  };

  const selectedLabel = parseDate(selectedDate).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  return (
    <main className="app-shell">
      <header className="profile-bar">
        <img src="/tangtang-avatar.png" alt="糖糖的插画头像" />
        <div>
          <p>文博文 · 糖糖</p>
          <h1>成长记录</h1>
        </div>
        <button type="button" className="icon-button" aria-label="打开设置" onClick={() => setSettingsOpen(true)}>⚙</button>
      </header>

      <nav className="segmented" aria-label="工作台分类">
        <button type="button" className={section === "study" ? "active" : ""} onClick={() => goTo("study")}>学习记录</button>
        <button type="button" className={section === "health" ? "active" : ""} onClick={() => goTo("health")}>健康记录</button>
      </nav>

      <div className="week-controls">
        <button type="button" aria-label="上一周" onClick={() => setSelectedDate(moveDate(selectedDate, -7))}>‹</button>
        <span>{parseDate(week[0]).toLocaleDateString("zh-CN", { month: "long" })}</span>
        <button type="button" aria-label="下一周" onClick={() => setSelectedDate(moveDate(selectedDate, 7))}>›</button>
      </div>
      <section className="week-row" aria-label="日期选择">
        {week.map((date) => {
          const day = parseDate(date);
          const className = [date === selectedDate ? "selected" : "", date === today ? "today" : ""].filter(Boolean).join(" ");
          return <button type="button" className={className} key={date} aria-pressed={date === selectedDate} onClick={() => chooseDate(date)}><span>{weekdays[day.getDay()]}</span><b>{day.getDate()}</b><i /></button>;
        })}
      </section>

      {section === "study" ? (
        <div className="page-content">
          <section className="date-banner">
            <div><p>{selectedLabel}</p><h2>{dayStudy.length ? "今天有 " + dayStudy.length + " 项学习安排" : "今天还没有学习安排"}</h2><span>{dayStudy.length ? "轻松完成，记得留一点玩耍时间" : "添加一项课程或作业，安排清晰不忙乱"}</span></div>
            <div className="progress-number"><b>{progress}%</b><span>已完成</span></div>
          </section>

          <section className="progress-strip" aria-label={"完成 " + completed + " 项，共 " + dayStudy.length + " 项"}>
            <div><b>今日进度</b><span>{completed}/{dayStudy.length}</span></div>
            <div className="progress-track"><i style={{ width: progress + "%" }} /></div>
          </section>

          <div className="section-title"><h2>课程与作业</h2><button type="button" onClick={() => setEditor({ kind: "study" })}>＋ 新增</button></div>
          {dayStudy.length ? dayStudy.map((item) => (
            <article className={"record-card " + categoryClass(item.category) + (item.done ? " done" : "")} key={item.id}>
              <button type="button" className="complete-button" aria-label={item.done ? "标记为未完成" : "标记为已完成"} onClick={() => setData((current) => ({ ...current, study: current.study.map((record) => record.id === item.id ? { ...record, done: !record.done } : record) }))}>{item.done ? "✓" : ""}</button>
              <div className="record-copy">
                <div className="record-meta"><span className="badge">{item.category}</span><time>{item.start}{item.end ? "–" + item.end : ""}</time></div>
                <h3>{item.course}</h3>
                <p>{item.location || "未填写地点"}</p>
                <small><b>作业</b>{item.homework || "暂无课后作业"}</small>
              </div>
              <div className="card-actions">
                <button type="button" aria-label="编辑学习记录" onClick={() => setEditor({ kind: "study", id: item.id })}>✎</button>
                <button type="button" className="danger" aria-label="删除学习记录" onClick={() => removeStudy(item.id)}>×</button>
              </div>
            </article>
          )) : <EmptyState icon="✎" title="这一天还没有安排" text="点击新增，记录学校课程、辅导班或兴趣班。" />}
        </div>
      ) : (
        <div className="page-content">
          <section className="date-banner health-banner">
            <div><p>健康档案</p><h2>{data.health.length ? "已经认真记录 " + data.health.length + " 次" : "从第一条健康记录开始"}</h2><span>{nextFollowUp ? "下次复诊：" + formatVisit(nextFollowUp.followUp) : "记录就诊、治疗和复诊效果"}</span></div>
            <div className="health-mark">♡</div>
          </section>

          <div className="section-title">
            <div><h2>{healthDayOnly ? selectedLabel + "的记录" : "全部健康记录"}</h2><span>{healthRecords.length} 条</span></div>
            <div className="title-actions">{healthDayOnly && <button type="button" onClick={() => setHealthDayOnly(false)}>查看全部</button>}<button type="button" onClick={() => setEditor({ kind: "health" })}>＋ 新增</button></div>
          </div>
          {healthRecords.length ? healthRecords.map((item) => (
            <article className="health-card" key={item.id}>
              <div className="health-card-top"><span className="badge">就诊记录</span><time>{formatVisit(item.visitAt)}</time></div>
              <h3>{item.condition}</h3>
              <dl>
                <div><dt>就诊医院</dt><dd>{item.hospital || "未填写"}</dd></div>
                <div><dt>治疗方案</dt><dd>{item.treatment || "未填写"}</dd></div>
                <div><dt>复诊时间</dt><dd>{item.followUp ? formatVisit(item.followUp) : "无需复诊 / 未填写"}</dd></div>
                <div><dt>治疗效果</dt><dd>{item.result || "待观察"}</dd></div>
              </dl>
              <div className="health-actions"><button type="button" onClick={() => setEditor({ kind: "health", id: item.id })}>编辑</button><button type="button" className="danger-text" onClick={() => removeHealth(item.id)}>删除</button></div>
            </article>
          )) : <EmptyState icon="♡" title={healthDayOnly ? "这一天没有健康记录" : "还没有健康记录"} text="有就诊或身体变化时，简单记一笔就好。" />}
        </div>
      )}

      <button type="button" className="floating-add" aria-label={section === "study" ? "新增学习记录" : "新增健康记录"} onClick={() => setEditor({ kind: section })}>＋</button>
      <nav className="bottom-nav" aria-label="主要导航">
        <button type="button" onClick={() => { setSelectedDate(today); goTo("study"); }}><span>⌂</span>今天</button>
        <button type="button" className={section === "study" ? "active" : ""} onClick={() => goTo("study")}><span>▤</span>学习</button>
        <button type="button" className={section === "health" ? "active" : ""} onClick={() => goTo("health")}><span>♡</span>健康</button>
        <button type="button" onClick={() => setSettingsOpen(true)}><span>⚙</span>设置</button>
      </nav>

      <div className="toast" aria-live="polite" hidden={!notice}>{notice}</div>

      {editor?.kind === "study" && (
        <Sheet title={editingStudy ? "编辑学习记录" : "新增学习记录"} onClose={() => setEditor(null)}>
          <form key={"study-" + (editingStudy?.id || "new")} onSubmit={saveStudy}>
            <label>记录类型<select name="category" defaultValue={editingStudy?.category || "学校课程"}><option>学校课程</option><option>课外辅导</option><option>兴趣班</option></select></label>
            <label>课程 / 作业名称<input name="course" required defaultValue={editingStudy?.course || ""} placeholder="例如：语文暑假阅读" /></label>
            <div className="form-row"><label>日期<input name="date" type="date" required defaultValue={editingStudy?.date || selectedDate} /></label><label>地点<input name="location" defaultValue={editingStudy?.location || ""} placeholder="可不填" /></label></div>
            <div className="form-row"><label>开始时间<input name="start" type="time" required defaultValue={editingStudy?.start || "09:00"} /></label><label>结束时间<input name="end" type="time" defaultValue={editingStudy?.end || ""} /></label></div>
            <label>作业内容<textarea name="homework" defaultValue={editingStudy?.homework || ""} placeholder="例如：口算 20 题、练琴 15 分钟" /></label>
            <div className="form-actions"><button type="button" onClick={() => setEditor(null)}>取消</button><button type="submit" className="save-button">保存到本机</button></div>
          </form>
        </Sheet>
      )}

      {editor?.kind === "health" && (
        <Sheet title={editingHealth ? "编辑健康记录" : "新增健康记录"} onClose={() => setEditor(null)}>
          <form key={"health-" + (editingHealth?.id || "new")} onSubmit={saveHealth}>
            <label>疾病 / 健康情况<input name="condition" required defaultValue={editingHealth?.condition || ""} placeholder="例如：感冒、体检、牙齿检查" /></label>
            <label>就诊医院<input name="hospital" defaultValue={editingHealth?.hospital || ""} placeholder="可不填" /></label>
            <label>就诊时间<input name="visitAt" type="datetime-local" required defaultValue={editingHealth?.visitAt || selectedDate + "T09:00"} /></label>
            <label>治疗方案<textarea name="treatment" defaultValue={editingHealth?.treatment || ""} placeholder="例如：遵医嘱用药、居家休息" /></label>
            <label>复诊时间<input name="followUp" type="datetime-local" defaultValue={editingHealth?.followUp || ""} /></label>
            <label>治疗效果<textarea name="result" defaultValue={editingHealth?.result || ""} placeholder="例如：已退烧，精神状态良好" /></label>
            <div className="form-actions"><button type="button" onClick={() => setEditor(null)}>取消</button><button type="submit" className="save-button">保存到本机</button></div>
          </form>
        </Sheet>
      )}

      {settingsOpen && <Settings data={data} onImport={(next) => { setData(next); setSettingsOpen(false); setNotice("备份已导入"); }} onClear={() => { setData({ study: [], health: [] }); setSettingsOpen(false); setNotice("本机记录已清空"); }} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <section className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></section>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="sheet-backdrop" onMouseDown={onClose}><section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p>糖糖成长记录</p><h2 id="sheet-title">{title}</h2></div><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>{children}</section></div>;
}

function Settings({ data, onImport, onClear, onClose }: { data: DeskData; onImport: (data: DeskData) => void; onClear: () => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const exportData = () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "糖糖成长记录备份-" + localDateKey() + ".json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const next = (parsed.data || parsed) as DeskData;
        if (!Array.isArray(next.study) || !Array.isArray(next.health)) throw new Error();
        onImport(next);
      } catch {
        setError("这个文件不是有效的糖糖工作台备份。");
      }
    };
    reader.readAsText(file);
  };
  const clearAll = () => {
    if (window.confirm("确定清空全部学习和健康记录吗？建议先导出备份。")) onClear();
  };
  return (
    <Sheet title="本机数据与备份" onClose={onClose}>
      <section className="local-note"><span>⌁</span><div><b>无需登录，可安装后离线使用</b><p>记录只保存在当前设备。首次联网打开后，在 Safari 中选择“添加到主屏幕”，以后换网络或没有网络也能打开；清理网站数据或更换手机前，请先导出备份。</p></div></section>
      <div className="settings-list">
        <button type="button" onClick={exportData}><span>⇩</span><div><b>导出备份</b><small>{data.study.length} 条学习记录 · {data.health.length} 条健康记录</small></div><i>›</i></button>
        <button type="button" onClick={() => inputRef.current?.click()}><span>⇧</span><div><b>导入备份</b><small>从之前导出的 JSON 文件恢复</small></div><i>›</i></button>
        <input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={(event) => importData(event.target.files?.[0])} />
        <button type="button" className="clear-button" onClick={clearAll}><span>×</span><div><b>清空全部记录</b><small>此操作不能撤销</small></div><i>›</i></button>
      </div>
      {error && <p className="settings-error">{error}</p>}
    </Sheet>
  );
}
