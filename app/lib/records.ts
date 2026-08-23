export type StudyCategory = "学校课程" | "课外辅导" | "兴趣班";

export type StudyRecord = {
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

export type HealthRecord = {
  id: string;
  condition: string;
  hospital: string;
  visitAt: string;
  treatment: string;
  followUp: string;
  result: string;
};

export type DeskData = { study: StudyRecord[]; health: HealthRecord[] };

const categories = new Set<StudyCategory>(["学校课程", "课外辅导", "兴趣班"]);
const idPattern = /^[A-Za-z0-9_-]{1,64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;

export class InputError extends Error {}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError(`${label}格式不正确`);
  return value as Record<string, unknown>;
}

function textValue(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string") throw new InputError(`${label}格式不正确`);
  const text = value.trim();
  if (required && !text) throw new InputError(`请填写${label}`);
  if (text.length > max) throw new InputError(`${label}不能超过 ${max} 个字符`);
  return text;
}

function validCalendarDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateValue(value: unknown, label: string) {
  const text = textValue(value, label, 10, true);
  if (!validCalendarDate(text)) throw new InputError(`${label}格式不正确`);
  return text;
}

function timeValue(value: unknown, label: string, required = false) {
  const text = textValue(value, label, 5, required);
  if (text && !timePattern.test(text)) throw new InputError(`${label}格式不正确`);
  return text;
}

function dateTimeValue(value: unknown, label: string, required = false) {
  const text = textValue(value, label, 16, required);
  if (text && (!dateTimePattern.test(text) || !validCalendarDate(text.slice(0, 10)))) {
    throw new InputError(`${label}格式不正确`);
  }
  return text;
}

export function parseStudyRecord(value: unknown): StudyRecord {
  const record = objectValue(value, "学习记录");
  const id = textValue(record.id, "记录 ID", 64, true);
  if (!idPattern.test(id)) throw new InputError("记录 ID 格式不正确");
  if (!categories.has(record.category as StudyCategory)) throw new InputError("学习记录类型不正确");
  if (typeof record.done !== "boolean") throw new InputError("完成状态格式不正确");
  const start = timeValue(record.start, "开始时间", true);
  const end = timeValue(record.end, "结束时间");
  if (end && end <= start) throw new InputError("结束时间必须晚于开始时间");
  return {
    id,
    category: record.category as StudyCategory,
    course: textValue(record.course, "课程 / 作业名称", 200, true),
    date: dateValue(record.date, "日期"),
    start,
    end,
    location: textValue(record.location, "地点", 200),
    homework: textValue(record.homework, "作业内容", 5000),
    done: record.done,
  };
}

export function parseHealthRecord(value: unknown): HealthRecord {
  const record = objectValue(value, "健康记录");
  const id = textValue(record.id, "记录 ID", 64, true);
  if (!idPattern.test(id)) throw new InputError("记录 ID 格式不正确");
  return {
    id,
    condition: textValue(record.condition, "疾病 / 健康情况", 200, true),
    hospital: textValue(record.hospital, "就诊医院", 200),
    visitAt: dateTimeValue(record.visitAt, "就诊时间", true),
    treatment: textValue(record.treatment, "治疗方案", 5000),
    followUp: dateTimeValue(record.followUp, "复诊时间"),
    result: textValue(record.result, "治疗效果", 5000),
  };
}

export function parseDeskData(value: unknown): DeskData {
  const data = objectValue(value, "备份数据");
  if (!Array.isArray(data.study) || !Array.isArray(data.health)) throw new InputError("备份数据格式不正确");
  if (data.study.length > 2000 || data.health.length > 2000) throw new InputError("单次最多导入 2000 条同类记录");
  return { study: data.study.map(parseStudyRecord), health: data.health.map(parseHealthRecord) };
}
