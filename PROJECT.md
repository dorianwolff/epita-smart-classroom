# Dossier projet — SalleScope

## Problème métier

La préparation d’une salle de cours repose souvent sur un inventaire manuel lent et difficile à reproduire. SalleScope fournit un premier constat visuel en quelques secondes, sans remplacer la validation humaine et sans transmettre d’image hors du navigateur.

## Objectifs et utilisateurs

Objectifs : accélérer le pré-audit, rendre les écarts visibles, produire un rapport homogène et démontrer une approche respectueuse de la vie privée. Les utilisateurs cibles sont les équipes logistiques et pédagogiques, responsables de salles et personnels EPITA chargés d’un contrôle ponctuel.

## Périmètre MVP

- Image importée ou capture caméra unique.
- Détection locale COCO-SSD des chaises, tables, portables et écrans.
- Configuration théorique éditable, comparaison, synthèse et rapport imprimable.
- Objets COCO additionnels listés sans règle de comparaison.
- Interface française responsive, sans compte ni backend.

## Exclusions explicites

Reconnaissance ou suivi des personnes, vidéo continue, identification biométrique, stockage d’images, inventaire multi-salles persistant, collaboration, authentification, API distante, décision automatique, détection personnalisée de tableaux/fenêtres et génération PDF côté serveur sont exclus.

## Architecture

`main.js` assemble le store, les services et le contrôleur UI. `categories.js` porte toutes les règles de catégorie et l’exemple EPITA. `detection/adapters/coco-detector.js` encapsule TensorFlow.js ; `prediction-normalizer.js` produit le contrat interne unique et `privacy-filter.js` retire les étiquettes privées avant l’état. `source-record.js` attribue une identité immuable. `analysis-coordinator.js` sérialise une tâche active et une seule tâche en attente, avec validation stricte de `sourceId`, `sourceVersion` et `requestId`. `audit-engine.js` est pur ; toutes les vues consomment ses résultats.

Le traitement suit ce flux : source éphémère → file locale révisée → disponibilité du modèle → inférence locale → suppression immédiate de `person` → état sûr → moteur de détection libre ou d’audit configuré → vues et rapport. `localStorage` ne reçoit que les préférences numériques.

## Backlog

| ID | Tâche | Priorité | Statut |
|---|---|---:|---|
| B01 | Architecture statique modulaire | P0 | Terminé |
| B02 | Chargement épinglé de TensorFlow.js et COCO-SSD | P0 | Terminé |
| B03 | Import, validation et redimensionnement d’image | P0 | Terminé |
| B04 | Filtrage définitif des personnes avant état | P0 | Terminé |
| B05 | Capture caméra sans audio et nettoyage des pistes | P0 | Terminé |
| B06 | Moteur pur de comparaison et statuts | P0 | Terminé |
| B07 | Vues dynamiques, tableau de bord et erreurs | P1 | Terminé |
| B08 | Rapport d’audit imprimable | P1 | Terminé |
| B09 | Responsive 375/768/1440 px et accessibilité | P1 | Terminé |
| B10 | Tests automatisés du domaine et de la confidentialité | P0 | Terminé |
| B11 | Recette comparative COCO/DETR avec corpus annoté autorisé | P0 | Bloqué : corpus absent |
| B12 | Déploiement et recette caméra sur Cloudflare Pages | P0 | À faire |
| B13 | Modes Détection libre / Audit configuré | P0 | Terminé |
| B14 | Capture indépendante et file d’analyse sûre | P0 | Terminé |
| B15 | Diagnostic qualité, modèle précis et réanalyse temporisée | P0 | Terminé |
| B16 | Identité de source et coordination dernière image gagnante | P0 | Terminé |
| B17 | Abstraction, normalisation et confidentialité multi-adaptateur | P0 | Terminé pour COCO |
| B18 | Évaluation DETR et OWL-ViT | P0 | Non livrée sans mesures |

## KPI

1. **Taux de détection des objets pris en charge** : détections correctes d’objets pris en charge ÷ objets pris en charge annotés. Mesure : `À renseigner après constitution et annotation du corpus de test`.
2. **Durée moyenne d’un audit** : temps entre le début d’un audit et l’affichage du rapport. Mesure : `À renseigner après tests chronométrés`.
3. **Exactitude des calculs d’audit** : calculs de comparaison corrects ÷ calculs testés. Mesure terrain : `À renseigner après recette` ; les cas unitaires automatisés sont documentés séparément.
4. **Nombre d’écarts détectés** : nombre de catégories vérifiables dont la quantité attendue diffère de la quantité détectée. Cette valeur est calculée pour chaque audit ; aucune moyenne n’est encore mesurée.

