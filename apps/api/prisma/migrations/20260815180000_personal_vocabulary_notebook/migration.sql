-- Additive personal vocabulary notebook. All tables are user-owned and deliberately separate from curriculum review_cards/review_logs.
-- Rollback: drop foreign keys, then personal_vocabulary_session_items, personal_vocabulary_review_logs,
-- personal_vocabulary_review_cards, personal_vocabulary_sources, personal_vocabulary_sessions and personal_vocabulary_entries.
CREATE TABLE `personal_vocabulary_entries` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `surface` VARCHAR(191) NOT NULL,
  `reading` VARCHAR(191) NULL,
  `meaning_fr` TEXT NULL,
  `excerpt` TEXT NULL,
  `dedupe_key` VARCHAR(191) NOT NULL,
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `personal_vocabulary_entries_user_id_dedupe_key_key` (`user_id`, `dedupe_key`),
  INDEX `personal_vocabulary_entries_user_id_archived_at_created_at_idx` (`user_id`, `archived_at`, `created_at`),
  CONSTRAINT `personal_vocabulary_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `personal_vocabulary_sources` (
  `id` VARCHAR(191) NOT NULL,
  `entry_id` VARCHAR(191) NOT NULL,
  `origin` ENUM('published_vocabulary', 'published_text', 'conversation') NOT NULL,
  `reference` VARCHAR(191) NULL,
  `content_version` VARCHAR(191) NULL,
  `source_name` VARCHAR(191) NULL,
  `source_url` TEXT NULL,
  `source_version` VARCHAR(191) NULL,
  `attribution_text` TEXT NULL,
  `license` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `personal_vocabulary_sources_entry_id_key` (`entry_id`),
  CONSTRAINT `personal_vocabulary_sources_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `personal_vocabulary_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `personal_vocabulary_review_cards` (
  `id` VARCHAR(191) NOT NULL,
  `entry_id` VARCHAR(191) NOT NULL,
  `kind` ENUM('meaning', 'reading', 'self') NOT NULL,
  `state` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NOT NULL DEFAULT 'New',
  `due_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `stability` DOUBLE NOT NULL DEFAULT 0,
  `difficulty` DOUBLE NOT NULL DEFAULT 0,
  `reps` INTEGER NOT NULL DEFAULT 0,
  `lapses` INTEGER NOT NULL DEFAULT 0,
  `elapsed_days` DOUBLE NOT NULL DEFAULT 0,
  `scheduled_days` DOUBLE NOT NULL DEFAULT 0,
  `learning_steps` DOUBLE NOT NULL DEFAULT 0,
  `last_review_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `personal_vocabulary_review_cards_entry_id_kind_key` (`entry_id`, `kind`),
  INDEX `personal_vocabulary_review_cards_due_at_idx` (`due_at`),
  CONSTRAINT `personal_vocabulary_review_cards_entry_id_fkey` FOREIGN KEY (`entry_id`) REFERENCES `personal_vocabulary_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `personal_vocabulary_review_logs` (
  `id` VARCHAR(191) NOT NULL,
  `review_card_id` VARCHAR(191) NOT NULL,
  `rating` ENUM('again', 'hard', 'good', 'easy') NOT NULL,
  `was_correct` BOOLEAN NOT NULL,
  `response_time_ms` INTEGER NULL,
  `answer_payload` JSON NULL,
  `state_before` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NOT NULL,
  `state_after` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NOT NULL,
  `due_after` DATETIME(3) NOT NULL,
  `stability_after` DOUBLE NOT NULL,
  `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `personal_vocabulary_review_logs_review_card_id_reviewed_at_idx` (`review_card_id`, `reviewed_at`),
  CONSTRAINT `personal_vocabulary_review_logs_review_card_id_fkey` FOREIGN KEY (`review_card_id`) REFERENCES `personal_vocabulary_review_cards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `personal_vocabulary_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  `answered_count` INTEGER NOT NULL DEFAULT 0,
  `correct_count` INTEGER NOT NULL DEFAULT 0,
  `duration_seconds` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `personal_vocabulary_sessions_user_id_ended_at_idx` (`user_id`, `ended_at`),
  CONSTRAINT `personal_vocabulary_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `personal_vocabulary_session_items` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `position` INTEGER NOT NULL,
  `review_card_id` VARCHAR(191) NOT NULL,
  `status` ENUM('pending', 'answered', 'skipped') NOT NULL DEFAULT 'pending',
  `was_correct` BOOLEAN NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `personal_vocabulary_session_items_session_id_position_key` (`session_id`, `position`),
  INDEX `personal_vocabulary_session_items_session_id_status_idx` (`session_id`, `status`),
  CONSTRAINT `personal_vocabulary_session_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `personal_vocabulary_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `personal_vocabulary_session_items_review_card_id_fkey` FOREIGN KEY (`review_card_id`) REFERENCES `personal_vocabulary_review_cards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
