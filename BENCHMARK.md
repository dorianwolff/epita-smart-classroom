# Évaluation des détecteurs locaux

Date de l’audit : 16 octobre 2026. Ce document sépare les mesures réellement observées des candidats qui n’ont pas pu être évalués honnêtement.

## Décision de livraison

Le dépôt ne contient aucun corpus d’évaluation autorisé et annoté. Les images utilisées lors d’une recette précédente étaient temporaires ; elles ne sont donc ni reproductibles ni suffisantes pour calculer vrais positifs, faux positifs, faux négatifs, précision, rappel et F1. Aucun de ces chiffres n’est inventé.

En conséquence :

- le détecteur de production reste `COCO-SSD / mobilenet_v2` ; c’est le seul détecteur local déjà mesuré sur de vraies images dans ce projet ;
- `Xenova/detr-resnet-50` n’est pas intégré à l’interface tant qu’une comparaison annotée ne démontre pas un gain pratique ;
- `Xenova/detr-resnet-50-panoptic` n’est pas intégré : son q8 de 44,5 Mo est disponible, mais aucun masque de salle autorisé n’est présent pour vérifier contours, occlusions ou orientations ;
- `Xenova/owlvit-base-patch32` est rejeté de la livraison actuelle : aucune mesure sur tableaux/fenêtres n’est disponible et son poids q8 est important pour le mobile ;
- `@huggingface/transformers` n’est donc ni chargé, ni ajouté comme dépendance. Il n’existe aucun faux progrès de téléchargement et aucun mode factice.

SalleScope sélectionne ainsi le détecteur local testé le plus précis qui reste pratique sur l’appareil actuel, sans prétendre qu’il est le plus précis en général.

## Tableau d’évaluation

