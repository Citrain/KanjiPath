-- AlterTable
ALTER TABLE `kanji_readings` ADD COLUMN `romaji` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sentence_tokens` ADD COLUMN `romaji` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user_settings` MODIFY `romaji_enabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `vocabulary` ADD COLUMN `romaji` VARCHAR(191) NULL;

-- Romaji activé pour les utilisateurs existants (nouvelle fonctionnalité)
UPDATE `user_settings` SET `romaji_enabled` = true;