Aucune valeur de performance ou de précision n’est fabriquée avant l’exécution du protocole sur un corpus annoté.

## Plan de test et résultats

| # | Scénario | Résultat attendu | Résultat constaté |
|---:|---|---|---|
| 1 | Image de salle claire | Boîtes et comptes cohérents avec les objets visibles | Réussi le 16/10/2026 : 4 chaises détectées par le modèle réel sur l’image de recette temporaire |
| 2 | Salle avec occlusion / mauvais angle | Résultats prudents et message de limite visible | À tester avec image autorisée |
| 3 | Image sans équipement pris en charge | Message explicite, autres objets éventuels conservés | Réussi le 16/10/2026 sur l’image de confidentialité : message dédié et aucun faux résultat sûr |
| 4 | Permission caméra refusée | Erreur française et alternative d’import | À tester manuellement |
| 5 | Aucune caméra | Erreur dédiée et alternative d’import | À tester sur appareil adapté |
| 6 | Échec de chargement du modèle | Photo conservée, statut indisponible et nouvelle tentative | Réussi le 16/10/2026 : requête modèle interrompue, aperçu conservé, retry puis analyse automatique |
| 7 | Modification du seuil | Une seule nouvelle analyse temporisée avec le seuil courant | Réussi le 16/10/2026 : passage de 40 à 25 %, message transitoire, nouvelle analyse automatique et rapport actualisé |
| 8 | Modification de la configuration | Modes et référence recalculés sans inférence | Réussi le 16/10/2026 : libre sans écarts, configuré vide insuffisant, exemple EPITA chargé puis réinitialisé |
| 9 | Personne visible | Aucune boîte, quantité, ligne, trace brute ou entrée rapport `person` | Réussi le 16/10/2026 : personnes visibles dans la fixture, 0 résultat UI/rapport ; test unitaire réussi |
| 10 | Mobile 375 px | Une colonne, actions 48 px, cartes de comparaison, aucun débordement | Réussi le 16/10/2026 : largeur de document 375 px, action principale 50,625 px |
| 11 | Tablette 768 px | Mise en page lisible et sans débordement | Réussi le 16/10/2026 : largeur de document 768 px et colonne de 736 px |
| 12 | Bureau 1440 px | Zone d’analyse équilibrée sur deux colonnes | Réussi le 16/10/2026 : largeur 1440 px, colonnes 774,891 px / 373,109 px |
| 13 | Impression / PDF | Rapport A4 lisible sans photo ni contrôles | Réussi le 16/10/2026 : PDF A4 généré, 2 pages, contrôles masqués, inspection visuelle effectuée |
| 14 | URL Cloudflare Pages | Site accessible, dépendances et modèle chargés | À renseigner après déploiement |
| 15 | Caméra sur URL HTTPS | Permission, capture, arrêt des pistes | À tester après déploiement |

## Diagnostic de la chaîne de détection — 16/10/2026

### Configuration constatée avant correction

| Point vérifié | Constat |
|---|---|
| Modèle | `lite_mobilenet_v2`, variante la plus petite et la plus rapide |
| Seuil réel | 0,60 par défaut, éventuellement remplacé par la préférence locale |
| Boîtes maximales | 100 |
| Source d’inférence | Canvas source dédié, jamais la vignette CSS |
| Import | Proportions conservées, grand côté réduit à 1280 px, aucune mise à l’échelle vers le haut |
| Caméra | Capture depuis `videoWidth` / `videoHeight`, puis grand côté limité à 1280 px |
| Filtrage de confidentialité | `person` supprimé avant la construction des données sûres |
| Classes sûres non mappées | Conservées par le modèle et présentées sous « Autres objets détectés » |
| Mapping | Exact : `chair`, `dining table`, `laptop`, `tv` depuis `categories.js` |
| Boîtes | Coordonnées d’inférence conservées ; seule la présentation CSS redimensionne le canvas complet |
| Changement de seuil | Préférence mise à jour, mais aucune nouvelle inférence automatique |

Les causes principales étaient donc le couple modèle rapide / seuil élevé et l’absence de réanalyse automatique. La source n’était pas une petite vignette et le mapping d’audit ne supprimait pas les classes sûres. L’ancien message d’erreur « aucun équipement pris en charge » pouvait toutefois masquer visuellement la valeur d’objets sûrs non mappés ; il n’est désormais affiché que lorsqu’aucun objet sûr n’est retourné.

