# Thread safety du backend DO Royal

Ce document explique comment le backend DO Royal reste coherent quand plusieurs joueurs ou plusieurs requetes agissent en meme temps.

L'objectif n'est pas de bloquer tout le serveur avec un seul gros verrou. La strategie actuelle est plus fine :

- les parties differentes peuvent avancer en parallele ;
- les operations sensibles d'une meme partie sont protegees par un verrou propre a cette partie ;
- le registre WebSocket est modifie de facon coherente ;
- les mouvements des joueurs sont regroupes avant broadcast pour eviter de saturer la boucle serveur ;
- les objets mutables envoyes au frontend sont copies avant de sortir des sections protegees ;
- les donnees de compte sont protegees par PostgreSQL avec des transactions, des contraintes et des verrous SQL.

## Pourquoi la thread safety est necessaire

Le serveur peut recevoir plusieurs actions en meme temps :

- deux joueurs rejoignent la meme partie ;
- un joueur quitte pendant qu'un autre tire ;
- deux messages WebSocket mettent a jour le meme joueur ;
- deux broadcasts lisent l'etat pendant une modification ;
- deux clics arrivent presque en meme temps sur la boutique ;
- un compte est modifie pendant une autre requete HTTP.

Sans protection, le serveur peut produire des erreurs comme :

- deux proprietaires de partie ;
- un round qui demarre deux fois ;
- une recompense distribuee deux fois ;
- un achat de skin debite deux fois ;
- une liste de sockets incoherente ;
- une map Java corrompue ou lue pendant une modification.

## Vue globale de la strategie

La strategie de thread safety se decoupe en cinq zones.

### 1. Etat global des parties

Classe principale :

```java
com.nmeo.services.impl.GameService
```

`GameService` contient la map globale des parties :

```java
private final Map<UUID, GameSession> sessions = new ConcurrentHashMap<>();
```

Cette map est une `ConcurrentHashMap`, donc elle accepte les acces concurrents.

Elle protege la structure globale :

- ajouter une partie ;
- lire une partie ;
- supprimer une partie vide ;
- lister les parties.

La creation utilise `putIfAbsent`, ce qui rend la creation atomique :

```java
sessions.putIfAbsent(gameId, session)
```

Cela veut dire que deux threads ne peuvent pas creer deux parties avec le meme identifiant. Un seul gagne.

### 2. Etat interne d'une partie

Classe principale :

```java
com.nmeo.models.GameSession
```

Chaque `GameSession` possede son propre verrou :

```java
private final ReentrantReadWriteLock stateLock = new ReentrantReadWriteLock(true);
```

Ce verrou protege l'etat d'une seule partie. Il est cree en mode equitable (`true`) pour eviter qu'une rafale continue de lectures de broadcast affame les ecritures de gameplay.

Il y a deux types d'acces :

- `readState(...)` pour lire un etat coherent ;
- `writeState(...)` pour modifier l'etat de la partie.

Cela permet a deux parties differentes de fonctionner en parallele. Par exemple, une action dans la partie A ne bloque pas une action dans la partie B.

En revanche, deux modifications dans la meme partie sont ordonnees.

### 3. Snapshots et copies defensives

Classe principale :

```java
com.nmeo.services.impl.GameService
```

Le backend ne doit pas envoyer directement au frontend les objets `Player` stockes dans une partie.

`Player` est mutable. Si un thread WebSocket modifie un joueur pendant qu'un autre thread le serialise, le frontend peut recevoir un etat incoherent.

Pour eviter cela :

- `Player.copyOf(...)` cree une copie defensive ;
- `GameService.snapshotGameState(...)` lit l'etat d'une partie sous un seul `readState(...)` ;
- les broadcasts utilisent le snapshot, pas les objets internes.

### 4. Broadcast des mouvements

Classe principale :

```java
com.nmeo.services.MovementBroadcastService
```

Les mouvements des joueurs ne sont plus broadcastes immediatement a chaque message `PLAYER_MOVED`.

Le serveur garde uniquement le dernier mouvement recu par joueur et par partie, puis envoie un batch toutes les 50 ms.

Cela limite le nombre de broadcasts a une frequence controlee, meme si beaucoup de joueurs envoient des positions en meme temps.

### 5. Etat durable des comptes

Classes principales :

```java
com.nmeo.services.impl.AccountService
com.nmeo.services.account.AccountRepository
```

