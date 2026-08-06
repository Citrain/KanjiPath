# AGENTS.md

Règles pour tout agent (humain ou IA) modifiant ce projet.
Référence produit/architecture : `ADR-001-plateforme-apprentissage-kanji.md` (découpé par tâche dans `adr/`).

## À lire avant toute modification

1. `ADR-001-plateforme-apprentissage-kanji.md` + le dossier `adr/<theme>/` concerné.
2. `docs/README.md` (index de la documentation), puis le(s) document(s) du module touché.
3. `docs/agent/guide.md` (conventions, pièges connus, recettes).

## Obligations

1. Lire l'ADR et la documentation du module concerné.
2. Créer ou mettre à jour les migrations Prisma (jamais de migration destructive silencieuse).
3. Mettre à jour les contrats API dans `packages/contracts`.
4. Ajouter les tests (unitaires, intégration si nécessaire).
5. Exécuter les validateurs de contenu (`pnpm content:validate`).
6. Ne jamais modifier silencieusement une provenance ou une licence.
7. Ajouter un ADR si une décision structurante change.

## Obligation de documentation (humaine + agent)

Toute modification significative DOIT mettre à jour, dans le même changement :

- **Documentation humaine** (`docs/`) : architecture, contenu, opérations. Elle doit
  rester compréhensible par un nouvel arrivant sans lire le code. Voir `docs/README.md`.
- **Documentation agent** : ce fichier (`AGENTS.md`) et `docs/agent/guide.md`.
  Tout piège découvert, toute convention nouvelle, toute commande utile doit y être
  consigné pour que l'agent suivant ne retombe pas dessus.

Une tâche n'est **pas terminée** si la documentation correspondante n'est pas à jour.

## Cartographie de la documentation

| Fichier | Public | Contenu |
|---|---|---|
| `README.md` | humain | Démarrage rapide, scripts |
| `AGENTS.md` | agent | Règles obligatoires (ce fichier) |
| `docs/README.md` | les deux | Index de la documentation |
| `docs/architecture/overview.md` | humain | Stack, monorepo, flux de données, sécurité |
| `docs/content/pipeline.md` | humain | Pipeline de contenu (download → publish) |
| `docs/content/licensing.md` | humain | Sources, licences, provenance |
| `docs/operations/development.md` | humain | Environnement local (sans Docker), MariaDB |
| `docs/operations/deployment.md` | humain | Environnements, production |
| `docs/adr/README.md` | les deux | Pointeur vers l'ADR et son découpage |
| `docs/agent/guide.md` | agent | Conventions, pièges connus, recettes |

## Commandes de vérification

```bash
pnpm typecheck          # TypeScript strict sur tout le monorepo
pnpm lint               # Biome
pnpm test               # build + tests (unitaires + intégration MariaDB)
pnpm content:validate   # validateurs de contenu
```

Setup / lancement :

```bash
.\dev.bat               # ou pnpm dev:all  -> setup complet + serveurs
pnpm dev:setup          # setup seul (DB, migrations) sans serveurs
pnpm dev                # serveurs seul (DB déjà à jour)
```

## Contraintes techniques

- Node.js 24 LTS, TypeScript strict, pnpm workspaces.
- MariaDB local (pas de Docker) + Prisma provider `mysql`.
- Aucun appel LLM au runtime ; exercices fixes, versionnés, validés.
- Ne jamais présenter les listes de kanji comme « officielles JLPT » :
  formulation obligatoire « Parcours aligné sur le JLPT ».
- Authentification : Argon2id, cookie `HttpOnly` + `SameSite=Lax`, CSRF double-submit,
  aucun token en localStorage.
- La mnémotechnique ne doit jamais être présentée comme l'étymologie.
- Ne jamais appeler un composant « radical » automatiquement.

## Définition de terminé

Voir ADR-001 section 26 : code fonctionnel, types stricts, erreurs gérées, tests,
accessibilité, **documentation humaine + agent à jour**, provenance du contenu,
pipeline valide, aucun secret commité, migration réversible ou documentée,
fonctionnement mobile + ordinateur.
