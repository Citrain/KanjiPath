# ADR-011 - Mode zen pour etude concentree

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : presentation concentree des sessions d'etude

## Contexte

Les sessions contiennent volontairement feedback, navigation et progression. Certains
utilisateurs veulent toutefois reduire les distractions et se concentrer sur un seul
item sans modifier le moteur pedagogique.

## Decision

Le mode zen est une variante de presentation disponible dans les sessions d'etude,
d'ecriture et de shadowing. Il affiche une seule tache centrale, des controles essentiels
et une progression discrete. Les raccourcis, le feedback, les erreurs, l'aide et la
sortie restent accessibles. Il ne bloque aucune navigation de securite, ne force pas le
plein ecran navigateur et n'ajoute pas de score ou de minuterie punitive.

Le mode peut etre active pour une session ou memorise comme preference utilisateur. Il
ne change jamais la file, le bareme de correction, les logs, les cartes FSRS ou la
reprise. Les animations sont concises et entierement desactivees selon la preference de
mouvements reduits.

## Contraintes

- les informations necessaires pour comprendre ou corriger une reponse restent
  disponibles avant ou apres l'action ;
- sortie, pause et acces aux reglages sont toujours atteignables au clavier et au
  toucher ;
- aucun son ne demarre automatiquement ; les sons optionnels respectent le volume et
  les licences deja definies ;
- le contraste, les focus visibles et les cibles tactiles de 48 px sont conserves ;
- ce mode reste une couche UI : il ne duplique aucun composant de correction metier.

## Consequences d'implementation

L'implementation ajoute une preference utilisateur et un etat de session leger, avec
migration Prisma et contrat API si la preference doit etre synchronisee. Les composants
des sessions recoivent des variantes de mise en page partagees dans `packages/ui` ou les
features concernees, sans logique metier dans le CSS.

## Tests et criteres d'acceptation

- activer ou quitter le mode ne change pas l'item courant ni sa reponse ;
- la reprise de session conserve la progression quelle que soit la variante UI ;
- tous les controles essentiels sont utilisables au clavier, mobile et lecteur d'ecran ;
- les mouvements reduits eliminent les animations non indispensables ;
- les tests couvrent preference, interruption et rendu des etats de feedback.
