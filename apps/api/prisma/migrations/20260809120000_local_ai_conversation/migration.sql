-- Additive local conversation storage. Audio buffers and partial STT hypotheses are intentionally not persisted.
-- Rollback: drop foreign keys, then learning_events, conversation_turns and conversation_sessions.
CREATE TABLE `conversation_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL,
  `scenario` VARCHAR(191) NOT NULL,
  `difficulty` ENUM('easy', 'normal', 'hard') NOT NULL,
  `correction_mode` ENUM('none', 'important', 'all', 'end_of_turn', 'end_of_session') NOT NULL,
  `japanese_speech_speed` ENUM('slow', 'normal', 'natural') NOT NULL,
  `goals_json` JSON NOT NULL,
  `status` ENUM('active', 'ended') NOT NULL DEFAULT 'active',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `conversation_sessions_user_id_ended_at_idx` (`user_id`, `ended_at`),
  CONSTRAINT `conversation_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `conversation_turns` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `position` INTEGER NOT NULL,
  `transcript` TEXT NOT NULL,
  `correction_json` JSON NULL,
  `reply_json` JSON NOT NULL,
  `context_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `conversation_turns_session_id_position_key` (`session_id`, `position`),
  INDEX `conversation_turns_session_id_created_at_idx` (`session_id`, `created_at`),
  CONSTRAINT `conversation_turns_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `conversation_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `learning_events` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `turn_id` VARCHAR(191) NOT NULL,
  `type` ENUM('grammar', 'vocabulary', 'new_item') NOT NULL,
  `target_id` VARCHAR(191) NOT NULL,
  `outcome` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `learning_events_session_id_created_at_idx` (`session_id`, `created_at`),
  INDEX `learning_events_turn_id_idx` (`turn_id`),
  CONSTRAINT `learning_events_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `conversation_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `learning_events_turn_id_fkey` FOREIGN KEY (`turn_id`) REFERENCES `conversation_turns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
