# Obs'EPS – Observation paramétrable et suivi des élèves en EPS

PWA hors-ligne qui réunit le meilleur de deux applis :

- **Biathlon (N'EPS)** : échanges entre tablettes par **QR codes** (ou fichiers), plusieurs classes, cycle de leçons, appel, **suivi par élève et par classe au fil des leçons**.
- **Gain EPS CA4** : appli élève **entièrement paramétrable** (1 ou 2 observés, boutons, disposition, indicateurs, rôles, conseils, résultats) et **paramétrage exporté / importé en JSON**.

## Mise en ligne
Publier ce dossier tel quel sur GitHub Pages (HTTPS obligatoire pour la caméra et l'installation).
- iPad : Safari → Partager → « Sur l'écran d'accueil ».
- Android : Chrome → « Installer l'application ».

Ensuite tout fonctionne hors-ligne ; les données restent sur chaque tablette.
Mise à jour : changer `CACHE` dans `sw.js` pour forcer le rechargement sur les tablettes.

## Premier lancement
Chaque tablette choisit son rôle : **enseignant** ou **élève** (modifiable ensuite).
Code enseignant par défaut : **0000** (à changer dans *Sauvegarde & réglages*).
Pour essayer tout de suite : *Sauvegarde & réglages → Créer une classe de démonstration*.

## Déroulement
1. **Classes & cycle** : créer les classes, importer la liste (Pronote .xlsx/.csv ou copier-coller), groupes facultatifs, nombre et titres des leçons.
2. **Paramétrer l'appli élève** (enregistrement automatique) :
   - *Activité* : nom, libellé, **1 ou 2 observés**, image, texte d'aide, chronomètre (chrono ou compte à rebours).
   - *Boutons* : nom, points, couleur, export Excel ; modèles (handball, badminton, boxe, tennis de table, volley, lutte).
   - *Disposition* : grille de 1 à 6 colonnes × 1 à 6 lignes, placement par toucher, image de fond (terrain…), mode miroir pour 2 observés, couleur d'équipe ou couleur par bouton.
   - *Listes* : listes déroulantes (options ou un élève de la classe).
   - *Récap* : champs calculés en direct (`OA`, `SA`, `N`, `T`, `O1…`, `A1…`, + − * / ( )).
   - *Indicateurs & conseils* : jusqu'à 4 indicateurs (camembert ou barres), boutons « réussite », seuils en % et conseil pour chaque intervalle.
   - *Rôles* : jusqu'à 3 rôles (arbitre, observateur, coach…) avec 5 niveaux décrits.
   - *Résultats* : ce que l'élève voit à la fin (récap, tableau, graphiques, conseils, comparaison avec la leçon précédente, évaluation des rôles).
   - *Modèles & JSON* : export / import du paramétrage en fichier .json (avec images) ou par QR (sans images). **Les fichiers de configuration de Gain EPS CA4 sont aussi acceptés** et convertis.
3. **Leçon du jour** : choisir la leçon, faire l'appel, afficher le **QR de la leçon** (classe + leçon + absents, et le paramétrage si la case est cochée). Chaque tablette élève : *Recevoir la leçon*.
4. Élèves : *Nouvelle observation* → choisir les observés (et les élèves qui tiennent un rôle) → observer → résultats avec graphiques, conseils et évaluation des rôles.
5. Fin de leçon : chaque tablette élève *Envoyer au prof* (QR) ; l'enseignant *Récupérer les saisies* (la caméra reste ouverte pour la tablette suivante). Liste des élèves présents pas encore observés.
6. **Suivi & bilans** :
   - *Par classe* : tableau élèves × leçons coloré + courbe de la moyenne de la classe, pour la mesure choisie (indicateur, score moyen, champ du récap, rôle, nombre d'un bouton…).
   - *Par élève* : courbes des indicateurs, du score et des rôles, tableau par leçon, derniers conseils, liste des observations.
   - *Par leçon* : bilan de chaque élève et liste des observations reçues.
   - *Export Excel* : onglet « Observations » + un onglet de suivi par mesure + « Rôles ».

## Échanges (QR et fichiers)
| QR | De → vers | Contenu |
|---|---|---|
| Leçon | enseignant → élèves | classe (prénoms seulement), leçon, absents, paramétrage (option) |
| Saisies | élève → enseignant | observations faites sur la tablette |
| Historique | enseignant → enseignant | élèves (noms complets), leçons, observations |
| Paramétrage | n'importe laquelle | paramétrage sans images |

Scanner à 30–40 cm, luminosité de l'écran au maximum ; les QR défilent seuls. Secours : *Photo du QR* ou *Partager en fichier* (AirDrop, Partage à proximité…).
Une observation supprimée sur une tablette élève est aussi supprimée chez l'enseignant au prochain envoi.

## Fichiers
`index.html`, `styles.css`, `js/` (core, exchange, app, eleve, param, prof), `sw.js`, `manifest.webmanifest`, `icons/`, `lib/` (qrcode, jsQR, ZXing, SheetJS — reprises de l'appli Biathlon).
