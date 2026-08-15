# ADR-004 - Quiz IA local a correction deterministe

- **Statut** : Accepte
- **Date** : 2026-08-13
- **Portee** : quiz personnels generes localement par Ollama

## Decision

`Quiz IA` est une exception limitee a l'interdiction des LLM pendant les exercices
d'ADR-001. Il sert a creer a la demande un quiz personnel a partir d'un sujet libre,
contenu, ne modifie pas le curriculum et ne planifie pas de carte FSRS.

Le frontend appelle exclusivement l'API. `AiQuizOrchestrator` construit un prompt explicite,
transmet a Ollama un mini-schema JSON atomique et valide strictement chaque sortie. Une seule
structure uniforme impose quatre choix pour tous les QCM, y compris l'ecoute. Le modele ne fournit
que `japanese`, `kana`, `options`, `answerIndex` et `explanationFr`. L'application planifie le type
et calcule le titre du quiz, les consignes, aides, tags, identifiants, competences, difficultes et
etapes avant de materialiser le snapshot.

L'application planifie d'abord les types, puis genere chaque question par un appel atomique dont le
schema ne contient meme pas `type`. Une question syntaxiquement ou semantiquement invalide peut
recevoir jusqu'a quatre generations strictement validees. Il n'existe ni extraction
partielle, ni renommage de champ, ni correction pedagogique heuristique. Une question encore
invalide apres quatre tentatives echoue sans creer de session. Une fois persiste, le snapshot est la seule source de
verite : les reponses sont corrigees localement, sans nouvel appel LLM.

Les formats generatifs actifs sont QCM de sens, lecture, texte a trou, conjugaison, replique de
dialogue, ecoute et comparaison de nuances. Les anciennes structures d'assemblage et d'association
restent lisibles dans les snapshots deja persistés, mais ne font plus partie du contrat de creation.
VOICEVOX peut synthetiser temporairement le texte d'une question d'ecoute ; aucun audio
n'est conserve. Les sessions et reponses sont des donnees utilisateur.

## Contraintes

- providers locaux lies a `127.0.0.1`, sans cloud ni tool calling ;
- l'IA ne fournit ni composants UI, ni identifiants, ni progression ;
- la cle de correction reste cote serveur et n'est jamais incluse dans le DTO public ;
- les exercices publies, le pipeline et FSRS restent deterministes ;
- une question QCM comporte exactement quatre choix distincts et une unique bonne reponse ;
- les exercices n'imposent jamais de saisie kana ou de production libre.
- tout texte japonais du snapshot est accompagne de sa lecture kana; elle est affichee au
  debutant mais ne participe jamais a la correction deterministe;
- un QCM de lecture est construit deterministement depuis les mots et lectures publies; sa lecture
  reste masquee dans l'interface jusqu'a la correction;
- un texte a trou ou une conjugaison contient obligatoirement `＿＿＿` dans le texte et sa lecture;
- les associations sont resolues par glisser-deposer de cartes, avec l'alternative
  selection puis depot au toucher et au clavier.
