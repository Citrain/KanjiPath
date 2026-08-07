# Modèle de données

Schéma de données complet (concepts obligatoires, le schéma exact peut évoluer).

---

## 1. Identité et préférences

### `users`

- `id`, `email`, `password_hash`, `display_name`
- `created_at`, `updated_at`, `last_login_at`

### `user_settings`

- `user_id`, `active_level`, `daily_new_limit`, `desired_retention`
- `furigana_mode`, `romaji_enabled`, `timezone`, `theme`

### `sessions`

- `id`, `user_id`, `token_hash`, `expires_at`
- `created_at`, `last_seen_at`, `revoked_at`

---

## 2. Référentiel kanji

### `kanji`

- `id`, `literal`, `unicode_codepoint`, `stroke_count`
- `frequency_rank`, `school_grade`, `primary_radical_id`
- `kanjivg_path`, `status`, `content_version_id`

### `kanji_meanings`

- `id`, `kanji_id`, `language`, `meaning`
- `is_primary`, `source_id`, `editorial_status`

### `kanji_readings`

- `id`, `kanji_id`, `reading`, `reading_type`
- `okurigana`, `commonness`, `source_id`

### `radicals`

- `id`, `literal`, `variant`, `name_fr`, `meaning_fr`, `stroke_count`

### `components`

- `id`, `literal`, `name_fr`, `meaning_fr`, `component_type`

### `kanji_components`

- `kanji_id`, `component_id`, `position`
- `is_radical`, `is_semantic`, `is_phonetic`, `confidence`, `source_id`

### `kanji_notes`

- `kanji_id`, `mnemonic_fr`, `etymology_fr`, `etymology_source`
- `confusions`, `editorial_status`

---

## 3. Curriculum

### `curricula`

- `id`, `code`, `name`, `version`, `status`, `published_at`

### `curriculum_kanji`

- `curriculum_id`, `kanji_id`, `level`, `order`
- `confidence`, `source_id`, `reviewed_at`

---

## 4. Vocabulaire et phrases

### `vocabulary`

- `id`, `written_form`, `reading`, `meaning_fr`
- `part_of_speech`, `frequency_rank`, `estimated_level`
- `source_id`, `editorial_status`

### `vocabulary_kanji`

- `vocabulary_id`, `kanji_id`, `position`, `reading_in_word`

### `sentences`

- `id`, `japanese`, `translation_fr`, `difficulty`
- `source_id`, `source_external_id`, `author`, `license`
- `editorial_status`

### `sentence_tokens`

- `id`, `sentence_id`, `surface`, `reading`
- `start_offset`, `end_offset`, `vocabulary_id`

---

## 5. Exercices

### `exercise_templates`

- `id`, `type`, `skill`, `schema_version`, `renderer`, `grader`

### `exercise_items`

- `id`, `external_id` (identifiant stable du pack, unique), `template_id`, `level`,
  `skill`, `kanji_id`, `vocabulary_id`, `sentence_id`
- `prompt_json`, `answer_json`, `explanation_json`
- `difficulty`, `source_id`, `content_version_id`, `editorial_status`

> `external_id` permet un upsert idempotent du pack : les identifiants du pipeline
> deviennent les identifiants en base, la progression (cartes, historiques) survit
> aux rechargements de contenu.

---

## 6. Progression

### `review_cards`

- `id`, `user_id`, `subject_type`, `subject_id`, `skill`
- données FSRS sérialisées
- `due_at`, `last_review_at`, `state`

### `review_logs`

- `id`, `review_card_id`, `exercise_item_id`, `rating`, `was_correct`
- `response_time_ms`, `answer_payload`
- état avant, état après
- `reviewed_at`

### `user_kanji_progress`

- `user_id`, `kanji_id`
- `meaning_score`, `reading_score`, `vocabulary_score`
- `context_score`, `stroke_score`, `overall_score`
- `status`, `first_seen_at`, `mastered_at`, `updated_at`

### `study_sessions`

- `id`, `user_id`, `mode`
- `started_at`, `ended_at`
- `answered_count`, `correct_count`, `duration_seconds`

### `study_session_items` (reprise de session)

- `id`, `session_id`, `position`, `exercise_item_id`
- `status` (`pending` / `answered` / `skipped`), `was_correct`

> La file d'une session est persistée pour permettre la reprise exacte
> (`GET /study/resume`).

### `content_issues` (signalements)

- `id`, `user_id`, `subject_type`, `subject_ref`, `message`, `status`, `created_at`

---

## 7. Provenance et version

### `content_sources`

- `id`, `name`, `url`, `license`, `attribution_text`
- `source_version`, `imported_at`, `checksum`

### `content_versions`

- `id`, `version`, `git_commit`, `published_at`, `notes`

---

## Index critiques (MariaDB)

```text
review_cards(user_id, due_at)
review_cards(user_id, subject_id, skill)
curriculum_kanji(curriculum_id, level, order)
exercise_items(level, kanji_id, skill)
kanji_readings(reading)
vocabulary(reading)
review_logs(review_card_id, reviewed_at)
```

---

## Décisions refusées

- **JSON direct servi par React** : progression difficile à synchroniser, pas de modèle éditorial
- **Une seule table kanji avec JSON** : requêtes complexes, duplication, pas de contraintes
- **Champ `mastered: boolean`** : la maîtrise est multidimensionnelle et évolutive