Pour les comptes, la thread safety repose surtout sur PostgreSQL :

- transactions SQL ;
- contraintes uniques ;
- cles primaires ;
- `on conflict do nothing` ;
- `select ... for update` pour verrouiller une ligne compte pendant un achat.

Java ne doit pas essayer de tout proteger en memoire, car les comptes sont stockes en base. La base de donnees est la source de verite.

## `GameSession` : verrou par partie

Classe :

```java
com.nmeo.models.GameSession
```

`GameSession` contient :

```java
private final Map<String, Player> players = new ConcurrentHashMap<>();
private final Map<String, Bullet> bullets = new ConcurrentHashMap<>();
private final ReentrantReadWriteLock stateLock = new ReentrantReadWriteLock(true);
```

Les maps `players` et `bullets` sont des `ConcurrentHashMap`. Elles protegent la structure des collections.

Le verrou `stateLock` protege les operations composees.

Une operation composee est une operation faite en plusieurs etapes. Exemple :

1. lire le statut de la partie ;
2. modifier les joueurs ;
3. changer le gagnant ;
4. changer le statut.

Une `ConcurrentHashMap` ne suffit pas pour proteger ce genre de sequence. Elle protege la map, mais elle ne garantit pas que toute la sequence soit atomique.

Pour cela, le code utilise :

```java
session.writeState(() -> {
    // modifications coherentes de la partie
});
```

Et pour lire un etat coherent :

```java
session.readState(() -> {
    // lecture de l'etat de la partie
});
```

## `GameService` : transitions de partie

Classe :

```java
com.nmeo.services.impl.GameService
```

`GameService` gere les transitions importantes :

- creation de partie ;
- changement de statut ;
- changement de round ;
- choix du proprietaire ;
- transfert du proprietaire ;
- ajout et suppression de balles ;
- detection de fin de partie.

Les operations qui modifient une partie utilisent maintenant `writeState`.

Exemples :

- `assignOwnerIfMissing(...)`
- `transferOwnerIfNeeded(...)`
- `updateGameStatus(...)`
- `addBullet(...)`
- `removeBullet(...)`
- `updateFinishedState(...)`

### Pourquoi c'est plus sur

Avant, une operation pouvait lire un statut, puis un autre thread pouvait modifier la partie avant la fin de l'operation.

Exemple :

1. Thread A voit que la partie est `PLAYING`.
2. Thread B termine la partie.
3. Thread A continue comme si la partie etait encore `PLAYING`.

Avec `writeState`, les modifications d'une meme partie sont ordonnees. Le thread B attend que le thread A ait fini, ou l'inverse.

### Pourquoi c'est encore rapide

Le verrou est dans `GameSession`, pas dans `GameService`.

Donc :

- partie A verrouille uniquement partie A ;
- partie B peut continuer en meme temps ;
- les lectures peuvent partager le read lock ;
- les ecritures sont courtes.

Cela evite un gros verrou global qui ralentirait tout le serveur.

### Snapshot de partie

Les broadcasts complets utilisent :

```java
snapshotGameState(UUID gameId)
```

Cette methode lit en une seule fois :

- le statut ;
- le gagnant ;
- l'owner ;
- les UUID des joueurs ;
- le numero de round ;
- les joueurs copies.

Le snapshot evite de prendre plusieurs read locks pour construire un seul message `GAME_STATE`.

## `PlayerService` : joueurs et sockets

Classe :

```java
com.nmeo.services.impl.PlayerService
```

`PlayerService` gere :

- l'ajout d'un joueur ;
- la mise a jour d'un joueur ;
- la suppression d'un joueur ;
- le lien entre un socket et un joueur ;
- la visibilite des joueurs.

Il contient :

```java
private final Map<UUID, PlayerRegistration> registrationsBySocket = new ConcurrentHashMap<>();
```

Cette map reste une `ConcurrentHashMap`, car plusieurs sockets peuvent rejoindre, envoyer des messages ou quitter en parallele.

Pour les operations sur les joueurs d'une partie, `PlayerService` utilise le verrou de la session :

```java
session.writeState(...)
session.readState(...)
```

### Creation de joueur

Quand un joueur rejoint, le service fait dans le meme verrou :

- verifier le statut de la partie ;
- mettre le joueur en spectateur si la partie a deja commence ;
- verifier que l'uuid du joueur n'existe pas deja ;
- ajouter le joueur ;
- definir l'owner si aucun owner n'existe.

