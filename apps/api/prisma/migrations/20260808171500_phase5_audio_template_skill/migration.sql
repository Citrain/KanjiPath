-- Completes the additive Phase 5 skill enum migration for exercise templates.
-- Rollback: after removing listening templates, recreate this enum without `listening`.
ALTER TABLE `exercise_templates` MODIFY `skill` ENUM('meaning', 'reading', 'vocabulary', 'context', 'stroke', 'listening') NOT NULL;
