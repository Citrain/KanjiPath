# API

Routes REST — préfixe `/api/v1`.

---

## Authentification

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/password/change
```

---

## Curriculum

```
GET    /curricula
GET    /curricula/:code/levels
GET    /curricula/:code/levels/:level
GET    /curricula/:code/levels/:level/progress
```

---

## Kanji

```
GET    /kanji
GET    /kanji/:literal
GET    /kanji/:literal/map
GET    /kanji/:literal/related
GET    /kanji/:literal/vocabulary
GET    /kanji/:literal/sentences
GET    /kanji/:literal/progress
POST   /kanji/:literal/known
GET    /texts
GET    /texts/:id
GET    /audio/:id
```

`GET /kanji/:literal/map` (ADR-006) exige une session et renvoie un sous-graphe borné
autour du kanji publié. Chaque lien est typé (`shared_component`, `visual_confusion`,
`shared_word`, `curriculum_neighbor`) et expose la provenance et la version de contenu.

---

## Étude

```
POST   /study/sessions
GET    /study/queue
POST   /study/answers
POST   /study/sessions/:id/finish
POST   /study/sessions/:id/abandon
GET    /study/resume
GET    /study/sessions/:id
GET    /study/missions/today
POST   /study/missions/today
POST   /study/missions/:missionId/steps/:stepId
```

La mission quotidienne est un snapshot personnel date : le `POST` la cree seulement si
elle n'existe pas encore pour le jour local de l'utilisateur ; le `GET` la reprend. Les
etapes non-etude sont marquees `completed` ou `skipped` par la derniere route. L'etape
d'etude est terminee par la sous-session FSRS associee.

---

## Conversation locale (ADR-003, future)

```
POST   /conversations
GET    /conversations/:id
POST   /conversations/:id/end
GET    /conversation-topics
GET    /conversation-settings
GET    /voices/ja
GET    /local-ai/health
WS     /conversations/:id/live
```

Le WebSocket transporte les chunks audio et les événements `stt.partial`, `stt.final`,
correction, texte et audio. Les contrats doivent borner les payloads et valider la
sortie structurée du LLM côté backend.

---

## Progression

```
GET    /progress/dashboard
GET    /progress/levels/:level
GET    /progress/weak-points
GET    /progress/history
GET    /progress/stats
```

---

## Carnet personnel (ADR-007)

```
GET    /personal-vocabulary?archived=false
POST   /personal-vocabulary
POST   /personal-vocabulary/:id/archive
POST   /personal-vocabulary/:id/restore
DELETE /personal-vocabulary/:id
GET    /personal-vocabulary/resume
POST   /personal-vocabulary/sessions
POST   /personal-vocabulary/answers
POST   /personal-vocabulary/sessions/:id/finish
POST   /personal-vocabulary/sessions/:id/abandon
```

Les créations publiées ne reçoivent qu'un identifiant de contenu : l'API résout et fige
elle-même les données et leur provenance. Une création conversationnelle exige un tour
appartenant à la session de l'utilisateur authentifié.

---

## Paramètres

```
GET    /settings
PATCH  /settings
```

---

## Contenu et signalement

```
POST   /content/issues
GET    /sources
```

---

> L'API d'administration n'est pas exposée publiquement en V1. Les corrections de contenu passent par le dépôt Git et le pipeline.

`GET /audio/:id` exige une session valide, ne sert que les ressources publiées et pose
`Content-Type: audio/mpeg`, `X-Content-Type-Options: nosniff` et un cache privé.
