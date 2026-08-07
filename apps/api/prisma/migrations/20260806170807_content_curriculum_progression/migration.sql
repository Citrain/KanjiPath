-- CreateTable
CREATE TABLE `content_sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `license` VARCHAR(191) NOT NULL,
    `attribution_text` TEXT NULL,
    `source_version` VARCHAR(191) NULL,
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checksum` VARCHAR(191) NULL,

    UNIQUE INDEX `content_sources_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_versions` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `git_commit` VARCHAR(191) NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,

    UNIQUE INDEX `content_versions_version_key`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `radicals` (
    `id` VARCHAR(191) NOT NULL,
    `literal` VARCHAR(191) NOT NULL,
    `variant` VARCHAR(191) NULL,
    `name_fr` VARCHAR(191) NULL,
    `meaning_fr` VARCHAR(191) NULL,
    `stroke_count` INTEGER NULL,

    UNIQUE INDEX `radicals_literal_key`(`literal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `components` (
    `id` VARCHAR(191) NOT NULL,
    `literal` VARCHAR(191) NOT NULL,
    `name_fr` VARCHAR(191) NULL,
    `meaning_fr` VARCHAR(191) NULL,
    `component_type` ENUM('kanji', 'radical', 'shape') NOT NULL,

    UNIQUE INDEX `components_literal_key`(`literal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kanji` (
    `id` VARCHAR(191) NOT NULL,
    `literal` VARCHAR(191) NOT NULL,
    `unicode_codepoint` VARCHAR(191) NOT NULL,
    `stroke_count` INTEGER NOT NULL,
    `frequency_rank` INTEGER NULL,
    `school_grade` INTEGER NULL,
    `primary_radical_id` VARCHAR(191) NULL,
    `kanjivg_path` VARCHAR(191) NULL,
    `status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',
    `content_version_id` VARCHAR(191) NULL,

    UNIQUE INDEX `kanji_literal_key`(`literal`),
    UNIQUE INDEX `kanji_unicode_codepoint_key`(`unicode_codepoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kanji_meanings` (
    `id` VARCHAR(191) NOT NULL,
    `kanji_id` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `meaning` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `source_id` VARCHAR(191) NULL,
    `editorial_status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',

    INDEX `kanji_meanings_kanji_id_language_idx`(`kanji_id`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kanji_readings` (
    `id` VARCHAR(191) NOT NULL,
    `kanji_id` VARCHAR(191) NOT NULL,
    `reading` VARCHAR(191) NOT NULL,
    `reading_type` ENUM('onyomi', 'kunyomi', 'nanori') NOT NULL,
    `okurigana` VARCHAR(191) NULL,
    `commonness` ENUM('common', 'rare') NOT NULL DEFAULT 'common',
    `source_id` VARCHAR(191) NULL,

    INDEX `kanji_readings_reading_idx`(`reading`),
    INDEX `kanji_readings_kanji_id_reading_type_idx`(`kanji_id`, `reading_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kanji_components` (
    `kanji_id` VARCHAR(191) NOT NULL,
    `component_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `is_radical` BOOLEAN NOT NULL DEFAULT false,
    `role` ENUM('semantic', 'phonetic', 'unknown') NOT NULL DEFAULT 'unknown',
    `confidence` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
    `source_id` VARCHAR(191) NULL,

    INDEX `kanji_components_component_id_idx`(`component_id`),
    PRIMARY KEY (`kanji_id`, `component_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kanji_notes` (
    `kanji_id` VARCHAR(191) NOT NULL,
    `mnemonic_fr` TEXT NULL,
    `etymology_fr` TEXT NULL,
    `etymology_source` VARCHAR(191) NULL,
    `confusions` JSON NULL,
    `editorial_status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',

    PRIMARY KEY (`kanji_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curricula` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',
    `published_at` DATETIME(3) NULL,

    UNIQUE INDEX `curricula_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_kanji` (
    `curriculum_id` VARCHAR(191) NOT NULL,
    `kanji_id` VARCHAR(191) NOT NULL,
    `level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL,
    `order` INTEGER NOT NULL,
    `confidence` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
    `source_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,

    INDEX `curriculum_kanji_curriculum_id_level_order_idx`(`curriculum_id`, `level`, `order`),
    PRIMARY KEY (`curriculum_id`, `kanji_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vocabulary` (
    `id` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `written_form` VARCHAR(191) NOT NULL,
    `reading` VARCHAR(191) NOT NULL,
    `meaning_fr` TEXT NOT NULL,
    `part_of_speech` VARCHAR(191) NULL,
    `frequency_rank` INTEGER NULL,
    `estimated_level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NULL,
    `source_id` VARCHAR(191) NULL,
    `editorial_status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',

    UNIQUE INDEX `vocabulary_external_id_key`(`external_id`),
    INDEX `vocabulary_reading_idx`(`reading`),
    INDEX `vocabulary_written_form_idx`(`written_form`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vocabulary_kanji` (
    `vocabulary_id` VARCHAR(191) NOT NULL,
    `kanji_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `reading_in_word` VARCHAR(191) NULL,

    INDEX `vocabulary_kanji_kanji_id_idx`(`kanji_id`),
    PRIMARY KEY (`vocabulary_id`, `kanji_id`, `position`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentences` (
    `id` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `japanese` VARCHAR(191) NOT NULL,
    `translation_fr` TEXT NOT NULL,
    `difficulty` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL DEFAULT 'N5',
    `source_id` VARCHAR(191) NULL,
    `author` VARCHAR(191) NULL,
    `license` VARCHAR(191) NULL,
    `editorial_status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',

    UNIQUE INDEX `sentences_external_id_key`(`external_id`),
    INDEX `sentences_japanese_idx`(`japanese`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sentence_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `sentence_id` VARCHAR(191) NOT NULL,
    `surface` VARCHAR(191) NOT NULL,
    `reading` VARCHAR(191) NULL,
    `start_offset` INTEGER NOT NULL,
    `end_offset` INTEGER NOT NULL,
    `vocabulary_id` VARCHAR(191) NULL,

    INDEX `sentence_tokens_sentence_id_idx`(`sentence_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercise_templates` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `skill` ENUM('meaning', 'reading', 'vocabulary', 'context', 'stroke') NOT NULL,
    `schema_version` INTEGER NOT NULL DEFAULT 1,
    `renderer` VARCHAR(191) NOT NULL,
    `grader` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `exercise_templates_type_schema_version_key`(`type`, `schema_version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercise_items` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL,
    `skill` ENUM('meaning', 'reading', 'vocabulary', 'context', 'stroke') NOT NULL,
    `kanji_id` VARCHAR(191) NULL,
    `vocabulary_id` VARCHAR(191) NULL,
    `sentence_id` VARCHAR(191) NULL,
    `prompt_json` JSON NOT NULL,
    `answer_json` JSON NOT NULL,
    `explanation_json` JSON NULL,
    `difficulty` INTEGER NOT NULL DEFAULT 1,
    `source_id` VARCHAR(191) NULL,
    `content_version_id` VARCHAR(191) NULL,
    `editorial_status` ENUM('draft', 'review', 'published') NOT NULL DEFAULT 'draft',

    INDEX `exercise_items_level_kanji_id_skill_idx`(`level`, `kanji_id`, `skill`),
    INDEX `exercise_items_level_skill_editorial_status_idx`(`level`, `skill`, `editorial_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_cards` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subject_type` ENUM('kanji', 'vocabulary', 'sentence') NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `skill` ENUM('KANJI_MEANING_RECOGNITION', 'MEANING_TO_KANJI', 'KANJI_READING', 'READING_TO_KANJI', 'READING_TYPE', 'VOCAB_READING', 'VOCAB_MEANING', 'CONTEXT_CLOZE', 'RADICAL_RECOGNITION', 'STROKE_ORDER', 'KANJI_CONFUSION') NOT NULL,
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

    INDEX `review_cards_user_id_due_at_idx`(`user_id`, `due_at`),
    UNIQUE INDEX `review_cards_user_id_subject_type_subject_id_skill_key`(`user_id`, `subject_type`, `subject_id`, `skill`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_logs` (
    `id` VARCHAR(191) NOT NULL,
    `review_card_id` VARCHAR(191) NOT NULL,
    `exercise_item_id` VARCHAR(191) NULL,
    `rating` ENUM('again', 'hard', 'good', 'easy') NOT NULL,
    `was_correct` BOOLEAN NOT NULL,
    `response_time_ms` INTEGER NULL,
    `answer_payload` JSON NULL,
    `state_before` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NOT NULL,
    `state_after` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NOT NULL,
    `due_after` DATETIME(3) NOT NULL,
    `stability_after` DOUBLE NOT NULL,
    `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_logs_review_card_id_reviewed_at_idx`(`review_card_id`, `reviewed_at`),
    INDEX `review_logs_exercise_item_id_idx`(`exercise_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_kanji_progress` (
    `user_id` VARCHAR(191) NOT NULL,
    `kanji_id` VARCHAR(191) NOT NULL,
    `meaning_score` DOUBLE NOT NULL DEFAULT 0,
    `reading_score` DOUBLE NOT NULL DEFAULT 0,
    `vocabulary_score` DOUBLE NOT NULL DEFAULT 0,
    `context_score` DOUBLE NOT NULL DEFAULT 0,
    `stroke_score` DOUBLE NOT NULL DEFAULT 0,
    `overall_score` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('new', 'learning', 'reviewing', 'mastered') NOT NULL DEFAULT 'new',
    `first_seen_at` DATETIME(3) NULL,
    `mastered_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_kanji_progress_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`user_id`, `kanji_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `mode` ENUM('daily', 'weak_points', 'free') NOT NULL DEFAULT 'daily',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `answered_count` INTEGER NOT NULL DEFAULT 0,
    `correct_count` INTEGER NOT NULL DEFAULT 0,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,

    INDEX `study_sessions_user_id_ended_at_idx`(`user_id`, `ended_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_session_items` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `exercise_item_id` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'answered', 'skipped') NOT NULL DEFAULT 'pending',
    `was_correct` BOOLEAN NULL,

    UNIQUE INDEX `study_session_items_session_id_position_key`(`session_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_issues` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `subject_type` ENUM('kanji', 'vocabulary', 'sentence') NOT NULL,
    `subject_ref` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('open', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `content_issues_subject_type_subject_ref_idx`(`subject_type`, `subject_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kanji` ADD CONSTRAINT `kanji_primary_radical_id_fkey` FOREIGN KEY (`primary_radical_id`) REFERENCES `radicals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji` ADD CONSTRAINT `kanji_content_version_id_fkey` FOREIGN KEY (`content_version_id`) REFERENCES `content_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_meanings` ADD CONSTRAINT `kanji_meanings_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_meanings` ADD CONSTRAINT `kanji_meanings_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_readings` ADD CONSTRAINT `kanji_readings_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_readings` ADD CONSTRAINT `kanji_readings_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_components` ADD CONSTRAINT `kanji_components_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_components` ADD CONSTRAINT `kanji_components_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_components` ADD CONSTRAINT `kanji_components_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kanji_notes` ADD CONSTRAINT `kanji_notes_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_kanji` ADD CONSTRAINT `curriculum_kanji_curriculum_id_fkey` FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_kanji` ADD CONSTRAINT `curriculum_kanji_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_kanji` ADD CONSTRAINT `curriculum_kanji_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vocabulary` ADD CONSTRAINT `vocabulary_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vocabulary_kanji` ADD CONSTRAINT `vocabulary_kanji_vocabulary_id_fkey` FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vocabulary_kanji` ADD CONSTRAINT `vocabulary_kanji_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentences` ADD CONSTRAINT `sentences_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_tokens` ADD CONSTRAINT `sentence_tokens_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sentence_tokens` ADD CONSTRAINT `sentence_tokens_vocabulary_id_fkey` FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `exercise_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_vocabulary_id_fkey` FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_sentence_id_fkey` FOREIGN KEY (`sentence_id`) REFERENCES `sentences`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_content_version_id_fkey` FOREIGN KEY (`content_version_id`) REFERENCES `content_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_cards` ADD CONSTRAINT `review_cards_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_logs` ADD CONSTRAINT `review_logs_review_card_id_fkey` FOREIGN KEY (`review_card_id`) REFERENCES `review_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_logs` ADD CONSTRAINT `review_logs_exercise_item_id_fkey` FOREIGN KEY (`exercise_item_id`) REFERENCES `exercise_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_kanji_progress` ADD CONSTRAINT `user_kanji_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_kanji_progress` ADD CONSTRAINT `user_kanji_progress_kanji_id_fkey` FOREIGN KEY (`kanji_id`) REFERENCES `kanji`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_sessions` ADD CONSTRAINT `study_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_session_items` ADD CONSTRAINT `study_session_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_session_items` ADD CONSTRAINT `study_session_items_exercise_item_id_fkey` FOREIGN KEY (`exercise_item_id`) REFERENCES `exercise_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_issues` ADD CONSTRAINT `content_issues_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
