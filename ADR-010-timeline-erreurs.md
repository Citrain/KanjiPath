# ADR-010 - Timeline des erreurs et recommandations deterministes

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : diagnostic personnel des erreurs et acces a la revision ciblee

## Contexte

Les statistiques et points faibles indiquent deja des competences a travailler. Une vue
chronologique doit aider l'utilisateur a comprendre les erreurs recentes et recurrentes,
puis a lancer une action utile sans que l'application invente une explication.

## Decision

La timeline agrege les journaux de reponses, les confusions editoriales et les evenements
d'apprentissage deja persistants. Elle expose les erreurs recentes, les regroupements par
competence et les repetitions sur une fenetre temporelle explicite. Chaque regroupement
propose une revision ciblee avec les filtres existants, ou un lien vers la fiche
correspondante.

Les recommandations sont formulees depuis des seuils deterministes documentes, par
exemple une erreur repetee sur une meme competence dans une periode donnee. Aucun LLM ne
resume, n'interprete l'intention ou ne diagnostique le niveau de l'utilisateur. Les
donnees de conversation n'apparaissent que sous leur forme de correction deja acceptee
et uniquement pour leur proprietaire.

## Contraintes

- la timeline est strictement isolee par utilisateur et ne constitue pas un classement ;
- une absence de donnees affiche un etat vide pedagogique, pas une faiblesse supposee ;
- les notes, transcriptions et explications longues ne sont jamais exposes dans une vue
compacte sans action explicite ;
- les dates et seuils sont affiches pour rendre le diagnostic explicable ;
- les confusions viennent du contenu curate et ne sont pas deduites d'une similarite IA.

## Consequences d'implementation

L'API agreggera les `review_logs` et les donnees de progression avec index et pagination
adaptes ; une migration Prisma est obligatoire seulement si les index ou les evenements
existants ne couvrent pas les requetes. Le contrat API expose des categories et actions
structurees, jamais du texte de recommandation libre. Le frontend doit reutiliser les
liens profonds de revision ciblee.

## Tests et criteres d'acceptation

- un utilisateur ne peut lire aucun journal d'un autre utilisateur ;
- les regroupements respectent les fenetres et seuils declares ;
- chaque action ciblee reproduit les filtres affiches ;
- l'etat vide et les gros historiques restent performants et accessibles ;
- les tests couvrent autorisation, pagination et recommandations deterministes.
