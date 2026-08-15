CREATE TABLE `daily_missions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `local_date` VARCHAR(10) NOT NULL,
    `status` ENUM('active', 'completed') NOT NULL DEFAULT 'active',
    `content_version` VARCHAR(191) NULL,
    `study_session_id` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `daily_missions_study_session_id_key`(`study_session_id`),
    UNIQUE INDEX `daily_missions_user_id_local_date_key`(`user_id`, `local_date`),
    INDEX `daily_missions_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `daily_mission_steps` (
    `id` VARCHAR(191) NOT NULL,
    `mission_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `type` ENUM('study', 'vocabulary', 'text') NOT NULL,
    `status` ENUM('pending', 'completed', 'skipped') NOT NULL DEFAULT 'pending',
    `reference_id` VARCHAR(191) NULL,

    UNIQUE INDEX `daily_mission_steps_mission_id_position_key`(`mission_id`, `position`),
    INDEX `daily_mission_steps_mission_id_status_idx`(`mission_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `daily_missions`
    ADD CONSTRAINT `daily_missions_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `daily_missions`
    ADD CONSTRAINT `daily_missions_study_session_id_fkey`
    FOREIGN KEY (`study_session_id`) REFERENCES `study_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `daily_mission_steps`
    ADD CONSTRAINT `daily_mission_steps_mission_id_fkey`
    FOREIGN KEY (`mission_id`) REFERENCES `daily_missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