| Détecteur | Révision / version | Backend | Poids approximatif | Chargement mesuré | Inférence mesurée | Précision / rappel / F1 | Décision |
|---|---|---|---:|---:|---:|---|---|
| COCO-SSD `mobilenet_v2` | `@tensorflow-models/coco-ssd@2.2.3`, TFJS `4.22.0` | TensorFlow.js, backend navigateur consigné dans le rapport | 67 771 262 octets de manifeste + poids (≈ 67,8 Mo décimaux) | 5,8 s sur profil Chrome neuf ; 6,4 s lors de la recette précédente | moyenne 1 626 ms sur 4 fixtures temporaires | Non calculables sans annotations conservées | Livré, détecteur principal unique |
| [`Xenova/detr-resnet-50`](https://huggingface.co/Xenova/detr-resnet-50/tree/8be7ab59ff663484ee9ba2e8d8f267330d5ad03e), q8 | candidat `8be7ab59ff663484ee9ba2e8d8f267330d5ad03e` | WebGPU si validé, sinon WASM | `model_quantized.onnx` : 43,1 Mo | Non mesuré | Non mesuré | Non mesurables | Non livré : corpus absent |
| [`Xenova/detr-resnet-50-panoptic`](https://huggingface.co/Xenova/detr-resnet-50-panoptic/tree/ea24b2d), q8 | candidat `ea24b2d` | WebGPU/WASM à mesurer | `model_quantized.onnx` : 44,5 Mo (dépôt multi-variantes : 303 Mo) | Non mesuré | Non mesuré | Masques/PQ non mesurables | Non livré : aucune annotation de masque autorisée |
| [`Xenova/owlvit-base-patch32`](https://huggingface.co/Xenova/owlvit-base-patch32/tree/b75f4e52949639c3bb0b96546ea4149482f6e7ef), q8 | candidat `b75f4e52949639c3bb0b96546ea4149482f6e7ef` | WebGPU si validé, sinon WASM | modèle quantifié : 155 Mo, plus ≈ 3,6 Mo de tokenizer/configuration | Non mesuré | Non mesuré | Non mesurables | Mode étendu rejeté pour cette livraison |

Les tailles candidates proviennent des dépôts de modèles consultés le 16 octobre 2026. Les modèles sources [DETR](https://huggingface.co/facebook/detr-resnet-50) et [OWL-ViT](https://huggingface.co/google/owlvit-base-patch32) sont sous licence Apache-2.0. Ces références ne sont pas des dépendances de production.

## Audio, qualité et anomalies

YAMNet float32 v1 est livré via l’URL officielle MediaPipe et `@mediapipe/tasks-audio@1.1.0`. Un passage réel dans Chrome a chargé le modèle de 4 126 810 octets et classé une fenêtre silencieuse de 16 384 échantillons à 16 kHz en 29 ms après initialisation. Une phrase française générée hors ligne par la voix système, puis supprimée, a produit `Speech` à 98,0 % en 37 ms. Un signal transitoire déterministe de type applaudissement a produit `Clapping` à 14,8 % : il est visible au seuil minimal de 10 %, mais pas au seuil par défaut de 30 %, ce qui justifie le lissage et le vocabulaire prudent. Ces mesures vérifient l’intégration Worker/WASM ; elles ne mesurent pas l’exactitude. Aucun corpus audio annoté n’est conservé, donc précision, rappel et F1 sonores restent non mesurés.

L’évaluation de qualité (dimensions, réduction, luminance, exposition, contraste et force des contours) est livrée comme aide à la reprise. Le prétraitement automatique est rejeté dans cette version : aucune comparaison reproductible n’établit qu’il améliore la détection sans créer d’artefacts. L’analyse d’anomalies est également rejetée : sans segmentateur validé et annotations de dommages, afficher « Anomalie visuelle possible — à confirmer » serait un résultat non étayé. Le moteur n’affirme donc aucun dommage.

## Mesures historiques COCO-SSD

Ces valeurs sont utiles comme diagnostic, mais ne constituent pas un benchmark d’exactitude complet : les annotations manuelles et les coordonnées de toutes les boîtes n’ont pas été conservées.

| Fixture temporaire | Source | Inférence | Résultat sûr à 0,40 | Limite observée |
|---|---:|---:|---|---|
| Salle, chaises et tables | 1600 × 1200 | 1 782 ms | 9 chaises (10 lors d’une répétition) | aucune table fiable à 0,40 |
| Portable proche, CC0 | 1600 × 1180 | 1 585 ms | portable 99,2 %, plante 95,0 %, écran 94,3 %, vase 46,3 % | `tv` reste une approximation |
| Moniteur proche, domaine public | 1108 × 1220 | 1 570 ms | écran (`tv`) 95,5 % | une seule vue proche |
| Salle contenant des personnes | 1280 × 851 | 1 565 ms | table 41,9 %, aucune personne dans la sortie sûre | table possiblement fausse positive, chaises manquées |

À 0,25, la salle temporaire produisait 14 chaises et une table à 25,1 %. À 0,60, elle ne produisait plus que 4 chaises. Cette observation illustre un compromis rappel/faux positifs ; elle ne mesure pas la précision statistique.

## Corpus autorisé requis

Pour rouvrir l’évaluation DETR et OWL-ViT, ajouter dans un dossier de test exclu de la production des images dont l’usage est explicitement autorisé, avec annotations JSON séparées :

1. au moins trois salles montrant des chaises et tables/bureaux à plusieurs distances ;
2. un portable et un moniteur, en vues proches et larges ;
3. une salle occultée et une salle en faible lumière ;
4. des tableaux blancs/noirs et fenêtres pour le seul test OWL-ViT ;
5. une fixture contenant des personnes uniquement pour vérifier qu’aucune prédiction privée n’atteint les résultats.

Chaque annotation doit contenir la catégorie attendue et la boîte `x/y/width/height`. Le même corpus doit être exécuté dans le même navigateur, sur le même appareil et à la même résolution pour COCO-SSD et DETR. Pour chaque couple modèle/fixture, enregistrer : identifiant, révision, backend, durée de chargement, durée d’inférence, dimensions, classe, score, boîte, TP/FP/FN, précision, rappel, F1 et réactivité de l’interface. Le corpus d’évaluation doit rester distinct de tout futur corpus d’entraînement.

## Règle de sélection future

DETR ne deviendra le mode « Précis » que s’il améliore les catégories prises en charge avec un coût acceptable. COCO-SSD deviendra alors le mode explicite « Analyse rapide » et le repli affichera : « Le modèle précis est indisponible. SalleScope utilise le modèle rapide. » OWL-ViT ne sera proposé en « Analyse étendue expérimentale » que si les résultats sur bureaux, tableaux et fenêtres sont utiles, avec confirmation humaine obligatoire et déduplication IoU par catégorie.
