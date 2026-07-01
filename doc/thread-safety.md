# Thread safety du backend DO Royal

Ce document explique comment le backend evite les bugs quand plusieurs joueurs font des actions en meme temps.

Dans ce projet, plusieurs threads peuvent executer du code Java en parallele. Par exemple :

- un joueur cree une partie ;
- un autre joueur rejoint la meme partie ;
- plusieurs joueurs bougent en meme temps ;
- un joueur tire pendant qu'un autre quitte la partie ;
- deux requetes HTTP arrivent en meme temps sur le compte ou la boutique.

La thread safety sert a eviter que ces actions simultanees cassent l'etat du serveur.

## Classes principales

Les classes qui gerent le plus la thread safety sont :

- `GameService`
- `GameSession`
- `PlayerService`
- `BroadcastService`
- `AccountService`
- `AccountRepository`

Les classes `GameService`, `PlayerService` et `BroadcastService` gerent surtout l'etat en memoire du jeu.

Les classes `AccountService` et `AccountRepository` gerent surtout l'etat durable dans PostgreSQL : comptes, pieces, skins et recompenses.

## `ConcurrentHashMap`

Une `ConcurrentHashMap` est une map prevue pour etre utilisee par plusieurs threads en meme temps.

Une `HashMap` classique n'est pas thread-safe. Si plusieurs threads lisent et ecrivent dedans en meme temps, elle peut se retrouver dans un etat incoherent.

Une `ConcurrentHashMap` protege sa structure interne. Elle permet donc :

- plusieurs lectures en parallele ;
- des ajouts pendant que d'autres threads lisent ;
- des suppressions sans casser la map ;
- certaines operations atomiques comme `putIfAbsent`.

## `GameService`

Classe :

```java
com.nmeo.services.impl.GameService
```

Cette classe gere les parties en cours.

Elle contient :

```java
private final Map<UUID, GameSession> sessions = new ConcurrentHashMap<>();
```

Cette map associe un identifiant de partie (`UUID`) a une `GameSession`.

Comme elle est en `ConcurrentHashMap`, plusieurs joueurs peuvent creer, lire ou supprimer des parties sans casser la structure de la map.

### Creation de partie

La creation d'une partie utilise :

```java
sessions.putIfAbsent(gameId, session)
```

Cette operation est atomique.

Atomique veut dire que l'operation se fait comme une seule action indivisible.

Donc si deux threads essaient de creer une partie avec le meme `gameId`, un seul thread reussit. L'autre voit que la partie existe deja et recoit une erreur.

Sans `putIfAbsent`, le code pourrait faire :

```java
if (!sessions.containsKey(gameId)) {
    sessions.put(gameId, session);
}
```

Ce serait moins sur, car deux threads pourraient passer le `containsKey` avant que l'un des deux fasse le `put`.

Avec `putIfAbsent`, le test et l'ajout sont faits ensemble.

### Suppression de partie vide

La suppression utilise :

```java
sessions.remove(gameId, session)
```

Cette forme de `remove` supprime seulement si la valeur actuelle est bien la session attendue.

C'est plus sur qu'un simple `remove(gameId)`, car on evite de supprimer une session qui aurait ete remplacee entre temps.

## `GameSession`

Classe :

```java
com.nmeo.models.GameSession
```

Cette classe represente l'etat d'une partie.

Elle contient notamment :

```java
private final Map<String, Player> players = new ConcurrentHashMap<>();
private final Map<String, Bullet> bullets = new ConcurrentHashMap<>();
```

Ces deux maps sont thread-safe.

Cela protege :

- l'ajout d'un joueur ;
- la suppression d'un joueur ;
- la mise a jour d'un joueur ;
- l'ajout d'une balle ;
- la suppression d'une balle.

Dans un jeu multijoueur, ces actions arrivent souvent en parallele.

Exemple :

- un joueur tire ;
- un autre joueur bouge ;
- un troisieme quitte la partie.

Grace aux `ConcurrentHashMap`, les collections `players` et `bullets` restent utilisables meme avec ces actions simultanees.

## `PlayerService`

Classe :

