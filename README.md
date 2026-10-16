# SalleScope

**EPITA Smart Classroom** — *L’audit visuel de vos salles, en quelques secondes.*

SalleScope est une application web statique de détection et d’audit de salle de cours. Elle analyse une photo importée ou capturée, reconnaît localement certains équipements avec COCO-SSD puis, uniquement en mode audit configuré, les compare à une référence explicite.

## Fonctionnalités

- Import d’images JPEG, PNG et WebP, orientées par le décodeur du navigateur et limitées à 1600 px sur le grand côté avant analyse.
- Capture ponctuelle par caméra arrière, demandée idéalement en 1920 × 1080, sans microphone ni enregistrement vidéo.
- Détection réelle dans le navigateur avec boîtes, libellés français et scores de confiance.
- Détection libre par défaut, sans quantité fictive ni conclusion d’absence.
- Audit configuré optionnel avec référence vide, personnalisable ou exemple EPITA explicitement fictif.
- Capture et aperçu disponibles pendant le chargement du modèle, avec coordination sérialisée « dernière image gagnante ».
- Remplacement possible avant, pendant ou après une analyse : identité immuable par source, résultat obsolète ignoré et rapport immédiatement invalidé.
- Réutilisation du même fichier grâce à la remise à zéro immédiate du sélecteur.
- Suppression immédiate de toute prédiction `person` avant l’état, l’affichage et les calculs.
- Comptage des chaises, tables/bureaux, ordinateurs portables et écrans.
- Marquage honnête des tableaux et fenêtres comme non vérifiables.
- Configuration attendue et seuil de confiance de 25 à 85 % modifiables et mémorisés localement ; le seuil par défaut est 40 %.
- Réanalyse automatique et temporisée après modification du seuil, sans inférences concurrentes.
- Tableau de bord et comparaison calculés depuis les seuls résultats réels.
- Rapport complet imprimable ou enregistrable en PDF par le navigateur.
- Interface accessible et responsive de 375 px au grand écran.

## Détecteur livré, coût et candidats évalués

L’application utilise uniquement HTML, CSS, JavaScript ES modules et les API du navigateur. Les seules dépendances distantes, épinglées dans `index.html`, sont :

- `@tensorflow/tfjs@4.22.0`
- `@tensorflow-models/coco-ssd@2.2.3` avec `mobilenet_v2`

Le seul détecteur livré est `COCO-SSD / mobilenet_v2`, au seuil initial de 0,40. Son manifeste et ses 17 fragments représentent 67 771 262 octets (environ 67,8 Mo décimaux). Il n’y a aucun backend, compte, secret, service payant, appel d’IA générative ou base de données.

DETR (`Xenova/detr-resnet-50`, q8 ≈ 43,1 Mo) et OWL-ViT (`Xenova/owlvit-base-patch32`, q8 ≈ 155 Mo hors tokenizer) ont été examinés comme candidats, mais ne sont pas livrés : le dépôt ne contient pas le corpus annoté autorisé permettant de mesurer leur exactitude sans fabriquer de résultats. Transformers.js n’est donc pas une dépendance de production. La décision, les révisions candidates, licences Apache-2.0 et images encore nécessaires sont détaillées dans [BENCHMARK.md](./BENCHMARK.md).

## Architecture

La configuration des catégories est l’unique source de vérité. L’adaptateur COCO normalise chaque résultat, puis le filtre de confidentialité supprime toute étiquette de personne avant l’état partagé. Le store conserve uniquement les métadonnées immuables de la source et de la requête courantes. Le coordinateur possède au plus une inférence active et une requête en attente ; toute nouvelle source, seuil ou sélection de détecteur remplace la requête en attente. Une écriture n’est acceptée que si `sourceId`, `sourceVersion` et `requestId` correspondent encore.

L’image d’inférence, l’aperçu et l’overlay sont trois surfaces distinctes. Une source remplacée ne peut donc ni recevoir d’anciennes boîtes ni réactiver un ancien rapport. Les ressources d’une tâche obsolète sont libérées après sa fin sûre.

```text
SalleScope/
├── index.html
├── README.md
├── PROJECT.md
├── BENCHMARK.md
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
│   ├── detection/{detector-registry,privacy-filter,prediction-normalizer}.js
│   ├── detection/adapters/coco-detector.js
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
    ├── model-privacy.test.mjs
    ├── latest-image-wins.test.mjs
    └── upload-lifecycle.test.mjs
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

Une prédiction dont l’étiquette est `person`, `human`, `student`, `teacher`, `face`, `man`, `woman`, `boy` ou `girl` est supprimée par `privacy-filter.js` juste après l’adaptateur. Elle n’est ni stockée, ni dessinée, ni comptée, ni journalisée, ni incluse dans le rapport.

## Limites connues

- COCO-SSD est généraliste et ne détecte ni tableaux ni fenêtres.
- `dining table` est une approximation des tables et bureaux de cours.
- `tv` est une approximation des écrans et moniteurs.
- Les objets petits, éloignés, partiellement masqués ou mal éclairés peuvent être manqués.
- Un seuil plus bas expose davantage de propositions, mais augmente aussi les faux positifs ; il n’améliore pas intrinsèquement le modèle.
- Un objet non détecté ne doit jamais être considéré comme absent sans contrôle humain.
- Le premier chargement du modèle requiert un accès réseau aux fichiers statiques de jsDelivr.

Le diagnostic local du 16/10/2026 a mesuré 5,8 à 6,4 s de chargement à froid et 1,626 s d’inférence moyenne sur quatre fixtures temporaires pour `mobilenet_v2`. Ces fixtures n’étant pas conservées avec annotations, aucune précision/rappel/F1 n’est revendiquée. Voir [BENCHMARK.md](./BENCHMARK.md).

## Compatibilité et tests manuels

Utiliser une version récente de Chrome, Edge, Firefox ou Safari avec JavaScript activé. WebGPU n’est pas requis par la version livrée. Safari/iOS peut demander une interaction avant la caméra. Le protocole Cloudflare et les résultats de remplacement/caméra sont dans [PROJECT.md](./PROJECT.md).