Cela evite deux problemes :

- deux joueurs avec le meme uuid ;
- deux threads qui essaient de devenir owner en meme temps.

### Suppression de joueur

Quand un joueur quitte :

- le socket est retire de `registrationsBySocket` ;
- le joueur est retire de la partie ;
- si le joueur etait owner, un nouveau owner est choisi dans la meme section protegee.

Le transfert d'owner est donc coherent avec la suppression.

## `BroadcastService` : registre WebSocket

Classe :

```java
com.nmeo.services.BroadcastService
```

`BroadcastService` gere les connexions WebSocket.

Il contient plusieurs maps :

```java
private final Map<UUID, WsContext> sessionsBySocket = new ConcurrentHashMap<>();
private final Map<String, UUID> socketBySessionId = new ConcurrentHashMap<>();
private final Map<UUID, UUID> gameBySocket = new ConcurrentHashMap<>();
private final Map<UUID, Set<UUID>> socketsByGame = new ConcurrentHashMap<>();
```

Ces maps sont thread-safe individuellement.

Mais une inscription ou une desinscription modifie plusieurs maps en meme temps. Pour cela, `BroadcastService` utilise un verrou :

```java
private final ReentrantReadWriteLock registryLock = new ReentrantReadWriteLock();
```

### Inscription et desinscription

Les methodes suivantes utilisent le write lock :

- `registerPlayerSession(...)`
- `unregister(...)`

Cela garantit que les maps restent synchronisees entre elles.

Exemple : si un socket change de partie, il doit etre retire de l'ancien set et ajoute au nouveau set. Ces operations doivent etre coherentes.

### Broadcast

Les broadcasts ne gardent pas le verrou pendant l'envoi reseau.

Le service prend d'abord un snapshot :

```java
List.copyOf(sockets)
```

Puis il envoie les messages hors du verrou.

C'est important pour la performance. Un envoi WebSocket peut etre lent. On ne veut pas bloquer les connexions/deconnexions pendant tout l'envoi reseau.

## `MovementBroadcastService` : mouvements temps reel

Classe :

```java
com.nmeo.services.MovementBroadcastService
```

Les mouvements sont le flux le plus frequent du jeu.

Si chaque `PLAYER_MOVED` declenchait directement un broadcast, une partie a 25 joueurs pourrait produire trop d'envois :

- chaque joueur envoie plusieurs positions par seconde ;
- chaque position doit etre envoyee aux autres joueurs ;
- le serveur peut accumuler du retard si les messages arrivent plus vite que les sockets ne peuvent les vider.

La strategie actuelle est donc de coalescer les mouvements.

### Fonctionnement

Quand le serveur recoit un `PLAYER_MOVED` vivant :

1. `SocketHandler` met a jour le joueur dans `PlayerService` ;
2. `SocketHandler` appelle `MovementBroadcastService.queuePlayerMove(...)` ;
3. le service stocke une copie du dernier etat du joueur dans une `ConcurrentHashMap` par partie ;
4. toutes les 50 ms, le scheduler envoie un seul message `PLAYER_MOVED` contenant `players`.

Si un joueur envoie plusieurs positions entre deux ticks serveur, seule la derniere est gardee. C'est volontaire : pour l'affichage temps reel, l'etat le plus recent est plus utile qu'une file de positions en retard.

### Thread safety

`MovementBroadcastService` utilise :

```java
Map<UUID, Map<String, Player>> pendingPlayersByGame = new ConcurrentHashMap<>();
```

La premiere cle est l'UUID de partie. La deuxieme cle est l'UUID du joueur.

Chaque insertion remplace le dernier mouvement du joueur par une copie defensive :

```java
Player.copyOf(player)
```

Le scheduler vide les mouvements avec `remove(key, value)`, ce qui evite de supprimer un mouvement plus recent ajoute pendant le flush.

### Pourquoi c'est plus performant

Avec cette strategie, une partie ne broadcast pas immediatement a chaque input joueur.

Le serveur regroupe les mouvements et controle la frequence de sortie :

- le client envoie jusqu'a 20 updates par seconde ;
- le serveur flush les mouvements toutes les 50 ms ;
- les mouvements d'un meme joueur sont coalesces ;
- le message envoye contient un batch de joueurs au lieu d'un message par joueur.