### Configuration après correction

| Paramètre | Après |
|---|---|
| Modèle | `mobilenet_v2` unique, chargé seul |
| Libellé de chargement | « Chargement du modèle local… » |
| Seuil | 0,40 par défaut ; plage 0,25–0,85 ; pas de 0,05 |
| Réanalyse | Temporisation de 350 ms, file sérialisée, source courante conservée |
| Import | Orientation fournie par le navigateur, grand côté limité à 1600 px |
| Caméra | 1920 × 1080 idéal, environnement, sans audio ; capture intrinsèque limitée à 1600 px |
| Rapport | Modèle, résolution de la source et temps d’inférence mesuré |

### Mesures sur fixtures autorisées

Mesures réalisées dans Chrome headless local avec `mobilenet_v2`, 100 boîtes maximum et seuil 0,40. Les scores ci-dessous proviennent d’un passage isolé ; une répétition de bout en bout a compté 10 chaises au lieu de 9 sur la salle, ce qui confirme qu’un inventaire humain reste nécessaire.

| Fixture | Source analysée | Temps | Classes sûres ≥ 0,40 et scores | Catégories d’audit | Objet attendu manqué |
|---|---:|---:|---|---|---|
| Salle existante avec chaises et tables | 1600 × 1200 | 1782 ms | `chair` : 97,4 %, 73,2 %, 68,4 %, 64,8 %, 58,2 %, 50,4 %, 45,0 %, 42,7 %, 41,5 % | Chaises | Toutes les tables à 40 % ; une seule `dining table` à 25,1 % avec seuil 0,25 |
| Portable proche, CC0 | 1600 × 1180 | 1585 ms | `laptop` 99,2 %, `potted plant` 95,0 %, `tv` 94,3 %, `vase` 46,3 % | Portable, écran ; plante et vase dans les autres objets | Aucun portable manqué ; `tv` reste une approximation contextuelle |
| Moniteur proche, domaine public | 1108 × 1220 | 1570 ms | `tv` 95,5 % | Écran | Aucun moniteur manqué sur cette vue |
| Salle avec personnes | 1280 × 851 | 1565 ms | `dining table` 41,9 % ; aucune classe `person` dans la sortie sûre | Table | Chaises visibles manquées ; la table est un faux positif possible à contrôler |

