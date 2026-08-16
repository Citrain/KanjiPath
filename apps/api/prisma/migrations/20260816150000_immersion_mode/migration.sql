-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `immersion_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `immersion_help_level` INTEGER NULL;
