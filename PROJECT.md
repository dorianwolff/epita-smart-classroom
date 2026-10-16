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

`main.js` assemble le store, les services et le contrôleur UI. `categories.js` porte toutes les règles de catégorie et l’exemple EPITA. `model-service.js` est la frontière de confidentialité et retourne exclusivement des prédictions sûres. `analysis-coordinator.js` sérialise l’inférence, invalide les sources obsolètes et conserve la source éphémère hors du store. `audit-engine.js` est une fonction pure ; toutes les représentations consomment son résultat canonique. Les vues ne réalisent aucun calcul métier.

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
| B11 | Recette avec le corpus d’images autorisé | P0 | À faire |
| B12 | Déploiement et recette caméra sur Cloudflare Pages | P0 | À faire |
| B13 | Modes Détection libre / Audit configuré | P0 | Terminé |
| B14 | Capture indépendante et file d’analyse sûre | P0 | Terminé |

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
| 7 | Modification du seuil | Nouvelle analyse avec seuil courant et résultats mis à jour | Réussi le 16/10/2026 : réanalyse à 70 % et seuil mis à jour dans le rapport |
| 8 | Modification de la configuration | Modes et référence recalculés sans inférence | Réussi le 16/10/2026 : libre sans écarts, configuré vide insuffisant, exemple EPITA chargé puis réinitialisé |
| 9 | Personne visible | Aucune boîte, quantité, ligne, trace brute ou entrée rapport `person` | Réussi le 16/10/2026 : 5 prédictions brutes de personne dans la fixture, 0 résultat UI/rapport ; test unitaire réussi |
| 10 | Mobile 375 px | Une colonne, actions 48 px, cartes de comparaison, aucun débordement | Réussi le 16/10/2026 : largeur de document 375 px, action principale 50,625 px |
| 11 | Tablette 768 px | Mise en page lisible et sans débordement | Réussi le 16/10/2026 : largeur de document 768 px et colonne de 736 px |
| 12 | Bureau 1440 px | Zone d’analyse équilibrée sur deux colonnes | Réussi le 16/10/2026 : largeur 1440 px, colonnes 774,891 px / 373,109 px |
| 13 | Impression / PDF | Rapport A4 lisible sans photo ni contrôles | Réussi le 16/10/2026 : PDF A4 généré, 2 pages, contrôles masqués, inspection visuelle effectuée |
| 14 | URL Cloudflare Pages | Site accessible, dépendances et modèle chargés | À renseigner après déploiement |
| 15 | Caméra sur URL HTTPS | Permission, capture, arrêt des pistes | À tester après déploiement |

Pour le scénario 9, inspecter l’interface, le rapport, la console et l’état exposé au débogueur : aucune détection `person` ne doit apparaître. Le test automatisé `tests/model-privacy.test.mjs` vérifie la sortie de la frontière modèle avec une prédiction `person` simulée ; il ne remplace pas la recette visuelle réelle.

## Risques et atténuations

| Risque | Impact | Atténuation |
|---|---|---|
| Faux négatifs dus à l’occlusion | Inventaire incomplet | Vocabulaire prudent, seuil réglable, contrôle humain obligatoire |
| Classe COCO trop générale | Mauvaise interprétation | Limites visibles pour `dining table` et `tv` |
| Modèle/CDN indisponible | Analyse impossible au premier chargement | Erreur actionnable et nouvelle tentative ; possibilité future d’héberger les fichiers statiques localement |
| Permission ou caméra indisponible | Capture impossible | Import d’image toujours proposé |
| Présence de personnes | Risque vie privée | Filtrage immédiat avant tout retour, état ou journalisation |
| Gros fichier / mémoire mobile | Ralentissement | Limite 15 Mo et dimension maximale 1280 px |
| Mauvaise conclusion opérationnelle | Décision erronée | Statuts « à contrôler », rapport de limites et validation manuelle |
| Incompatibilité navigateur | Fonction indisponible | Détection de capacité, erreurs françaises, tests multi-navigateurs |

## Sécurité et confidentialité

L’application ne possède ni backend, ni identifiant, ni secret. `getUserMedia` demande uniquement `video` avec préférence pour la caméra arrière et fixe `audio: false`. `_headers` définit `microphone=()`. Les trames caméra et images ne sont jamais persistées. Les URL `blob:` sont révoquées. Les pistes sont stoppées après capture, à l’arrêt, à la réinitialisation et avant fermeture.

Les prédictions brutes restent dans la fonction d’inférence. Le filtre `prediction.class !== "person"` précède la construction des objets retournés. Aucun journal ne contient d’image ou de prédiction brute.

## Limites du modèle

COCO-SSD ne vérifie ni tableaux ni fenêtres. Ses classes `dining table` et `tv` ne sont que des approximations. Les scores ne sont pas des garanties ; perspective, lumière, résolution et masquage modifient les résultats. Une quantité inférieure ne signifie pas « absent ».

## Déploiement

Le dépôt est directement publiable sur Cloudflare Pages : aucune commande de build, sortie à la racine, aucune variable d’environnement. Après connexion GitHub, la recette finale doit renseigner l’URL publique, vérifier le chargement des fichiers statiques et tester la caméra sur HTTPS. Tant que ce déploiement n’a pas été réalisé, les lignes 14 et 15 du plan de test restent explicitement ouvertes.
