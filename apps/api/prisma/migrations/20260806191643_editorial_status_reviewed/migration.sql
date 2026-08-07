-- AlterTable
ALTER TABLE `curricula` MODIFY `status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `exercise_items` MODIFY `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `kanji` MODIFY `status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `kanji_meanings` MODIFY `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `kanji_notes` MODIFY `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `sentences` MODIFY `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `vocabulary` MODIFY `editorial_status` ENUM('draft', 'reviewed', 'published') NOT NULL DEFAULT 'draft';

