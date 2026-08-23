import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { DeskData, HealthRecord, StudyRecord } from "@/app/lib/records";
import { ensureSchema, getPool } from "./index";

type StudyRow = RowDataPacket & {
  id: string;
  category: StudyRecord["category"];
  course: string;
  study_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  homework: string;
  done: number | boolean;
};

type HealthRow = RowDataPacket & {
  id: string;
  health_condition: string;
  hospital: string;
  visit_at: string;
  treatment: string;
  follow_up: string | null;
  result: string;
};

function uiTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function uiDateTime(value: string | null) {
  return value ? value.slice(0, 16).replace(" ", "T") : "";
}

function databaseTime(value: string) {
  return value ? `${value}:00` : null;
}

function databaseDateTime(value: string) {
  return value ? `${value.replace("T", " ")}:00` : null;
}

function studyFromRow(row: StudyRow): StudyRecord {
  return {
    id: row.id,
    category: row.category,
    course: row.course,
    date: row.study_date.slice(0, 10),
    start: uiTime(row.start_time),
    end: uiTime(row.end_time),
    location: row.location,
    homework: row.homework,
    done: Boolean(row.done),
  };
}

function healthFromRow(row: HealthRow): HealthRecord {
  return {
    id: row.id,
    condition: row.health_condition,
    hospital: row.hospital,
    visitAt: uiDateTime(row.visit_at),
    treatment: row.treatment,
    followUp: uiDateTime(row.follow_up),
    result: row.result,
  };
}

export async function listRecords(): Promise<DeskData> {
  await ensureSchema();
  const pool = getPool();
  const [study] = await pool.query<StudyRow[]>(
    "SELECT id, category, course, study_date, start_time, end_time, location, homework, done FROM study_records ORDER BY study_date, start_time, id",
  );
  const [health] = await pool.query<HealthRow[]>(
    "SELECT id, health_condition, hospital, visit_at, treatment, follow_up, result FROM health_records ORDER BY visit_at DESC, id",
  );
  return { study: study.map(studyFromRow), health: health.map(healthFromRow) };
}

async function insertStudy(connection: PoolConnection, record: StudyRecord) {
  await connection.execute(
    `INSERT INTO study_records (id, category, course, study_date, start_time, end_time, location, homework, done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.category, record.course, record.date, databaseTime(record.start), databaseTime(record.end), record.location, record.homework, record.done],
  );
}

async function insertHealth(connection: PoolConnection, record: HealthRecord) {
  await connection.execute(
    `INSERT INTO health_records (id, health_condition, hospital, visit_at, treatment, follow_up, result)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.condition, record.hospital, databaseDateTime(record.visitAt), record.treatment, databaseDateTime(record.followUp), record.result],
  );
}

export async function createStudy(record: StudyRecord) {
  await ensureSchema();
  await getPool().execute(
    `INSERT INTO study_records (id, category, course, study_date, start_time, end_time, location, homework, done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.category, record.course, record.date, databaseTime(record.start), databaseTime(record.end), record.location, record.homework, record.done],
  );
  return record;
}

export async function updateStudy(id: string, record: StudyRecord) {
  await ensureSchema();
  const [result] = await getPool().execute<ResultSetHeader>(
    "UPDATE study_records SET category = ?, course = ?, study_date = ?, start_time = ?, end_time = ?, location = ?, homework = ?, done = ? WHERE id = ?",
    [record.category, record.course, record.date, databaseTime(record.start), databaseTime(record.end), record.location, record.homework, record.done, id],
  );
  return result.affectedRows > 0;
}

export async function deleteStudy(id: string) {
  await ensureSchema();
  const [result] = await getPool().execute<ResultSetHeader>("DELETE FROM study_records WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function createHealth(record: HealthRecord) {
  await ensureSchema();
  await getPool().execute(
    `INSERT INTO health_records (id, health_condition, hospital, visit_at, treatment, follow_up, result)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.condition, record.hospital, databaseDateTime(record.visitAt), record.treatment, databaseDateTime(record.followUp), record.result],
  );
  return record;
}

export async function updateHealth(id: string, record: HealthRecord) {
  await ensureSchema();
  const [result] = await getPool().execute<ResultSetHeader>(
    "UPDATE health_records SET health_condition = ?, hospital = ?, visit_at = ?, treatment = ?, follow_up = ?, result = ? WHERE id = ?",
    [record.condition, record.hospital, databaseDateTime(record.visitAt), record.treatment, databaseDateTime(record.followUp), record.result, id],
  );
  return result.affectedRows > 0;
}

export async function deleteHealth(id: string) {
  await ensureSchema();
  const [result] = await getPool().execute<ResultSetHeader>("DELETE FROM health_records WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function replaceRecords(data: DeskData) {
  await ensureSchema();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM study_records");
    await connection.query("DELETE FROM health_records");
    for (const record of data.study) await insertStudy(connection, record);
    for (const record of data.health) await insertHealth(connection, record);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function mergeRecords(data: DeskData) {
  await ensureSchema();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const record of data.study) {
      await connection.execute(
        `INSERT INTO study_records (id, category, course, study_date, start_time, end_time, location, homework, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE category = VALUES(category), course = VALUES(course), study_date = VALUES(study_date), start_time = VALUES(start_time), end_time = VALUES(end_time), location = VALUES(location), homework = VALUES(homework), done = VALUES(done)`,
        [record.id, record.category, record.course, record.date, databaseTime(record.start), databaseTime(record.end), record.location, record.homework, record.done],
      );
    }
    for (const record of data.health) {
      await connection.execute(
        `INSERT INTO health_records (id, health_condition, hospital, visit_at, treatment, follow_up, result)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE health_condition = VALUES(health_condition), hospital = VALUES(hospital), visit_at = VALUES(visit_at), treatment = VALUES(treatment), follow_up = VALUES(follow_up), result = VALUES(result)`,
        [record.id, record.condition, record.hospital, databaseDateTime(record.visitAt), record.treatment, databaseDateTime(record.followUp), record.result],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
