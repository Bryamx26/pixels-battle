# Pixels Battle

Platform fighter 2D en pixel art, jouable dans le navigateur, multijoueur en temps réel.
Mécanique centrale : un **kunai-grappin** qui accroche les ennemis (et les ramène vers soi)
ou les plateformes (pour se déplacer et revenir sur l'arène).

## Lancer le jeu

Prérequis : Node.js 20+.

```bash
npm install
npm start          # compile le client puis lance le serveur sur http://localhost:3000
```

- Ouvrir `http://localhost:3000`, **Créer une partie** → un code s'affiche.
- Dans un autre navigateur / onglet / PC du réseau local : saisir le code (ou ouvrir le lien partagé) → **Rejoindre**.
- L'hôte clique **Lancer le combat**.
- **Entraînement solo** : contre un CPU ou un mannequin, sans serveur de jeu.

Pour jouer avec quelqu'un hors de ton réseau, il faut héberger le serveur (Render, Fly.io, un VPS…)
ou l'exposer temporairement (ex. `cloudflared tunnel --url http://localhost:3000`). Le port se règle avec `PORT=8080 npm start`.

### Avec Docker

```bash
docker compose up -d --build     # http://localhost:3000
# ou sans compose :
docker build -t pixels-battle .
docker run -d -p 3000:3000 --name pixels-battle pixels-battle
```

L'image (Node 22 Alpine, ~65 Mo compressée) contient le client compilé et le serveur, tourne en
utilisateur non root et expose un healthcheck HTTP. Pour changer le port interne : `-e PORT=8080 -p 8080:8080`.
Derrière un reverse proxy HTTPS (Caddy, Nginx, Traefik), penser à transmettre les WebSockets sur `/ws`.

Développement avec rechargement à chaud : `npm run dev` (client Vite sur :5173, serveur sur :3000).
Tests de la simulation : `npm test`. Vérification des types : `npm run typecheck`.

## Contrôles

| Entrée | Action |
|---|---|
| A / D (Q / D en AZERTY), ← → | Déplacement |
| Espace (ou W / ↑) | Saut, double saut · pendant le grappin : lâcher en gardant l'élan |
| S, ↓ | Chute rapide · traverser une plateforme fine |
| Clic gauche (ou J) | Attaque rapide (chaîne jusqu'à 3) |
| K | Coup de pied (attaque moyenne) |
| Clic droit | Kunai-grappin vers le curseur |
| F ou clic molette | Lancer l'objet tenu vers le curseur |
| Shift | Garde (levée au bon moment = parade) |
| E | Dash / esquive (sol et air, invulnérable au début) |
| Échap | Pause / quitter |

**Réglage des touches** : bouton **Commandes** dans le menu ou la pause. Chaque action accepte plusieurs
entrées (clavier, souris ou manette) : « + » puis appuyer sur la touche voulue, clic sur une entrée pour la
retirer. Les réglages sont gardés dans le navigateur. Les touches sont lues par position physique
(`KeyboardEvent.code`) ; sur Chrome/Edge l'écran affiche la vraie lettre de ta disposition (Q en AZERTY).

**Manette** (disposition standard Xbox/PlayStation) : stick gauche ou croix pour bouger, A / Croix ↑ saut,
X attaque rapide, B coup de pied, RT grappin, Y lancer l'objet, LT garde, RB / LB dash, Start pause.
La visée suit le stick droit (sinon le stick gauche) ; dès qu'on touche la manette le curseur souris disparaît.

La visée (souris ou stick) est encodée dans les entrées envoyées au serveur (256 directions), le serveur reste autoritaire.

## Gameplay

- **Dégâts en %** : plus le pourcentage monte, plus l'éjection est forte. Sortir des limites de l'arène = une vie perdue (3 vies). Dernière équipe en vie = victoire.
- **Attaques** : rapide au clic gauche (faible, enchaînable) et coup de pied (portée, fente). Pas d'attaque lourde.
- **Combos** : après un coup réussi on peut annuler dans une autre attaque (rapide→rapide→rapide, rapide→pied, pied→rapide), dans le grappin ou dans un saut. Une attaque enchaînée démarre 40 % plus vite.
- **Garde** : jauge qui se vide en la maintenant et en bloquant ; à zéro, garde brisée (étourdi). Levée juste avant le coup = **parade** : l'attaquant est étourdi.
- **Grappin** (clic droit, visé à la souris, portée limitée, temps de recharge ~1 s) :
  - sur un **ennemi** : petits dégâts, il est tiré vers toi puis reste brièvement étourdi → enchaîne ;
  - sur une **plateforme** : tu es hissé sur son bord (récupération) ;
  - sur un **anneau** : tu es tiré vers lui (anneaux placés hors de l'arène pour revenir) ;
  - pendant la traction : Espace lâche la chaîne en gardant toute l'inertie, une attaque l'annule en gardant la vitesse ;
  - bloqué par la garde.
- **Objets** : des objets apparaissent régulièrement dans l'arène (2 max en jeu). On en ramasse un en passant dessus, **un seul à la fois**, et on le lance vers le curseur :
  - **Shuriken** : trajectoire droite et rapide ; retombe là où il a touché, il faut aller le rechercher.
  - **Bombe** : lancer en cloche, explose au contact (adversaire ou sol) ou au bout de 1,4 s ; dégâts de zone, sans toucher le lanceur ni ses alliés.
  - **Épée** : tant qu'on la tient, les attaques ont plus d'allonge (+12 px), +4 dégâts et plus d'éjection ; elle se brise après 6 coups portés. On peut aussi la lancer.
- **Revanche** : à la fin du combat, le bouton **Revanche** relance la même partie (mêmes réglages) dès que tous les joueurs connectés ont voté ; « Retour au salon » reste possible.
- **Personnages** : Kaze (tenue jaune) et Mizu (identique, tenue bleue), animés à partir de la planche de sprites `tools/sprites/ninja-sheet.png`.
- **Arènes** : Temple Céleste, Forge Jumelle, Ruines Flottantes.
- **Modes** : 1v1, 2v2, chacun pour soi (jusqu'à 4).

## Architecture

```
src/
  shared/              code exécuté à la fois par le serveur et le navigateur
    engine/            World (tick de simulation), règles (vies, victoire, modes), événements, buffer d'entrées
    physics/           intégration + collisions plateformes (solides / traversables)
    characters/        état d'un combattant, machine à états (controller), définitions Kaze / Mizu
    combat/            attaques data-driven, hitbox, garde / parade, résolution des coups
    grapple/           kunai (vol, accroche, zip) et accroche d'ennemis (traction)
    items/             classe ItemType (comportement d'un objet), Shuriken, Bombe, Épée, système d'objets (apparition, ramassage, lancer, impact)
    arenas/            une arène = un fichier de données (plateformes, anneaux, points d'apparition des objets)
    ai/                bot d'entraînement
    net/protocol.ts    messages client ↔ serveur
  server/
    rooms/             sessions (token de reconnexion), salles à code, gestionnaire de salles
    net/               WebSocket, boucle 60 Hz, fichiers statiques
  client/
    net/               connexion (reconnexion auto), OnlineMatch (prédiction + interpolation)
    game/              interface MatchSource, partie locale d'entraînement
    engine/            boucle à pas fixe
    input/             clavier → boutons
    render/            rendu pixel art (sprites des personnages, décor procédural, effets, police bitmap, caméra)
    assets/            atlas de sprites générés (ninja-jaune.png, ninja-bleu.png)
    ui/                écrans (menu, salon, résultats, pause) et HUD
```

### Réseau

- **Serveur autoritaire** à 60 ticks/s : il reçoit uniquement les boutons de chaque joueur, simule tout (déplacements, coups, kunai, collisions, KO) et envoie un snapshot complet 30 fois/s.
- **Prédiction côté client** : le joueur local applique ses entrées immédiatement avec la même fonction `stepFighter` que le serveur ; à chaque snapshot il repart de l'état serveur et rejoue ses entrées non acquittées (réconciliation lissée).
- **Interpolation** : les autres joueurs sont affichés avec ~100 ms de retard, interpolés entre deux snapshots. Les effets (impacts, KO) sont synchronisés sur ce retard.
- **Reconnexion** : chaque onglet garde un token ; en cas de coupure (ou rechargement), le joueur reprend sa place pendant 30 s. Passé ce délai, il est retiré (éliminé si un combat est en cours).

### Ajouter du contenu

- **Personnage** : copier `src/shared/characters/kaze.ts`, ajuster les stats / attaques, l'ajouter dans `characters/index.ts`. `look.sprite` choisit la planche de sprites (sinon rendu procédural).
- **Sprites** : `python3 tools/sprites/extract.py` (pillow, numpy, scipy) découpe `tools/sprites/ninja-sheet.png`, nettoie la palette et régénère les atlas jaune/bleu et `src/client/render/sprites/ninjaAtlas.ts`. Pour une nouvelle couleur, ajouter une fonction de recoloration comme `to_blue`.
- **Arène** : copier `src/shared/arenas/skyTemple.ts`, définir plateformes, anneaux, spawns, couleurs, l'ajouter dans `arenas/index.ts`.
- **Objet** : créer une sous-classe de `ItemType` (voir `src/shared/items/shuriken.ts`) en définissant dégâts, éjection, vitesse, gravité ; surcharger `launch` / `fly` pour un comportement spécial, ou renseigner `explosion` (dégâts de zone) / `melee` (bonus tenu en main) ; l'ajouter dans `items/index.ts`.
- **Mode** : `MODES` et `teamForSlot` dans `src/shared/engine/rules.ts`.
