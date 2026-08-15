# ADR-007 - Carnet de vocabulaire personnel et revision FSRS

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : sauvegarde personnelle de mots rencontres et revision separee

## Contexte

Un mot rencontre dans une phrase, un mini-texte ou une conversation est souvent plus
utile lorsqu'il est conserve avec son contexte. Le curriculum publie ne doit cependant
pas etre modifie par les choix personnels, ni recevoir de contenu non source.

## Decision

Un utilisateur peut enregistrer un mot depuis un contenu publie ou un de ses propres
tours de conversation. Une entree conserve la surface, la lecture, le sens affiche, le
contexte court, son origine et sa date. Lorsqu'elle vient du contenu publie, elle garde
la reference et la version de cet element ; lorsqu'elle vient d'une conversation, elle
est une donnee utilisateur et n'entre jamais dans le pipeline publie.

Le carnet dispose de cartes FSRS personnelles independantes des cartes kanji. Ses
exercices sont deterministes : rappel du sens, reconnaissance de la lecture ou
auto-evaluation explicite selon les donnees disponibles. La reponse ne modifie jamais
la maitrise d'un kanji du curriculum. Les entrees peuvent etre archivees ou supprimees
par l'utilisateur avec leurs cartes et journaux associes.

## Contraintes

- l'interface ne permet pas de publier, partager ou transformer une entree personnelle
  en contenu officiel ;
- aucune traduction, lecture ou exemple n'est invente par un LLM au moment de la
  sauvegarde ;
- un mot issu d'une conversation ne doit pas exposer le transcript d'un autre utilisateur ;
- la suppression est explicite et supprime les donnees personnelles associees ;
- les extraits affiches restent courts et les contenus sources conservent attribution et
  licence quand elles sont affichees hors de leur fiche d'origine.

## Consequences d'implementation

L'implementation ajoutera une migration Prisma pour les entrees, leurs sources et leurs
cartes/journaux personnels, ainsi que les schemas Zod et routes API. Le domaine expose
un scheduler FSRS dedie ou parametrable afin de ne pas melanger les identifiants et les
scores des cartes de curriculum. Le bouton d'enregistrement est reutilisable dans la
lecture, le lookup et la conversation.

## Tests et criteres d'acceptation

- un mot enregistre depuis un texte conserve une reference et une version publiees ;
- une revision du carnet ne modifie aucun score de maitrise kanji ;
- une entree conversationnelle reste privee et supprimable ;
- l'archivage exclut l'entree des nouvelles files sans effacer son historique ;
- les tests couvrent deduplication, suppression et planification FSRS isolee.
