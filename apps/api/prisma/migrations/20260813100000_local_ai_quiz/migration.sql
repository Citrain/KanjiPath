-- Additive local AI quiz sessions. Quiz snapshots are user data, never published content.
-- Rollback: DROP TABLE `ai_quiz_answers`; DROP TABLE `ai_quiz_sessions`; DROP TYPE `AiQuizStatus` is not applicable on MariaDB.
CREATE TABLE `ai_quiz_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `prompt` TEXT NOT NULL,
  `level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL,
  `question_count` INTEGER NOT NULL,
  `types_json` JSON NOT NULL,
  `skills_json` JSON NOT NULL,
  `quiz_json` JSON NOT NULL,
  `status` ENUM('active', 'finished') NOT NULL DEFAULT 'active',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  `answered_count` INTEGER NOT NULL DEFAULT 0,
  `correct_count` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `ai_quiz_sessions_user_id_started_at_idx` (`user_id`, `started_at`),
  CONSTRAINT `ai_quiz_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_quiz_answers` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `question_key` VARCHAR(191) NOT NULL,
  `answer_json` JSON NOT NULL,
  `was_correct` BOOLEAN NOT NULL,
  `response_time_ms` INTEGER NULL,
  `answered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ai_quiz_answers_session_id_question_key_key` (`session_id`, `question_key`),
  INDEX `ai_quiz_answers_session_id_answered_at_idx` (`session_id`, `answered_at`),
  CONSTRAINT `ai_quiz_answers_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `ai_quiz_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
