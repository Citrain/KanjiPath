# ADR-006 - Carte visuelle des relations entre kanji

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : exploration visuelle des relations pedagogiques du contenu publie

## Contexte

Les fiches kanji exposent deja composants, confusions, vocabulaire et progression, mais
ces relations restent isolees. Une carte visuelle doit rendre les proximites utiles a
l'apprentissage sans devenir une decoration lourde ou une source de verite parallele.

## Decision

La carte affiche un sous-graphe centre sur un kanji choisi. Les noeuds sont des kanji du
contenu publie ; les liens ont un type explicite : composant partage, confusion visuelle,
mot partage ou voisin du parcours. La couleur et l'etat d'un noeud peuvent afficher la
progression personnelle, mais ne changent ni le curriculum ni le contenu editorial.

Le backend fournit une vue bornee autour du noeud central avec les relations deja
validees par le pipeline. Le navigateur calcule uniquement la disposition et les
interactions. La carte propose des filtres par type de lien, une liste textuelle
equivalente et une navigation vers les fiches. Elle ne nomme jamais automatiquement un
composant un "radical".

## Contraintes

- aucune relation n'est inferee au runtime par IA ou par similarite non verifiee ;
- les relations editoriales conservent leur provenance et leur version de contenu ;
- la taille de la reponse et le nombre de noeuds affiches sont bornes pour rester fluide
  sur mobile ;
- le canevas graphique n'est pas le seul moyen d'acceder a l'information : filtres,
  liste semantique, focus clavier et libelles accessibles sont obligatoires ;
- les couleurs d'etat ne sont jamais l'unique indicateur de progression.

## Consequences d'implementation

L'implementation etendra les contrats de contenu et ajoutera une route de sous-graphe
authentifiee. Les liens nouveaux devront etre modeles et valides par le pipeline avec une
migration Prisma si le schema de relations actuel ne suffit pas. La disposition client ne
doit pas persister ; seule la preference de filtres peut l'etre.

## Tests et criteres d'acceptation

- chaque lien retourne correspond a une relation publiee et typable ;
- les bornes de graphe sont respectees pour un kanji tres frequemment relie ;
- la vue liste offre les memes destinations que la carte ;
- les filtres, le clavier et le lecteur d'ecran restent utilisables ;
- les tests couvrent provenance, filtrage et etats de progression.