Sources externes de recette, non intégrées au dépôt : [portable CC0](https://commons.wikimedia.org/wiki/File:Laptop_on_a_desk.jpg) et [moniteur domaine public](https://commons.wikimedia.org/wiki/File:Computer_monitor.jpg). Les deux fixtures existantes restent temporaires et ne sont pas enregistrées par l’application.

À 0,25 sur la salle, 14 chaises et une `dining table` ont été affichées, contre 9 à 10 chaises et aucune table à 0,40. Ce gain de rappel s’accompagne de propositions plus fragiles. À 0,60, seules 4 chaises restaient visibles. Le seuil ne modifie pas l’exactitude intrinsèque du modèle.

### Arbitrage vitesse / qualité

| Modèle et source | Chargement | Inférence moyenne, 4 fixtures | Résultat qualitatif à 0,40 |
|---|---:|---:|---|
| `lite_mobilenet_v2`, cap 1280 | 1992 ms | 908 ms | 7 chaises sur la salle ; portable et moniteur trouvés ; aucune table de salle |
| `mobilenet_v2`, cap 1600 | 6433 ms | 1626 ms | 9 à 10 chaises ; scores portable/moniteur renforcés ; aucune table de salle fiable |

Le modèle précis charge environ 3,2 fois plus lentement et infère environ 1,8 fois plus lentement sur cette machine. Il améliore certains scores et le rappel des chaises, mais ne corrige pas les limites de classe ou de cadrage de COCO-SSD. Un sélecteur de modèle n’a pas été ajouté afin de garder une seule configuration compréhensible et de ne jamais charger deux modèles simultanément.

Pour le scénario 9, inspecter l’interface, le rapport, la console et l’état exposé au débogueur : aucune détection `person` ne doit apparaître. Le test automatisé `tests/model-privacy.test.mjs` vérifie la sortie de la frontière modèle avec une prédiction `person` simulée ; il ne remplace pas la recette visuelle réelle.

## Risques et atténuations

| Risque | Impact | Atténuation |
|---|---|---|
| Faux négatifs dus à l’occlusion | Inventaire incomplet | Vocabulaire prudent, seuil réglable, contrôle humain obligatoire |
| Classe COCO trop générale | Mauvaise interprétation | Limites visibles pour `dining table` et `tv` |
| Modèle/CDN indisponible | Analyse impossible au premier chargement | Erreur actionnable et nouvelle tentative ; possibilité future d’héberger les fichiers statiques localement |
| Permission ou caméra indisponible | Capture impossible | Import d’image toujours proposé |
| Présence de personnes | Risque vie privée | Filtrage immédiat avant tout retour, état ou journalisation |
| Gros fichier / mémoire mobile | Ralentissement | Limite 15 Mo et dimension maximale 1600 px |
| Mauvaise conclusion opérationnelle | Décision erronée | Statuts « à contrôler », rapport de limites et validation manuelle |
| Incompatibilité navigateur | Fonction indisponible | Détection de capacité, erreurs françaises, tests multi-navigateurs |

## Sécurité et confidentialité

L’application ne possède ni backend, ni identifiant, ni secret. `getUserMedia` demande uniquement `video` avec préférence pour la caméra arrière et fixe `audio: false`. `_headers` définit `microphone=()`. Les trames caméra et images ne sont jamais persistées. Les URL `blob:` sont révoquées. Les pistes sont stoppées après capture, à l’arrêt, à la réinitialisation et avant fermeture.

Les prédictions brutes restent dans la fonction d’inférence. Le filtre `prediction.class !== "person"` précède la construction des objets retournés. Aucun journal ne contient d’image ou de prédiction brute.

## Limites du modèle

COCO-SSD ne vérifie ni tableaux ni fenêtres. Ses classes `dining table` et `tv` ne sont que des approximations. Les objets petits, éloignés, partiellement masqués ou mal éclairés peuvent être manqués. Les scores ne sont pas des garanties ; perspective, lumière, résolution, seuil et masquage modifient les résultats. Une non-détection ne signifie pas « absent ».

## Déploiement

Le dépôt est directement publiable sur Cloudflare Pages : aucune commande de build, sortie à la racine, aucune variable d’environnement. Après connexion GitHub, la recette finale doit renseigner l’URL publique, vérifier le chargement des fichiers statiques et tester la caméra sur HTTPS. Tant que ce déploiement n’a pas été réalisé, les lignes 14 et 15 du plan de test restent explicitement ouvertes.

## Note d’implémentation — remplacement d’image

### Reproduction et cause

Le scénario A → B contrôlé n’écrivait pas systématiquement A sur B dans la version inspectée : le compteur `sourceRevision` bloquait déjà plusieurs écritures tardives. Il serait donc inexact de prétendre avoir reproduit cet écrasement à chaque passage. En revanche, l’audit a reproduit un défaut certain : après un import réussi, la valeur du champ fichier restait renseignée et la sélection du même fichier ne déclenchait plus `change`, donnant l’impression que l’application était bloquée jusqu’au rechargement ou au choix d’un autre fichier.

La cause structurelle était plus large : l’identité d’une source, l’identité d’une requête et le détecteur n’étaient pas représentés ensemble. Le coordinateur détenait une source brute et une promesse active, tandis que le store ne connaissait qu’une révision numérique. Ce contrat ne suffisait pas pour prouver qu’un résultat de changement de seuil ou de futur changement de détecteur appartenait encore à l’image visible. Le même canvas mélangeait en outre aperçu et boîtes, et la remise à zéro du rapport dépendait indirectement d’un recalcul UI.

### Correction

Chaque import ou capture crée désormais un enregistrement immuable `{ sourceId, sourceVersion, type, width, height, createdAt, status, asset }`. Seules les métadonnées entrent dans le store. Chaque tâche capture son propre asset, un `requestId`, le détecteur et le seuil. Une tâche active n’est jamais annulée de manière non sûre ; elle devient obsolète, la file ne garde que la dernière demande et son résultat est ignoré sauf concordance exacte des trois identifiants.

Le remplacement efface immédiatement détections, audit, métadonnées du rapport et overlay. Le champ fichier est vidé avant le décodage. Un import invalide conserve la dernière source valide. La caméra est mise en pause après capture pour permettre une reprise rapide, puis toutes ses pistes sont arrêtées lors d’un import réussi, d’un arrêt ou d’une réinitialisation.

## Architecture du détecteur et décision modèle

Le reste de l’application ne consomme plus les objets TensorFlow.js. Chaque prédiction sûre est normalisée sous la forme `{ id, sourceId, modelId, rawLabel, categoryId, displayLabel, score, bbox, experimental }`. Le filtre défensif de confidentialité s’exécute entre l’adaptateur et le store.

Le détecteur principal livré reste COCO-SSD `mobilenet_v2` au seuil 0,40. Ce n’est pas un mode de secours déguisé : faute de corpus annoté conservé, DETR ne peut pas être promu honnêtement et aucun sélecteur « Précis/Rapide » n’est affiché. OWL-ViT et le mode étendu sont également absents. Les valeurs mesurées, tailles, révisions candidates Apache-2.0 et protocole requis figurent dans [BENCHMARK.md](./BENCHMARK.md).

Le backend effectif de TensorFlow.js est consigné dans chaque rapport. La version actuelle n’exige ni WebGPU ni WASM. Si un adaptateur Transformers.js est validé plus tard, il devra fonctionner dans un Worker, publier le vrai `progress_callback`, préférer WebGPU seulement après test et retomber explicitement sur WASM.

## Vérifications du 16/10/2026

- 31 tests Node déterministes réussis après correction.
- Courses couvertes : A→B, A→B→C, échec obsolète, deux seuils successifs, changement de détecteur, reset pendant inférence.
- Import couvert : même fichier deux fois et révocation d’URL exactement une fois après copie.
- Confidentialité couverte pour `person`, `human`, `student`, `teacher`, `face`, `man`, `woman`, `boy`, `girl`.
- Chrome local : modèle prêt, remplacement par une source portrait 480×640, aperçu et overlay 480×640 alignés, rapport reconstruit pour la bonne source.
- Largeurs Chrome 375, 768 et 1440 px : `scrollWidth === clientWidth` dans les trois cas.
- Caméra factice Chrome : caméra → capture 1600×900 → import 320×240 → nouvelle capture 1600×900 ; stream conservé en pause après capture et arrêté lors de l’import.
- Chargement à froid observé sur un profil Chrome neuf : environ 5,8 s pour les poids COCO-SSD. Taille statique vérifiée par en-têtes du dépôt TensorFlow : 67 771 262 octets.
- Compatibilité statique : serveur HTTP sans build, sans Worker, sans fonction et sans variable d’environnement. `_headers` conserve `camera=(self)` et `microphone=()` ; aucune origine Transformers/Hugging Face n’est nécessaire puisque ces modèles ne sont pas livrés.

## Recette manuelle sur Cloudflare Pages

Le dépôt ne contient pas encore d’URL Cloudflare publique. Après déploiement statique, remplacer `<URL_CLOUDFLARE>` ci-dessous par l’URL HTTPS réelle :

1. ouvrir `<URL_CLOUDFLARE>` dans une fenêtre privée de Chrome et attendre « Modèle prêt » ; vérifier dans Réseau qu’aucune image n’est envoyée ;
2. importer une image A autorisée, puis pendant « Analyse locale en cours… » importer B ; vérifier que B apparaît immédiatement, que les anciennes boîtes/rapport disparaissent et que seul le rapport aux dimensions de B revient ;
3. recommencer A→B→C avant la fin de A ; vérifier que B n’est jamais analysée et que C gagne ;
4. sélectionner deux fois de suite le même fichier ; vérifier que les deux sélections lancent une analyse ;
5. déplacer rapidement le seuil deux fois pendant une analyse ; vérifier qu’un seul résultat final correspond au dernier seuil ;
6. lancer la caméra, capturer, choisir « Reprendre », recapturer, puis importer une image ; vérifier que l’indicateur caméra s’éteint après import ;
7. faire l’ordre inverse import → caméra → capture ; vérifier que l’overlay de l’import disparaît ;
8. pendant une analyse, cliquer « Recommencer » ; vérifier qu’aucun résultat tardif ne repeuple la page ;
9. utiliser une fixture autorisée contenant une personne ; inspecter résultats, rapport et console : aucune étiquette privée ne doit apparaître ;
10. répéter avec une source portrait et paysage à 375, 768 et 1440 px ; vérifier l’alignement des boîtes et l’absence de défilement horizontal ;
11. couper le réseau après un premier chargement mis en cache, recharger et noter le comportement réel du cache ; ne pas conclure à un support hors ligne sans ce test ;
12. imprimer le rapport en PDF et vérifier qu’aucune image source n’y figure.
