-- AlterTable
ALTER TABLE `exercise_items` ADD COLUMN `external_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `exercise_items_external_id_key` ON `exercise_items`(`external_id`);

