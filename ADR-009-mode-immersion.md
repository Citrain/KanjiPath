# ADR-009 - Mode immersion a aides progressives

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : affichage adapte des aides de lecture et de traduction

## Contexte

Furigana, romaji et traduction rendent le contenu abordable, mais leur affichage constant
peut empecher la lecture autonome. Les preferences actuelles doivent pouvoir devenir une
experience d'immersion graduelle sans imposer un niveau de difficulte irreversible.

## Decision

Le mode immersion est une preference d'affichage disponible dans la lecture, les fiches,
les exercices et la conversation lorsque le support le permet. Il masque par defaut les
aides configurees (traduction, romaji, furigana), puis les revele localement a la demande
sans changer la reponse attendue, la correction ou les donnees pedagogiques.

Le niveau d'aide recommande est calcule de maniere explicable depuis les preferences et
la progression existantes ; il est toujours remplacable par l'utilisateur dans la seance.
Un debutant peut ainsi revenir immediatement a l'affichage complet. Ce mode ne deduit pas
qu'un kanji est maitrise et ne modifie aucune carte FSRS.

## Contraintes

- aucun contenu indispensable a la comprehension d'une action ou a l'accessibilite ne
  peut etre masque sans un controle de revelation evident ;
- les enonces et choix d'exercice ne doivent pas exposer involontairement la reponse ;
- la preference est par utilisateur, synchronisee via l'API et appliquee sans flash
  d'affichage entre pages ;
- les lecteurs d'ecran recoivent une action explicite pour reveler une aide masquee ;
- le mode ne remplace pas les reglages fins existants et ne force pas le romaji cache.

## Consequences d'implementation

L'implementation etendra les preferences utilisateur, contrats et migration Prisma si
la granularite actuelle ne suffit pas. Les composants japonais partages doivent recevoir
un modele d'affichage commun afin que lecture, exercices et conversation appliquent la
meme semantique de revelation.

## Tests et criteres d'acceptation

- le choix utilisateur persiste et s'applique dans les ecrans pris en charge ;
- chaque aide cachee est revelable au toucher, clavier et lecteur d'ecran ;
- changer l'aide ne modifie ni correction ni progression ;
- les exercices conservent la confidentialite de leur reponse ;
- les tests couvrent les niveaux d'aide, la persistence et les tailles mobile.
