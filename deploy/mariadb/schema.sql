CREATE TABLE IF NOT EXISTS study_records (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS health_records (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
