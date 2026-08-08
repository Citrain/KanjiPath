-- Phase 5 audio resources are additive. Rollback: drop the foreign keys, then
-- `audio_resources`, remove `audio_resource_id`, and recreate the two enums
-- without AUDIO_DICTATION/listening after migrating dependent rows.

ALTER TABLE `review_cards` MODIFY `skill` ENUM('KANJI_MEANING_RECOGNITION', 'MEANING_TO_KANJI', 'KANJI_READING', 'READING_TO_KANJI', 'READING_TYPE', 'VOCAB_READING', 'VOCAB_MEANING', 'CONTEXT_CLOZE', 'RADICAL_RECOGNITION', 'STROKE_ORDER', 'KANJI_CONFUSION', 'AUDIO_DICTATION') NOT NULL;
ALTER TABLE `exercise_items` MODIFY `skill` ENUM('meaning', 'reading', 'vocabulary', 'context', 'stroke', 'listening') NOT NULL;
ALTER TABLE `user_kanji_progress` ADD COLUMN `listening_score` DOUBLE NOT NULL DEFAULT 0;

CREATE TABLE `audio_resources` (
    `id` VARCHAR(191) NOT NULL,
    `vocabulary_id` VARCHAR(191) NULL,
    `sentence_id` VARCHAR(191) NULL,
    `source_id` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `transcript` TEXT NOT NULL,
    `attribution_text` TEXT NOT NULL,
    `license` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft',
    UNIQUE INDEX `audio_resources_file_path_key`(`file_path`),
    INDEX `audio_resources_vocabulary_id_idx`(`vocabulary_id`),
    INDEX `audio_resources_sentence_id_idx`(`sentence_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exercise_items` ADD COLUMN `audio_resource_id` VARCHAR(191) NULL;
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_audio_resource_id_fkey` FOREIGN KEY (`audio_resource_id`) REFERENCES `audio_resources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `audio_resources` ADD CONSTRAINT `audio_resources_vocabulary_id_fkey` FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `audio_resources` ADD CONSTRAINT `audio_resources_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `audio_resources` ADD CONSTRAINT `audio_resources_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
