-- AlterTable
ALTER TABLE `study_sessions` ADD COLUMN `target_json` JSON NULL,
    MODIFY `mode` ENUM('daily', 'weak_points', 'free', 'targeted') NOT NULL DEFAULT 'daily';
