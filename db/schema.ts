import {
  boolean,
  date,
  datetime,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const studyRecords = mysqlTable(
  "study_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    category: mysqlEnum("category", ["学校课程", "课外辅导", "兴趣班"]).notNull(),
    course: varchar("course", { length: 200 }).notNull(),
    studyDate: date("study_date", { mode: "string" }).notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    location: varchar("location", { length: 200 }).notNull().default(""),
    homework: text("homework").notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("study_records_date_start_idx").on(table.studyDate, table.startTime)],
);

export const healthRecords = mysqlTable(
  "health_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    healthCondition: varchar("health_condition", { length: 200 }).notNull(),
    hospital: varchar("hospital", { length: 200 }).notNull().default(""),
    visitAt: datetime("visit_at", { mode: "string" }).notNull(),
    treatment: text("treatment").notNull(),
    followUp: datetime("follow_up", { mode: "string" }),
    result: text("result").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index("health_records_visit_idx").on(table.visitAt), index("health_records_follow_up_idx").on(table.followUp)],
);
