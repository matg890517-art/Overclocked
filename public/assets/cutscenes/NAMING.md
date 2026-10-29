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

All 225 WebP files are here, converted from the named JPEGs in `cutscenes_00`, `cutscenes_01`, and `cutscenes_02`. The filename is the cutscene id. The fallback caption is only used if a file fails to load.
