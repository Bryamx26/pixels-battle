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

Les touches sont lues par position physique (`KeyboardEvent.code`) et se reconfigurent dans
`src/client/input/keyboard.ts` (`DEFAULT_BINDINGS` et `MOUSE_BINDINGS`). La visée souris est
encodée dans les entrées envoyées au serveur (256 directions), le serveur reste autoritaire.

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
- **Objets** : des shurikens apparaissent régulièrement dans l'arène (2 objets max en jeu). On en ramasse un en passant dessus, **un seul à la fois**. Lancé vers le curseur, il inflige dégâts et éjection (bloqué par la garde), puis retombe là où il a touché : il faut aller le rechercher.
- **Personnages** : Kaze (équilibré, mobile) et Tetsu (lourd, plus lent, frappe plus fort).
- **Arènes** : Temple Céleste, Forge Jumelle, Ruines Flottantes.
- **Modes** : 1v1, 2v2, chacun pour soi (jusqu'à 4).

## Architecture

```
src/
  shared/              code exécuté à la fois par le serveur et le navigateur
    engine/            World (tick de simulation), règles (vies, victoire, modes), événements, buffer d'entrées
    physics/           intégration + collisions plateformes (solides / traversables)
    characters/        état d'un combattant, machine à états (controller), définitions Kaze / Tetsu
    combat/            attaques data-driven, hitbox, garde / parade, résolution des coups
    grapple/           kunai (vol, accroche, zip) et accroche d'ennemis (traction)
    items/             classe ItemType (comportement d'un objet), Shuriken, système d'objets (apparition, ramassage, lancer, impact)
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
    render/            rendu pixel art procédural (décor, personnages, effets, police bitmap, caméra)
    ui/                écrans (menu, salon, résultats, pause) et HUD
```

### Réseau

- **Serveur autoritaire** à 60 ticks/s : il reçoit uniquement les boutons de chaque joueur, simule tout (déplacements, coups, kunai, collisions, KO) et envoie un snapshot complet 30 fois/s.
- **Prédiction côté client** : le joueur local applique ses entrées immédiatement avec la même fonction `stepFighter` que le serveur ; à chaque snapshot il repart de l'état serveur et rejoue ses entrées non acquittées (réconciliation lissée).
- **Interpolation** : les autres joueurs sont affichés avec ~100 ms de retard, interpolés entre deux snapshots. Les effets (impacts, KO) sont synchronisés sur ce retard.
- **Reconnexion** : chaque onglet garde un token ; en cas de coupure (ou rechargement), le joueur reprend sa place pendant 30 s. Passé ce délai, il est retiré (éliminé si un combat est en cours).

### Ajouter du contenu

- **Personnage** : copier `src/shared/characters/kaze.ts`, ajuster les stats / attaques / couleurs, l'ajouter dans `characters/index.ts`.
- **Arène** : copier `src/shared/arenas/skyTemple.ts`, définir plateformes, anneaux, spawns, couleurs, l'ajouter dans `arenas/index.ts`.
- **Objet** : créer une sous-classe de `ItemType` (voir `src/shared/items/shuriken.ts`) en définissant dégâts, éjection, vitesse, gravité ; surcharger `launch` / `fly` pour un comportement spécial ; l'ajouter dans `items/index.ts`.
- **Mode** : `MODES` et `teamForSlot` dans `src/shared/engine/rules.ts`.
