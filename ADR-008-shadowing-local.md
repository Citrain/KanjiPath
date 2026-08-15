# ADR-008 - Laboratoire de shadowing local et retour base sur transcription

- **Statut** : Accepte
- **Date** : 2026-08-15
- **Decisionnaires** : proprietaire du projet
- **Portee** : repetition orale de phrases et retour local explicable

## Contexte

L'audio publie et la conversation locale permettent d'entendre et de produire du
japonais. Il manque un exercice court ou l'utilisateur ecoute une phrase cible, la
repete puis compare son enonce a cette cible, sans confondre la reconnaissance vocale et
une expertise phonetique.

## Decision

Le laboratoire de shadowing reutilise les clips publies sous licence autorisee ou le
TTS japonais local. L'utilisateur ecoute une phrase, s'enregistre, puis recoit sa
transcription finale, une comparaison deterministe avec la lecture cible et des
segments a reecouter. Le frontend ne contacte jamais directement STT ou TTS : l'API
relaie les providers locaux definis par ADR-003.

Le resultat declare uniquement la correspondance entre transcript et cible. Il ne donne
ni note de prononciation, ni verdict sur l'accent, le rythme ou l'intonation : ces
proprietes ne sont pas etablies de maniere fiable par cette comparaison. L'utilisateur
peut recommencer sans consequence FSRS ; une future carte d'ecoute ou de production ne
pourra etre ajoutee qu'avec une regle de correction explicite et testee.

## Contraintes

- audio brut, buffers, transcription partielle et analyse intermediaire ne sont jamais
  persistants ; seule une transcription finale peut etre enregistree sur choix explicite
  de l'utilisateur ;
- STT, TTS et tout LLM eventuel restent lies a `127.0.0.1` et soumis aux limites de
  taille et de duree de l'ADR-003 ;
- les phrases publiees affichent leur attribution et respectent leurs conditions de
  licence ; aucun clip non licence explicitement n'est importe ;
- une indisponibilite STT laisse la phrase ecoutable et fournit un diagnostic, sans
  faux resultat ;
- toute difference est presentee comme une aide de transcript, jamais comme une erreur
  de prononciation certaine.

## Consequences d'implementation

Le module `conversation` reste l'unique passerelle vers les providers locaux. Les
contrats API distingueront cible, transcript final, resultat de comparaison et statut
technique. Une migration Prisma n'est requise que pour l'opt-in de conservation d'un
resultat final ; elle documentera retention et suppression des donnees utilisateur.

## Tests et criteres d'acceptation

- un enregistrement est traite uniquement en memoire jusqu'au resultat final ;
- la comparaison est deterministe et tolerante aux espaces et variations de kana
  documentees ;
- l'absence de STT ne produit pas de correction fictive ;
- micro, lecture et controles de repetition sont utilisables sur mobile et au clavier ;
- les tests couvrent confidentialite, indisponibilite provider et libelles pedagogiques.