Cette architecture est beaucoup plus stable pour une partie jusqu'a 25 joueurs.

## `AccountRepository` : comptes, pieces et skins

Classe :

```java
com.nmeo.services.account.AccountRepository
```

Cette classe gere les requetes SQL.

### Creation de compte

La creation de compte est transactionnelle :

1. creer le compte ;
2. donner le skin de depart ;
3. relire le compte ;
4. commit.

La table `accounts` a une contrainte unique :

```sql
username text not null unique
```

Donc deux requetes concurrentes ne peuvent pas creer le meme pseudo.

### Suppression de compte

La suppression passe par :

```java
delete from accounts where id = ?
```

Les tables liees utilisent `on delete cascade`.

Cela veut dire que PostgreSQL supprime aussi les lignes liees au compte, par exemple :

- skins possedes ;
- recompenses deja donnees.

### Achat de skin

L'achat de skin est une operation sensible, car elle touche l'argent du compte.

La strategie actuelle :

1. ouvrir une transaction ;
2. verrouiller la ligne du compte avec `select coins from accounts where id = ? for update` ;
3. verifier que le compte a assez de pieces ;
4. inserer le skin avec `on conflict do nothing` ;
5. debiter les pieces seulement si le skin a vraiment ete ajoute ;
6. commit.

Cela evite deux bugs importants :

- deux achats paralleles ne peuvent pas depenser les memes pieces ;
- acheter deux fois le meme skin ne debite pas deux fois.

### Recompenses de fin de partie

Les recompenses utilisent une cle primaire :

```sql
primary key(account_id, game_id)
```

L'insertion utilise :

```sql
on conflict do nothing
```

Donc si la meme recompense est tentee deux fois, une seule est acceptee.

C'est ce qu'on appelle une operation idempotente.

Les recompenses lisent aussi un snapshot de la partie avant d'attribuer les pieces. Cela evite de parcourir directement les objets `Player` internes pendant qu'un autre thread modifie la partie.

## Tests de concurrence

Les tests de concurrence sont dans :

```java
com.nmeo.services.GameServiceTest
```

Ils verifient notamment :

- que deux threads qui appellent la fin de partie ne declenchent la recompense qu'une seule fois ;
- que deux creations concurrentes avec le meme player uuid ne creent qu'un seul joueur ;
- que les snapshots de partie renvoient des copies de joueurs ;
- que les joueurs visibles renvoyes au frontend sont copies ;
- que les batches de mouvement ne gardent pas de references directes vers les joueurs mutables.

Ces tests ne prouvent pas tous les cas possibles, mais ils couvrent les races les plus dangereuses du gameplay.

## Ce que la strategie garantit

La strategie actuelle garantit :

- pas de corruption des maps globales ;
- pas de doublon de partie avec le meme UUID ;
- transitions de partie coherentes par `GameSession` ;
- owner coherent pendant les joins/leaves ;
- fin de partie declenchee une seule fois ;
- registre WebSocket coherent ;
- broadcasts sans verrou long ;
- mouvements regroupes par tick serveur ;
- objets envoyes au frontend copies avant sortie des verrous ;
- achats de skin atomiques ;
- recompenses idempotentes ;
- suppression de compte propre via cascade SQL.

## Limites restantes

La strategie est solide pour ce projet, mais elle n'est pas une architecture temps reel parfaite.

Limites connues :

- `Player` reste un objet mutable ;
- il n'y a pas encore de boucle d'evenements unique par partie ;
- il n'y a pas encore de test de charge automatise a 25 vrais sockets ;
- les balles et le chat restent envoyes immediatement, car ce sont des evenements ponctuels.

Pour aller encore plus loin, on pourrait :

- rendre `Player` immutable ;
- utiliser une queue d'evenements par partie ;
- ajouter des tests de charge avec beaucoup de sockets ;
- mesurer la latence des locks sous stress.

## Resume simple

La strategie actuelle est :

- `ConcurrentHashMap` pour les collections partagees ;
- `ReentrantReadWriteLock(true)` par partie pour les transitions de gameplay ;
- `ReentrantReadWriteLock` sur le registre WebSocket pour garder les maps synchronisees ;
- snapshots et copies defensives avant broadcast ;
- batching des mouvements toutes les 50 ms ;
- transactions et verrous PostgreSQL pour les comptes, pieces, skins et recompenses ;
- aucun gros verrou global, pour garder l'application rapide.
