-- AlterTable
ALTER TABLE `user_settings` ADD COLUMN `auto_balance` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `review_limit` INTEGER NOT NULL DEFAULT 40;

-- CreateTable
CREATE TABLE `mini_texts` (
    `id` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `translation_fr` TEXT NOT NULL,
    `level` ENUM('N5', 'N4', 'N3', 'N2', 'N1') NOT NULL DEFAULT 'N5',
    `author` VARCHAR(191) NULL,
    `license` VARCHAR(191) NULL,
    `source_id` VARCHAR(191) NULL,
    `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft',

    UNIQUE INDEX `mini_texts_external_id_key`(`external_id`),
    INDEX `mini_texts_level_idx`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mini_text_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `mini_text_id` VARCHAR(191) NOT NULL,
    `surface` VARCHAR(191) NOT NULL,
    `reading` VARCHAR(191) NULL,
    `romaji` VARCHAR(191) NULL,
    `start_offset` INTEGER NOT NULL,
    `end_offset` INTEGER NOT NULL,

    INDEX `mini_text_tokens_mini_text_id_idx`(`mini_text_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mini_texts` ADD CONSTRAINT `mini_texts_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `content_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mini_text_tokens` ADD CONSTRAINT `mini_text_tokens_mini_text_id_fkey` FOREIGN KEY (`mini_text_id`) REFERENCES `mini_texts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
