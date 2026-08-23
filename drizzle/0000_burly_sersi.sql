CREATE TABLE `health_records` (
	`id` varchar(64) NOT NULL,
	`health_condition` varchar(200) NOT NULL,
	`hospital` varchar(200) NOT NULL DEFAULT '',
	`visit_at` datetime NOT NULL,
	`treatment` text NOT NULL,
	`follow_up` datetime,
	`result` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `health_records_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `study_records` (
	`id` varchar(64) NOT NULL,
	`category` enum('学校课程','课外辅导','兴趣班') NOT NULL,
	`course` varchar(200) NOT NULL,
	`study_date` date NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time,
	`location` varchar(200) NOT NULL DEFAULT '',
	`homework` text NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `study_records_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE INDEX `health_records_visit_idx` ON `health_records` (`visit_at`);--> statement-breakpoint
CREATE INDEX `health_records_follow_up_idx` ON `health_records` (`follow_up`);--> statement-breakpoint
CREATE INDEX `study_records_date_start_idx` ON `study_records` (`study_date`,`start_time`);
