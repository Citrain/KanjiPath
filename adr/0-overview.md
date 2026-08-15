# ADR-001 — Plateforme web d'apprentissage progressif des kanji

- **Statut** : Accepté
- **Date** : 2026-08-06
- **Version** : 1.0
- **Décisionnaires** : propriétaire du projet
- **Portée** : architecture produit, technique, données pédagogiques et progression
- **Nom de travail** : `KanjiPath`

---

## Contexte

Application web moderne pour apprendre les kanji du débutant au avancé, alignée sur les niveaux JLPT (N5 → N1).

### Fonctionnalités principales

- Fiche kanji extrêmement complète
- Révision avec répétition espacée
- Exercices de reconnaissance (sans IA au runtime)
- Travail des kanji dans des mots et des phrases
- Progression multidimensionnelle (sens, lectures, vocabulaire, contexte, traits)
- Reprise de session exacte
- Multi-utilisateurs dès la V1

### Points importants

- **JLPT** : jamais présenter les listes comme officielles → "Parcours aligné sur le JLPT"
- **Public** : interface française, débutant/intermédiaire, mobile-first
- **Pas d'IA runtime dans les exercices** : tous les exercices sont fixes, validés,
  versionnés. ADR-003 définit l'exception conversationnelle locale, sous contrôle du
  backend et sans source de vérité LLM.

---

## Décisions clés

1. Monorepo TypeScript (pnpm workspaces)
2. Frontend React 19.2 + Vite 8.1 (séparé du backend)
3. Backend NestJS 11 + Fastify + API REST
4. MariaDB 11.4 LTS+ (local, sans Docker ; testée en 12.x) + Prisma v7 (provider `mysql`, adapter `@prisma/adapter-mariadb`)
5. ts-fsrs pour la répétition espacée
6. Node.js 24 LTS (pas de version Current)
7. Pas de microservices

---

## Découpage en tâches

| Dossier | Contenu |
|---------|---------|
| `1-foundations/` | Stack technique, architecture, monorepo |
| `2-content-pipeline/` | Sources de données, pipeline, licences |
| `3-data-model/` | Schéma de données complet |
| `4-api/` | Routes et contrats API |
| `5-kanji-card/` | Fiche kanji (sections 5.1–5.9) |
| `6-exercises/` | Types d'exercices et règles de qualité |
| `7-progression/` | Progression, SRS, FSRS, déblocage |
| `8-ux/` | Écrans, UX, aides, mobile |
| `9-security-perf/` | Sécurité, performance, résilience, observabilité |
| `10-testing-deployment/` | Tests et déploiement |
| `11-phases/` | Plan d'implémentation, phases, critères, principes |
| `12-local-ai-conversation.md` | Découpage opérationnel de l'ADR-003 (conversation vocale locale) |
| `../ADR-005-...md` à `../ADR-011-...md` | Extensions produit : mission, carte, carnet, shadowing, immersion, timeline et mode zen |

---

## Principes structurants

1. **Aucun appel IA pendant les exercices** — contenu fixe et validé
2. **Le contenu est le produit** — schéma, provenance, version, licence, tests
3. **Progression multidimensionnelle** — sens, lectures, vocabulaire, contexte, traits
4. **Niveaux versionnés** — historique préservé lors des corrections

---

## Documentation obligatoire

```
AGENTS.md
README.md
docs/architecture/overview.md
docs/content/pipeline.md
docs/content/licensing.md
docs/operations/development.md
docs/operations/deployment.md
docs/adr/ADR-001-kanji-learning-platform.md
```

---

## Définition de terminé

- Code fonctionnel et types stricts
- Erreurs gérées
- Tests unitaires + intégration + E2E critiques
- Accessibilité respectée
- Documentation à jour
- Provenance du contenu vérifiée
- Pipeline de contenu valide
- Aucun secret commité
- Migration réversible ou documentée
- Fonctionne sur mobile et ordinateur
