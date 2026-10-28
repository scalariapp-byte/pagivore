# Pagivore

<img src="logo.svg" width="96" alt="">

Pagivore, le mangeur de pages : ta collection de BD, mangas, comics et livres, et le suivi de tes lectures.

Petite application web pour organiser sa collection de **BD, mangas et comics**.

- **Ma collection** : tomes possédés (ex. `1-12, 14`), liste d'envies, lecture (à lire / en cours / lu), note sur 5, commentaire.
- **Filtres** : par type, statut, lecture, texte libre, et tri (ajout, titre, note, parution).
- **Recherche en ligne** :
  - Mangas via [AniList](https://anilist.co) : filtres format, origine (Japon, Corée, Chine), statut, genre, année, tri.
  - BD et comics via [Open Library](https://openlibrary.org) : titre, auteur ou **ISBN**, filtres catégorie, langue, années, tri.
- **Acheter** : liens directs vers Amazon, Fnac, BDfugue, et d'occasion sur Vinted et Leboncoin.
- Thème clair / sombre, adapté au téléphone.
- **Exporter / Importer** la collection en fichier JSON (sauvegarde ou passage sur un autre appareil).

Aucune installation, aucun compte, aucune clé d'API : ce sont juste 3 fichiers (`index.html`, `style.css`, `app.js`).

## Mettre en ligne avec GitHub Pages

1. Crée un dépôt sur GitHub (par exemple `bulles`).
2. Envoie ces fichiers dedans :
   ```bash
   git remote add origin https://github.com/TON-PSEUDO/bulles.git
   git push -u origin main
   ```
   (ou glisse simplement les fichiers dans la page du dépôt avec « Add file > Upload files »)
3. Dans le dépôt : **Settings > Pages > Branch : `main` / `(root)` > Save**.
4. Après une minute, l'app est en ligne sur `https://TON-PSEUDO.github.io/bulles/`.

## Bon à savoir

- La collection est enregistrée **dans le navigateur** (localStorage). Elle est donc propre à chaque appareil et navigateur : pense à faire **Exporter** de temps en temps pour garder une sauvegarde.
- Les résumés des mangas viennent d'AniList et sont en anglais.
- AniList limite à environ 30 recherches par minute.
