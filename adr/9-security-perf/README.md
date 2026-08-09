# Sécurité, performance et observabilité

---

## 15. Sécurité

### 15.1 Authentification

- mot de passe hashé avec **Argon2id**
- cookie `HttpOnly`, `Secure`, `SameSite=Lax`
- rotation de session après connexion
- expiration et révocation
- limitation des tentatives
- protection CSRF pour les requêtes mutatives
- **aucun token d'authentification en localStorage**

### 15.2 Données utilisateur

- export JSON de la progression
- suppression du compte
- sauvegardes
- journalisation sans réponses sensibles
- aucune publicité ou traçage tiers
- télémétrie désactivable
- les transcripts et la voix de conversation (ADR-003) sont des données utilisateur ;
  aucun envoi tiers par défaut et aucun audio conservé sans choix explicite

### 15.3 SVG

- les fichiers KanjiVG sont traités comme des données contrôlées lors du build
- **ne jamais injecter un SVG arbitraire fourni par un utilisateur**

### 15.4 Conversation locale (future)

- Ollama, STT et TTS liés à `127.0.0.1`, sans exposition LAN par défaut
- taille maximale des chunks et durée maximale des tours
- historique borné, protection contre accumulation mémoire
- sortie LLM validée par schéma ; aucune exécution de tool calling en V1

---

## 16. Performance et résilience

### Objectifs

- affichage initial < 2 s sur connexion correcte
- réponse API courante < 300 ms au 95e percentile
- passage à l'exercice suivant perçu comme instantané
- préchargement des 5 exercices suivants
- enregistrement d'une réponse avant navigation
- reprise de session après rechargement
- cache des fiches et SVG
- pagination des grandes listes
- index MariaDB sur les files de révision
- profilage séparé STT, LLM et TTS avant toute optimisation de conversation

### 16.1 Hors connexion (V1.1)

- téléchargement du pack N5 ou du niveau actif
- file locale temporaire
- synchronisation idempotente des réponses
- détection des conflits par UUID de réponse
- serveur comme source de vérité après synchronisation

---

## 17. Observabilité

- logs JSON structurés
- identifiant de requête
- erreurs frontend et backend
- métriques de latence
- nombre de réponses enregistrées
- taux d'échec du pipeline de contenu
- rapport de couverture par niveau
- rapport des exercices signalés
- **aucun contenu de mot de passe ou cookie dans les logs**

### Événements produit

```text
study_session_started
exercise_answered
exercise_failed
kanji_discovered
kanji_mastered
level_progress_changed
content_issue_reported
```
