# ADR-005 - Mission quotidienne composee et reprise

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : experience quotidienne transversale de revision et d'immersion

## Contexte

Les modes d'etude existants permettent de reviser, lire, ecouter et converser, mais
l'utilisateur doit choisir lui-meme un mode et construire sa seance. Une mission courte
et variee doit offrir un point d'entree quotidien sans remplacer les modes specialises.

## Decision

Une `mission quotidienne` est une seance guidee de 5 a 15 minutes qui compose, dans un
ordre pedagogique stable : les revisions FSRS dues, une consolidation de point faible,
un element de vocabulaire ou de contexte, puis une activite d'immersion disponible
(phrase audio, mini-texte ou conversation locale). Son contenu est selectionne par
l'application a partir du contenu publie et des donnees de progression ; aucun LLM ne
genere un exercice ou ne choisit le niveau.

La mission est materialisee au demarrage comme un snapshot personnel date et reprenable.
Elle reemploie les items et les regles de correction des modules existants. Une reponse
reste enregistree exactement comme dans son mode d'origine et met a jour FSRS seulement
lorsque cet item est une carte FSRS. Une activite de lecture ou de conversation reste
informative si elle ne porte pas de carte.

L'utilisateur peut ignorer, quitter ou terminer une etape sans perdre la mission. Les
revisions dues passent toujours avant les nouveaux contenus. Une charge de revisions
elevee reduit ou supprime les etapes de decouverte, conformement a la preference
`autoBalance`.

## Contraintes

- une mission ne doit jamais contourner `reviewLimit`, `kanaInputEnabled` ou les
  restrictions de contenu deja appliquees par les sessions d'etude ;
- une seule mission active est proposee par jour local de l'utilisateur ; une mission
  terminee reste consultable dans l'historique sans pouvoir etre corrigee une seconde
  fois ;
- le snapshot conserve les identifiants publies et la version de contenu, pas une copie
  libre d'un exercice ;
- l'etape conversation est optionnelle et reste disponible en texte si les providers
  locaux sont indisponibles ;
- la mission n'ajoute ni gamification punitive, ni score global qui masque les scores
  par competence.

## Consequences d'implementation

L'implementation ajoutera une migration Prisma pour les snapshots et leurs etapes, les
contrats API correspondants et une route de creation/reprise. La construction doit vivre
dans le module `study` ou un orchestrateur dedie, jamais dans le frontend. Les etapes
doivent etre rendues par les composants de leurs modules d'origine afin de conserver
accessibilite, correction et reprise.

## Tests et criteres d'acceptation

- une mission reprise presente les memes etapes non terminees ;
- la file respectera les revisions dues, les preferences et l'equilibrage de charge ;
- une indisponibilite de l'IA locale ne bloque pas une mission sans conversation ;
- chaque etape est utilisable au clavier, sur mobile et avec mouvements reduits ;
- les tests couvrent la selection deterministe, le snapshot et la reprise.
