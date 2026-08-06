# Tests et déploiement

---

## 18. Tests

### 18.1 Tests unitaires

- normalisation kana
- comparaison des réponses
- calcul de maîtrise
- sélection de file
- déblocage
- agrégation de progression
- encapsulation FSRS
- génération des distracteurs

### 18.2 Tests d'intégration

- inscription et connexion
- récupération d'une fiche
- création d'une session
- enregistrement d'une réponse
- mise à jour de la carte FSRS
- reprise de session
- changement de version de contenu
- recalcul de progression

### 18.3 Tests end-to-end

Scénario principal :

1. créer un compte
2. sélectionner N5
3. ouvrir une fiche
4. terminer la découverte
5. lancer une révision
6. répondre juste et faux
7. fermer l'application
8. se reconnecter
9. retrouver la progression
10. vérifier la prochaine révision

### 18.4 Tests de contenu

- suite de tests et rapport CI dédiés
- **aucun déploiement avec erreur de contenu bloquante**

---

## 19. Déploiement

### 19.1 Développement

Environnement local **sans Docker** :

- `web` : serveur de développement Vite (`pnpm dev`)
- `api` : API NestJS en local (`pnpm dev`)
- `mariadb` : service MariaDB local déjà installé, lancé manuellement ou comme service système
- `mailpit` (facultatif)

### 19.2 Production

- frontend statique servi par CDN
- API Node sur un serveur (conteneur ou process managé par systemd)
- MariaDB managé ou installé sur serveur avec sauvegardes
- reverse proxy TLS
- migrations exécutées avant bascule
- sauvegarde quotidienne
- déploiement sans interruption si possible

### 19.3 Environnements

- local
- test
- staging
- production

> Le contenu publié doit être identique entre staging et production pour une version donnée.
