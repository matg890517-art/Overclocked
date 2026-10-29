# Cutscene art

OVERCLOCKED ships **225 cutscenes**: one before each of the 200 stages, plus one win scene after each of the 25 bosses.

Each cutscene is **one image**. The English caption and dialogue are drawn into the picture. The player sees it letterboxed (`object-fit: contain`) so the captions are not cropped. Tap or SKIP to continue. If the file is missing, a caption-and-dialogue fallback is shown instead of a black frame.

## File names

```
assets/cutscenes/eNN-sMM.webp
assets/cutscenes/eNN-win.webp
```

- `NN` is the episode, `01`–`25`.
- `MM` is the stage, `01`–`08`. Stage 08 is the boss intro.
- `eNN-win.webp` plays after that episode’s boss is cleared.

Source JPEGs used the same stems (`eNN-sMM.jpg`, `eNN-win.jpg`). The app ships WebP at quality 75 so the APK stays small. Chrome 90 and the Chrome 95 WebView both decode WebP.

## Portraits

```
assets/portraits/{id}.webp
```

Ids: `steven`, `julia`, `eli`, `dex`, `tank`, `mira`, `nadia`, `hale`, `crane`, `kane`.

Rosa has no portrait; the UI draws a silhouette placeholder.

## Shipped in this build

200 of 225 WebP files are in this folder. These 25 ids were not in the archives that arrived and could not be matched confidently, so the in-game fallback (caption and dialogue, not a black frame) is used until the files are added:

`e01-s01` `e02-s06` `e03-s04` `e03-s06` `e04-s07` `e05-s05` `e05-win` `e07-s02` `e08-s02` `e08-s06` `e09-s02` `e09-s06` `e09-win` `e10-win` `e11-s05` `e11-s06` `e12-s05` `e12-win` `e14-s06` `e14-s07` `e15-s01` `e16-s01` `e16-s06` `e17-s02` `e17-s04`
