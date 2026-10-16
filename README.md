# SalleScope

**EPITA Smart Classroom** — *L’audit visuel et sonore de vos salles, sur l’appareil.*

SalleScope est une application web statique d’audit multimodal de salle de cours. Elle analyse une photo avec COCO-SSD ou classe volontairement de courtes fenêtres sonores avec YAMNet, entièrement dans le navigateur. L’image et le son brut ne sont ni enregistrés ni envoyés.

## Fonctionnalités

- Import d’images JPEG, PNG et WebP, orientées par le décodeur du navigateur et limitées à 1600 px sur le grand côté avant analyse.
- Capture ponctuelle par caméra arrière, demandée idéalement en 1920 × 1080, sans microphone ni enregistrement vidéo.
- Détection réelle dans le navigateur avec boîtes, libellés français et scores de confiance.
- Analyse sonore explicite et séparée avec YAMNet float32 v1 dans un Web Worker, sans transcription ni identification vocale.
- Catégories normalisées : parole/conversation, applaudissements, musique, alarme ou sirène (dont ambulance), porte ou coup, clavier/saisie, écriture, ambiance calme et bruit ambiant.
- Lissage sur deux fenêtres consécutives, seuil sonore indépendant et arrêt immédiat des pistes au changement de source ou à la réinitialisation.
- Diagnostic local des dimensions, réduction, luminosité, exposition, contraste et netteté probable, sans correction automatique.
- Contrat compatible boîte, masque, polygone et boîte orientée. COCO-SSD produit actuellement de vraies boîtes seulement ; aucune géométrie n’est inventée.
- Détection libre par défaut, sans quantité fictive ni conclusion d’absence.
- Audit configuré optionnel avec référence vide, personnalisable ou exemple EPITA explicitement fictif.
- Capture et aperçu disponibles pendant le chargement du modèle, avec coordination sérialisée « dernière image gagnante ».
- Remplacement possible avant, pendant ou après une analyse : identité immuable par source, résultat obsolète ignoré et rapport immédiatement invalidé.
- Réutilisation du même fichier grâce à la remise à zéro immédiate du sélecteur.
- Suppression immédiate de toute prédiction `person` avant l’état, l’affichage et les calculs.
- Comptage des chaises, tables/bureaux, ordinateurs portables et écrans.
- Marquage honnête des tableaux et fenêtres comme non vérifiables.
- Configuration attendue et seuil visuel de 10 à 85 % modifiables et mémorisés localement ; le seuil par défaut est 30 %. La migration v2 conserve les valeurs personnalisées et remplace l’ancien défaut intact de 40 %.
- Réanalyse automatique et temporisée après modification du seuil, sans inférences concurrentes.
- Tableau de bord et comparaison calculés depuis les seuls résultats réels.
- Rapport complet imprimable ou enregistrable en PDF par le navigateur.
- Interface accessible et responsive de 375 px au grand écran.

## Détecteur livré, coût et candidats évalués

L’application utilise uniquement HTML, CSS, JavaScript ES modules et les API du navigateur. Les dépendances distantes sont épinglées :

- `@tensorflow/tfjs@4.22.0`
- `@tensorflow-models/coco-ssd@2.2.3` avec `mobilenet_v2`
- `@mediapipe/tasks-audio@1.1.0`, chargé à la demande dans le worker
- YAMNet float32 v1 officiel MediaPipe (4 126 810 octets)

Le seul détecteur visuel livré est `COCO-SSD / mobilenet_v2`, au seuil initial de 0,30. Son manifeste et ses 17 fragments représentent 67 771 262 octets (environ 67,8 Mo décimaux). Il n’y a aucun backend, compte, secret, service payant, appel d’IA générative ou base de données.

DETR panoptique (`Xenova/detr-resnet-50-panoptic`, q8 44,5 Mo) et OWL-ViT (`Xenova/owlvit-base-patch32`, q8 ≈ 155 Mo hors tokenizer) ont été examinés comme candidats, mais ne sont pas livrés : le dépôt ne contient pas le corpus annoté autorisé permettant de mesurer contours, classes et anomalies sans fabriquer de résultats. Transformers.js n’est donc pas une dépendance de production. La décision et le protocole requis sont détaillés dans [BENCHMARK.md](./BENCHMARK.md).

## Architecture

La configuration des catégories est l’unique source de vérité. L’adaptateur COCO produit un contrat géométrique normalisé, puis le filtre de confidentialité supprime toute étiquette de personne avant l’état partagé. Le coordinateur garde au plus une inférence active et une requête en attente ; une écriture n’est acceptée que si source, requête, détecteur, seuil et prétraitement correspondent encore. L’audio suit un cycle distinct : permission audio seule → worker YAMNet → catégories normalisées → lissage → événements récents.

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
│   ├── detection/shape-geometry.js
│   ├── detection/adapters/coco-detector.js
│   ├── audio/{audio-controller,audio-worker,audio-classifier-adapter,audio-event-normalizer,audio-smoother,audio-permission-service}.js
│   ├── quality/image-quality-assessor.js
│   ├── state/{store,preferences}.js
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

Caméra et microphone sont autorisés sur `localhost`. Sur un autre domaine, `getUserMedia` exige HTTPS. Le microphone n’est demandé qu’après un clic explicite sur « Démarrer l’écoute ».

## Déploiement Cloudflare Pages

