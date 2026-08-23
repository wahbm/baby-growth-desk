import mysql, { type Pool } from "mysql2/promise";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS study_records (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    category ENUM('学校课程', '课外辅导', '兴趣班') NOT NULL,
    course VARCHAR(200) NOT NULL,
    study_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NULL,
    location VARCHAR(200) NOT NULL DEFAULT '',
    homework TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX study_records_date_start_idx (study_date, start_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS health_records (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    health_condition VARCHAR(200) NOT NULL,
    hospital VARCHAR(200) NOT NULL DEFAULT '',
    visit_at DATETIME NOT NULL,
    treatment TEXT NOT NULL,
    follow_up DATETIME NULL,
    result TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX health_records_visit_idx (visit_at),
    INDEX health_records_follow_up_idx (follow_up)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;

declare global {
  // Reuse connections across development reloads and warm production requests.
  var tangtangMariaDbPool: Pool | undefined;
  var tangtangSchemaReady: Promise<void> | undefined;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少数据库环境变量 ${name}`);
  return value;
}

function poolLimit() {
  const value = Number.parseInt(process.env.DB_POOL_LIMIT || "4", 10);
  return Number.isFinite(value) && value >= 1 && value <= 10 ? value : 4;
}

export function getPool() {
  if (!globalThis.tangtangMariaDbPool) {
    globalThis.tangtangMariaDbPool = mysql.createPool({
      host: process.env.DB_HOST?.trim() || "127.0.0.1",
      port: Number.parseInt(process.env.DB_PORT || "3306", 10),
      database: requiredEnvironment("DB_NAME"),
      user: requiredEnvironment("DB_USER"),
      password: requiredEnvironment("DB_PASSWORD"),
      connectionLimit: poolLimit(),
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      charset: "utf8mb4",
      dateStrings: true,
      timezone: "local",
    });
  }
  return globalThis.tangtangMariaDbPool;
}

export async function ensureSchema() {
  if (!globalThis.tangtangSchemaReady) {
    globalThis.tangtangSchemaReady = (async () => {
      const pool = getPool();
      for (const statement of schemaStatements) await pool.query(statement);
    })().catch((error) => {
      globalThis.tangtangSchemaReady = undefined;
      throw error;
    });
  }
  await globalThis.tangtangSchemaReady;
}

export async function checkDatabase() {
  await ensureSchema();
  await getPool().query("SELECT 1");
}