```java
com.nmeo.services.impl.PlayerService
```

Cette classe gere les joueurs dans les parties.

Elle contient :

```java
private final Map<UUID, PlayerRegistration> registrationsBySocket = new ConcurrentHashMap<>();
```

Cette map associe un socket WebSocket a un joueur et a une partie.

Elle sert a savoir quel joueur correspond a quelle connexion.

Cette map doit etre thread-safe parce que :

- un joueur peut rejoindre ;
- un joueur peut envoyer des mises a jour ;
- un joueur peut quitter ;
- le serveur peut broadcaster l'etat en meme temps.

### Ajout d'un joueur

Quand un joueur rejoint une partie, `PlayerService` recupere la `GameSession`, puis ajoute le joueur dans :

```java
session.getPlayers()
```

Cette map vient de `GameSession` et c'est une `ConcurrentHashMap`.

Le service enregistre aussi le lien entre le socket et le joueur :

```java
registrationsBySocket.put(socketUuid, new PlayerRegistration(gameId, player.getUuid()));
```

Comme `registrationsBySocket` est aussi une `ConcurrentHashMap`, cette operation est adaptee aux acces concurrents.

### Limite importante

La map est thread-safe, mais l'objet `Player` lui-meme est mutable.

Cela veut dire que plusieurs threads peuvent potentiellement modifier les champs du meme joueur.

Dans ce projet, la strategie est pragmatique :

- les maps sont protegees ;
- le serveur remplace souvent le joueur complet avec `players.put(...)` ;
- le gameplay temps reel accepte de petites incoherences temporaires.

Pour un systeme plus strict, on pourrait ajouter un verrou par partie ou rendre les objets `Player` immuables.

## `BroadcastService`

Classe :

```java
com.nmeo.services.BroadcastService
```

Cette classe gere les connexions WebSocket et l'envoi des messages aux joueurs.

Elle contient plusieurs maps concurrentes :

```java
private final Map<UUID, WsContext> sessionsBySocket = new ConcurrentHashMap<>();
private final Map<String, UUID> socketBySessionId = new ConcurrentHashMap<>();
private final Map<UUID, UUID> gameBySocket = new ConcurrentHashMap<>();
private final Map<UUID, Set<UUID>> socketsByGame = new ConcurrentHashMap<>();
```

Role de chaque map :

- `sessionsBySocket` : retrouve la connexion WebSocket a partir du socket UUID ;
- `socketBySessionId` : retrouve le socket UUID a partir de l'identifiant de session Javalin ;
- `gameBySocket` : sait dans quelle partie se trouve un socket ;
- `socketsByGame` : sait quels sockets sont connectes a une partie.

Ces structures sont modifiees quand un joueur rejoint, quitte ou change de partie.

### Set thread-safe

Pour stocker les sockets d'une partie, le code utilise :

```java
ConcurrentHashMap.newKeySet()
```

C'est important.

Une `ConcurrentHashMap` qui contient un `HashSet` classique ne serait pas suffisante, car le `HashSet` ne serait pas thread-safe.

Ici, le set lui-meme est compatible avec les acces concurrents.

## `AccountService`

Classe :

```java
com.nmeo.services.impl.AccountService
```

