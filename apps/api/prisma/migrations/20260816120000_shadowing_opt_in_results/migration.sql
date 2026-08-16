-- Additive opt-in storage for the shadowing lab (ADR-008).
-- Only a FINAL transcript and its deterministic comparison summary are stored here, and only
-- when the user explicitly chooses to keep a result. Raw audio, PCM buffers, partial transcripts
-- and intermediate analysis never reach the database: they stay in memory in the API/STT relay.
-- Retention: rows belong to the user and are kept until explicit deletion
-- (DELETE /api/v1/shadowing/results/:id or DELETE /api/v1/shadowing/results), or cascade on
-- account deletion. Sentence reference is frozen (japanese/reading/attribution/license snapshot)
-- and the sentence foreign key is set to null if the published content is removed.
-- Rollback: drop foreign keys, then the shadowing_results table.
CREATE TABLE `shadowing_results` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `sentence_id` VARCHAR(191) NULL,
    `source` ENUM('audio', 'tts') NOT NULL,
    `japanese` VARCHAR(191) NOT NULL,
    `reading` TEXT NOT NULL,
    `translation_fr` TEXT NULL,
    `transcript` TEXT NOT NULL,
    `matched` BOOLEAN NOT NULL,
    `matched_segments` INTEGER NOT NULL,
    `total_segments` INTEGER NOT NULL,
    `attribution` TEXT NULL,
    `license` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shadowing_results_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `shadowing_results` ADD CONSTRAINT `shadowing_results_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `shadowing_results` ADD CONSTRAINT `shadowing_results_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;