1. Pousser ce dépôt sur GitHub.
2. Dans Cloudflare Pages, choisir **Create a project > Connect to Git**.
3. Sélectionner le dépôt et utiliser la branche principale.
4. Laisser la commande de build vide.
5. Définir le répertoire de sortie sur `/` (racine du dépôt).
6. Déployer, puis tester le chargement du modèle et la caméra sur l’URL HTTPS.

Les règles `_headers` autorisent uniquement la caméra et le microphone du même site. Aucun paramètre d’environnement n’est nécessaire.

**URL publique :** `À renseigner après le premier déploiement Cloudflare Pages.`

## Déploiement GitHub Pages

Le même dépôt fonctionne sans build sur GitHub Pages : dans **Settings → Pages**, choisir **Deploy from a branch**, la branche principale et le dossier racine. GitHub Pages n’applique pas `_headers`, mais sert le site en HTTPS ; vérifier malgré tout caméra, microphone, imports CDN et modèle depuis l’URL publiée. Aucun secret ni workflow serveur n’est requis.

## Cache, hors ligne et mémoire mobile

SalleScope n’installe aucun service worker et ne promet donc pas un fonctionnement hors ligne. Le premier chargement de COCO-SSD, et la première écoute YAMNet, exigent le réseau. Le cache HTTP du navigateur peut réutiliser les artefacts, sans garantie après éviction. Pour les retirer, effacer les données du site dans les réglages du navigateur ou, dans les outils de développement, **Application → Storage → Clear site data**, puis vider le cache réseau.

Les tailles de téléchargement ne sont pas les tailles en mémoire : COCO-SSD (≈ 67,8 Mo), le WASM MediaPipe (≈ 6,6 Mo) et YAMNet (≈ 4,1 Mo) utilisent davantage de mémoire une fois décodés. YAMNet est donc chargé uniquement à la demande et son worker est détruit à l’arrêt. Sur mobile contraint, le navigateur peut interrompre/recharger la page ; éviter d’alterner rapidement de nombreux onglets et tester sur l’appareil cible.

## Confidentialité

Les images, trames caméra et échantillons PCM ne sont envoyés à aucune API. Les URL d’objet sont révoquées après décodage et les fenêtres audio transférées au worker ne sont pas conservées. Seuls les seuils et nombres attendus sont enregistrés dans `localStorage`. Les pistes caméra et microphone sont arrêtées à l’arrêt, au changement de source, à la réinitialisation et à la fermeture de la page.

Une prédiction dont l’étiquette est `person`, `human`, `student`, `teacher`, `face`, `man`, `woman`, `boy` ou `girl` est supprimée par `privacy-filter.js` juste après l’adaptateur. Elle n’est ni stockée, ni dessinée, ni comptée, ni journalisée, ni incluse dans le rapport.

## Limites connues

- COCO-SSD est généraliste et ne détecte ni tableaux ni fenêtres.
- `dining table` est une approximation des tables et bureaux de cours.
- `tv` est une approximation des écrans et moniteurs.
- Les objets petits, éloignés, partiellement masqués ou mal éclairés peuvent être manqués.
- Un seuil plus bas expose davantage de propositions, mais augmente aussi les faux positifs ; il n’améliore pas intrinsèquement le modèle.
- Un objet non détecté ne doit jamais être considéré comme absent sans contrôle humain.
- Les événements sonores sont des possibilités statistiques ; ils ne constituent ni une transcription, ni une preuve d’activité, ni l’identité d’une personne.
- L’évaluation d’anomalies visuelles n’est pas livrée faute de masques validés et d’annotations autorisées. Aucun dommage n’est affirmé automatiquement.
- Les tableaux blancs ne sont pas une classe COCO-SSD fiable ; les vues frontales, inclinées ou partielles restent non vérifiables dans cette version.
- SalleScope compte les détections `chair` complètes. Il ne crée pas de chaises à partir de pieds, dossiers ou assises, ce qui évite de gonfler les comptes mais ne répare pas les chaises partielles manquées.

## Géométries et modes visuels

Le mode standard livré utilise les boîtes rectangulaires réelles de COCO-SSD. Le contrat interne sait aussi afficher un masque, un polygone ou calculer par PCA une boîte orientée à partir de pixels de masque. Cette boîte orientée suit l’axe dominant de la forme ; ce n’est pas un parallélogramme perspectif parfait et elle ne doit pas être présentée comme tel. Aucun contour orienté n’est dérivé d’une simple boîte COCO.

Il n’existe actuellement ni mode « précis » panoptique ni mode OWL expérimental dans l’interface : les deux candidats ont été rejetés faute de corpus autorisé reproductible. Le mode standard reste donc toujours disponible et indépendant de Transformers.js.
- Le premier chargement du modèle requiert un accès réseau aux fichiers statiques de jsDelivr.

Le diagnostic local du 16/10/2026 a mesuré 5,8 à 6,4 s de chargement à froid et 1,626 s d’inférence moyenne sur quatre fixtures temporaires pour `mobilenet_v2`. Ces fixtures n’étant pas conservées avec annotations, aucune précision/rappel/F1 n’est revendiquée. Voir [BENCHMARK.md](./BENCHMARK.md).

## Compatibilité et tests manuels

Utiliser une version récente de Chrome, Edge, Firefox ou Safari avec JavaScript activé. WebGPU n’est pas requis par la version livrée. Safari/iOS peut demander une interaction avant la caméra. Le protocole Cloudflare et les résultats de remplacement/caméra sont dans [PROJECT.md](./PROJECT.md).
