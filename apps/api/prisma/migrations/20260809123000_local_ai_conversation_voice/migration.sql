-- Additive per-session VOICEVOX style selection.
-- Rollback: ALTER TABLE `conversation_sessions` DROP COLUMN `japanese_speaker_id`.
ALTER TABLE `conversation_sessions` ADD COLUMN `japanese_speaker_id` INTEGER NOT NULL DEFAULT 1 AFTER `japanese_speech_speed`;