Cette classe gere les routes HTTP :

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`
- `GET /shop`
- `POST /shop/buy`

Elle ne fait plus directement toutes les requetes SQL.

Son role est surtout :

- lire la requete HTTP ;
- valider les donnees ;
- appeler `AccountRepository` ;
- renvoyer la reponse HTTP.

Ce decoupage rend le code plus lisible et plus facile a tester.

## `AccountRepository`

Classe :

```java
com.nmeo.services.account.AccountRepository
```

Cette classe gere les acces PostgreSQL.

Pour les comptes, la thread safety ne repose pas principalement sur `ConcurrentHashMap`. Elle repose surtout sur PostgreSQL, les transactions et les contraintes SQL.

### Creation de compte

La creation de compte est faite dans une transaction :

```java
connection.setAutoCommit(false);
insert account
grant skin
find account
connection.commit();
```

Le but est que la creation soit coherente.

Un compte cree doit aussi recevoir son skin de depart. La transaction permet de grouper ces operations.

La table `accounts` a aussi une contrainte unique sur `username` :

```sql
username text not null unique
```

Donc deux threads ne peuvent pas creer deux comptes avec le meme pseudo. Si deux requetes arrivent en meme temps, PostgreSQL en acceptera une et refusera l'autre.

### Achat de skin

L'achat de skin est une zone importante pour la thread safety.

Probleme possible :

1. Un compte a 600 pieces.
2. Deux requetes d'achat arrivent en meme temps.
3. Les deux voient 600 pieces.
4. Les deux depensent 600 pieces.

Pour eviter cela, le code utilise une requete SQL atomique :

```sql
update accounts
set coins = coins - ?
where id = ? and coins >= ?
```

Cette requete fait deux choses ensemble :

- verifier que le compte a assez de pieces ;
- retirer les pieces.

Comme PostgreSQL gere les verrous de lignes, deux achats concurrents ne peuvent pas depenser deux fois les memes pieces.

Si le premier achat retire les pieces, le deuxieme achat ne satisfait plus `coins >= ?` et ne retire rien.

### Recompenses de fin de partie

Les recompenses utilisent la table `account_rewards`.

La table a une cle primaire :

```sql
primary key(account_id, game_id)
```

Et l'insertion utilise :

```sql
on conflict do nothing
```

Cela rend l'operation idempotente.

Idempotente veut dire qu'on peut appeler l'operation plusieurs fois sans changer le resultat apres la premiere fois.

Exemple :

- un joueur doit recevoir 100 pieces pour un round ;
- deux threads essaient d'ajouter la meme recompense ;
- le premier insert reussit ;
- le deuxieme tombe sur le conflit `(account_id, game_id)` et ne fait rien.

Donc un compte ne recoit pas deux fois la meme recompense.

## `PasswordHasher`

Classe :

```java
com.nmeo.services.account.PasswordHasher
```

Cette classe gere le hash des mots de passe.

Elle n'est pas le coeur de la thread safety du gameplay, mais elle est importante pour le bouton de creation de compte.

Avant, le hash etait couteux avec beaucoup d'iterations PBKDF2. Cela ralentissait fortement la creation de compte.

Maintenant, le nombre d'iterations des nouveaux comptes est configurable avec :

```text
DO_ROYAL_PASSWORD_HASH_ITERATIONS
```

Le hash stocke le nombre d'iterations utilisees. Cela permet de verifier les anciens comptes et les nouveaux comptes correctement.

## Ce qui est bien protege

Le projet protege correctement :

- la map des parties ;
- les maps de joueurs et de balles ;
- les associations WebSocket ;
- les sets de sockets par partie ;
- la creation d'une partie avec un identifiant deja pris ;
- l'unicite des pseudos ;
- l'achat de skins avec les pieces ;
- les recompenses de fin de partie.

## Ce qui reste moins strict

Certaines parties sont thread-safe de maniere pragmatique, mais pas parfaitement verrouillees.

Exemples :

- `Player` est mutable ;
- `GameSession` contient des champs mutables comme le status, le gagnant, le round et l'owner ;
- certaines operations de gameplay font plusieurs etapes separees.

Cela veut dire que le serveur evite les gros problemes, comme les maps cassees ou l'argent duplique, mais il peut encore y avoir de petites incoherences temporaires dans l'etat de jeu.

Pour un jeu temps reel, ce compromis est souvent acceptable.

## Amelioration possible plus tard

Si on voulait rendre la thread safety plus stricte, on pourrait choisir une de ces strategies :

- ajouter un verrou par partie avec `synchronized` ou `ReentrantLock` ;
- utiliser une file d'evenements par partie ;
- rendre `Player` immutable ;
- centraliser toutes les modifications d'une partie dans un seul thread ;
- ajouter plus de tests concurrents.

Pour ce projet, la strategie actuelle est simple et adaptee :

- `ConcurrentHashMap` pour l'etat temps reel ;
- operations atomiques quand c'est necessaire ;
- transactions et contraintes PostgreSQL pour les donnees importantes.

