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
GET    /kanji/:literal/related
GET    /kanji/:literal/vocabulary
GET    /kanji/:literal/sentences
GET    /kanji/:literal/progress
GET    /texts
GET    /texts/:id
GET    /audio/:id
```

---

## Étude

```
POST   /study/sessions
GET    /study/queue
POST   /study/answers
POST   /study/sessions/:id/finish
POST   /study/sessions/:id/abandon
GET    /study/resume
```

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
