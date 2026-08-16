-- Preserve the internal FSRS state while a manually known kanji is suspended.
ALTER TABLE `review_cards`
  ADD COLUMN `state_before_suspension` ENUM('New', 'Learning', 'Review', 'Relearning', 'Suspended') NULL;
