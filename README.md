# SalleScope

**EPITA Smart Classroom** — *L’audit visuel de vos salles, en quelques secondes.*

SalleScope est une application web statique de détection et d’audit de salle de cours. Elle analyse une photo importée ou capturée, reconnaît localement certains équipements avec COCO-SSD puis, uniquement en mode audit configuré, les compare à une référence explicite.

## Fonctionnalités

- Import d’images JPEG, PNG et WebP, orientées par le décodeur du navigateur et limitées à 1600 px sur le grand côté avant analyse.
- Capture ponctuelle par caméra arrière, demandée idéalement en 1920 × 1080, sans microphone ni enregistrement vidéo.
- Détection réelle dans le navigateur avec boîtes, libellés français et scores de confiance.
- Détection libre par défaut, sans quantité fictive ni conclusion d’absence.
- Audit configuré optionnel avec référence vide, personnalisable ou exemple EPITA explicitement fictif.
- Capture et aperçu disponibles pendant le chargement du modèle, avec analyse automatique de la photo la plus récente.
- Suppression immédiate de toute prédiction `person` avant l’état, l’affichage et les calculs.
- Comptage des chaises, tables/bureaux, ordinateurs portables et écrans.
- Marquage honnête des tableaux et fenêtres comme non vérifiables.
- Configuration attendue et seuil de confiance de 25 à 85 % modifiables et mémorisés localement ; le seuil par défaut est 40 %.
- Réanalyse automatique et temporisée après modification du seuil, sans inférences concurrentes.
- Tableau de bord et comparaison calculés depuis les seuls résultats réels.
- Rapport complet imprimable ou enregistrable en PDF par le navigateur.
- Interface accessible et responsive de 375 px au grand écran.

## Technologies et coût

L’application utilise uniquement HTML, CSS, JavaScript ES modules et les API du navigateur. Les seules dépendances distantes, épinglées dans `index.html`, sont :

- `@tensorflow/tfjs@4.22.0`
- `@tensorflow-models/coco-ssd@2.2.3` avec `mobilenet_v2`

Il n’y a aucun backend, compte, secret, service payant, appel d’IA générative ou base de données. L’hébergement statique Cloudflare Pages et l’inférence locale permettent un usage sans coût additionnel.

## Architecture

La configuration des catégories est l’unique source de vérité, y compris pour l’exemple EPITA. Le service de modèle filtre les personnes avant de retourner ses données, sans supprimer les autres classes sûres. Le store sépare le mode, l’état du modèle, la disponibilité de la source et l’état d’analyse. Le coordinateur d’analyse conserve uniquement la source visuelle éphémère la plus récente, temporise les changements de seuil et protège contre les inférences dupliquées ou obsolètes. Le moteur d’audit pur utilise le mapping uniquement pour la comparaison configurée ; les autres objets sûrs restent visibles.

```text
SalleScope/
├── index.html
├── README.md
├── PROJECT.md
├── _headers
├── assets/{favicon.svg,README.md}
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── capture.css
│   ├── responsive.css
│   └── print.css
├── src/
│   ├── main.js
│   ├── config/{categories,coco-labels,defaults}.js
│   ├── state/store.js
│   ├── services/{model,camera,image,report}-service.js
│   ├── services/{analysis-coordinator,source-resolution}.js
│   ├── domain/audit-engine.js
│   ├── ui/{ui-controller,application-view,canvas-renderer,configuration-view,results-view,dashboard-view,audit-view}.js
│   └── utils/{dom,errors,formatting}.js
└── tests/
    ├── audit-engine.test.mjs
    ├── state-and-queue.test.mjs
    ├── source-pipeline.test.mjs
    └── model-privacy.test.mjs
```

## Lancement local

Les modules ES nécessitent un serveur HTTP local. Aucun `npm install` n’est requis.

```bash
python3 -m http.server 8080
```

Ouvrir ensuite `http://localhost:8080`. Pour exécuter les tests unitaires :

```bash
npm test
```

La caméra est autorisée sur `localhost`. Sur un autre domaine, `getUserMedia` exige HTTPS. Le microphone n’est jamais demandé.

## Déploiement Cloudflare Pages

1. Pousser ce dépôt sur GitHub.
2. Dans Cloudflare Pages, choisir **Create a project > Connect to Git**.
3. Sélectionner le dépôt et utiliser la branche principale.
4. Laisser la commande de build vide.
5. Définir le répertoire de sortie sur `/` (racine du dépôt).
6. Déployer, puis tester le chargement du modèle et la caméra sur l’URL HTTPS.

Les règles `_headers` désactivent explicitement le microphone et autorisent uniquement la caméra du même site. Aucun paramètre d’environnement n’est nécessaire.

**URL publique :** `À renseigner après le premier déploiement Cloudflare Pages.`

## Confidentialité

Les images, trames caméra, prédictions et résultats ne sont envoyés à aucune API. Les URL d’objet d’images importées sont révoquées après décodage. Les trames ne sont pas persistées. Seuls le seuil et les nombres attendus peuvent être enregistrés dans `localStorage`. Les pistes caméra sont arrêtées à l’arrêt, à la réinitialisation, après capture et à la fermeture de la page.

Une prédiction `person` éventuellement produite en mémoire par COCO-SSD est supprimée dans la portée locale de `model-service.js`. Elle n’est ni retournée, ni stockée, ni dessinée, ni comptée, ni journalisée, ni incluse dans le rapport.

## Limites connues

- COCO-SSD est généraliste et ne détecte ni tableaux ni fenêtres.
- `dining table` est une approximation des tables et bureaux de cours.
- `tv` est une approximation des écrans et moniteurs.
- Les objets petits, éloignés, partiellement masqués ou mal éclairés peuvent être manqués.
- Un seuil plus bas expose davantage de propositions, mais augmente aussi les faux positifs ; il n’améliore pas intrinsèquement le modèle.
- Un objet non détecté ne doit jamais être considéré comme absent sans contrôle humain.
- Le premier chargement du modèle requiert un accès réseau aux fichiers statiques de jsDelivr.

Le benchmark local du 16/10/2026 a mesuré environ 6,4 s de chargement et 1,6 s d’inférence moyenne pour `mobilenet_v2`, contre 2,0 s et 0,9 s pour `lite_mobilenet_v2`. Le modèle précis a retrouvé davantage de chaises et renforcé les scores du portable et du moniteur, mais n’a pas rendu les tables distantes fiables. Les fixtures, scores et limites mesurées sont consignés dans [PROJECT.md](./PROJECT.md).

## Compatibilité et tests manuels

Utiliser une version récente de Chrome, Edge, Firefox ou Safari avec JavaScript activé. Safari/iOS peut demander une interaction avant l’activation de la caméra. Vérifier au minimum : import avant et après disponibilité du modèle, remplacement d’une photo en attente, détection libre, audit configuré, exemple EPITA, seuil, refus caméra, présence d’une personne, largeurs 375/768/1440 px et aperçu avant impression. Le protocole exhaustif et les résultats sont dans [PROJECT.md](./PROJECT.md).
