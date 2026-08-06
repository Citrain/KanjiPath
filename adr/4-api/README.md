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
```

---

## Étude

```
POST   /study/sessions
GET    /study/queue
POST   /study/answers
POST   /study/sessions/:id/finish
GET    /study/resume
```

---

## Progression

```
GET    /progress/dashboard
GET    /progress/levels/:level
GET    /progress/weak-points
GET    /progress/history
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
