# SalleScope

**EPITA Smart Classroom** — *L’audit visuel de vos salles, en quelques secondes.*

SalleScope est une application web statique d’audit de salle de cours. Elle analyse une photo importée ou une image capturée par la caméra, reconnaît localement certains équipements avec COCO-SSD, puis compare les quantités visibles à une configuration théorique éditable.

## Fonctionnalités

- Import d’images JPEG, PNG et WebP, redimensionnées à 1280 px maximum avant analyse.
- Capture ponctuelle par caméra arrière, sans microphone ni enregistrement vidéo.
- Détection réelle dans le navigateur avec boîtes, libellés français et scores de confiance.
- Suppression immédiate de toute prédiction `person` avant l’état, l’affichage et les calculs.
- Comptage des chaises, tables/bureaux, ordinateurs portables et écrans.
- Marquage honnête des tableaux et fenêtres comme non vérifiables.
- Configuration attendue et seuil de confiance modifiables et mémorisés localement.
- Tableau de bord et comparaison calculés depuis les seuls résultats réels.
- Rapport complet imprimable ou enregistrable en PDF par le navigateur.
- Interface accessible et responsive de 375 px au grand écran.

## Technologies et coût

L’application utilise uniquement HTML, CSS, JavaScript ES modules et les API du navigateur. Les seules dépendances distantes, épinglées dans `index.html`, sont :

- `@tensorflow/tfjs@4.22.0`
- `@tensorflow-models/coco-ssd@2.2.3` avec `lite_mobilenet_v2`

Il n’y a aucun backend, compte, secret, service payant, appel d’IA générative ou base de données. L’hébergement statique Cloudflare Pages et l’inférence locale permettent un usage sans coût additionnel.

## Architecture

La configuration des catégories est l’unique source de vérité. Le service de modèle filtre les personnes avant de retourner ses données. Le store contient l’état sûr. Le moteur d’audit est pur et produit le même résultat dérivé pour les vues, le tableau de bord et le rapport.

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
│   ├── responsive.css
│   └── print.css
├── src/
│   ├── main.js
│   ├── config/{categories,coco-labels,defaults}.js
│   ├── state/store.js
│   ├── services/{model,camera,image,report}-service.js
│   ├── domain/audit-engine.js
│   ├── ui/{ui-controller,canvas-renderer,configuration-view,results-view,dashboard-view,audit-view}.js
│   └── utils/{dom,errors,formatting}.js
└── tests/
    ├── audit-engine.test.mjs
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
- L’occlusion, le cadrage, la lumière, la distance et le seuil influencent les résultats.
- Un objet non détecté ne doit jamais être considéré comme absent sans contrôle humain.
- Le premier chargement du modèle requiert un accès réseau aux fichiers statiques de jsDelivr.

## Compatibilité et tests manuels

Utiliser une version récente de Chrome, Edge, Firefox ou Safari avec JavaScript activé. Safari/iOS peut demander une interaction avant l’activation de la caméra. Vérifier au minimum : import et analyse, seuil, configuration, refus caméra, image sans équipement, présence d’une personne, largeurs 375/768/1440 px et aperçu avant impression. Le protocole exhaustif et les résultats à renseigner sont dans [PROJECT.md](./PROJECT.md).
