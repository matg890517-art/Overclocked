# Cutscene art

OVERCLOCKED ships **225 cutscenes**: one before each of the 200 stages, plus one win scene after each of the 25 bosses.

The puzzle shows **one image per scene**. A cutscene can contain several scenes (the script splits on ` / `). Each scene is a full-frame illustration, never a multi-panel collage. The renderer draws an English caption box and a dialogue bubble on top, with typewriter text. If the jpg is missing, it shows a stylised placeholder (gradient, halftone, speaker monogram) and still plays the caption.

## File names

```
assets/cutscenes/{cutId}-{panel}.jpg
```

- `{cutId}` is the cutscene id.
- `{panel}` starts at 1.

| Kind | Id | Example file |
| --- | --- | --- |
| Stage intro | `eEE-sSS` | `e01-s01-1.jpg` |
| Boss win | `eEE-win` | `e01-win-1.jpg` |
| Bonus endings (not part of the 225) | `ending-standard`, `ending-true` | `ending-standard-1.jpg` |

`EE` and `SS` are two digits. Stage 8 is the boss intro (`e12-s08-1.jpg`).

The shipped sample, Western graphic-novel Steven and Julia, is **Stage 1-1, scene 1**:

`assets/cutscenes/e01-s01-1.jpg`

## All 225 cutscene ids

Stage intros `e01-s01` … `e01-s08`, then `e01-win`, through `e25-s01` … `e25-s08`, `e25-win`.

```
e01-s01 e01-s02 e01-s03 e01-s04 e01-s05 e01-s06 e01-s07 e01-s08 e01-win
e02-s01 e02-s02 e02-s03 e02-s04 e02-s05 e02-s06 e02-s07 e02-s08 e02-win
e03-s01 e03-s02 e03-s03 e03-s04 e03-s05 e03-s06 e03-s07 e03-s08 e03-win
e04-s01 e04-s02 e04-s03 e04-s04 e04-s05 e04-s06 e04-s07 e04-s08 e04-win
e05-s01 e05-s02 e05-s03 e05-s04 e05-s05 e05-s06 e05-s07 e05-s08 e05-win
e06-s01 e06-s02 e06-s03 e06-s04 e06-s05 e06-s06 e06-s07 e06-s08 e06-win
e07-s01 e07-s02 e07-s03 e07-s04 e07-s05 e07-s06 e07-s07 e07-s08 e07-win
e08-s01 e08-s02 e08-s03 e08-s04 e08-s05 e08-s06 e08-s07 e08-s08 e08-win
e09-s01 e09-s02 e09-s03 e09-s04 e09-s05 e09-s06 e09-s07 e09-s08 e09-win
e10-s01 e10-s02 e10-s03 e10-s04 e10-s05 e10-s06 e10-s07 e10-s08 e10-win
e11-s01 e11-s02 e11-s03 e11-s04 e11-s05 e11-s06 e11-s07 e11-s08 e11-win
e12-s01 e12-s02 e12-s03 e12-s04 e12-s05 e12-s06 e12-s07 e12-s08 e12-win
e13-s01 e13-s02 e13-s03 e13-s04 e13-s05 e13-s06 e13-s07 e13-s08 e13-win
e14-s01 e14-s02 e14-s03 e14-s04 e14-s05 e14-s06 e14-s07 e14-s08 e14-win
e15-s01 e15-s02 e15-s03 e15-s04 e15-s05 e15-s06 e15-s07 e15-s08 e15-win
e16-s01 e16-s02 e16-s03 e16-s04 e16-s05 e16-s06 e16-s07 e16-s08 e16-win
e17-s01 e17-s02 e17-s03 e17-s04 e17-s05 e17-s06 e17-s07 e17-s08 e17-win
e18-s01 e18-s02 e18-s03 e18-s04 e18-s05 e18-s06 e18-s07 e18-s08 e18-win
e19-s01 e19-s02 e19-s03 e19-s04 e19-s05 e19-s06 e19-s07 e19-s08 e19-win
e20-s01 e20-s02 e20-s03 e20-s04 e20-s05 e20-s06 e20-s07 e20-s08 e20-win
e21-s01 e21-s02 e21-s03 e21-s04 e21-s05 e21-s06 e21-s07 e21-s08 e21-win
e22-s01 e22-s02 e22-s03 e22-s04 e22-s05 e22-s06 e22-s07 e22-s08 e22-win
e23-s01 e23-s02 e23-s03 e23-s04 e23-s05 e23-s06 e23-s07 e23-s08 e23-win
e24-s01 e24-s02 e24-s03 e24-s04 e24-s05 e24-s06 e24-s07 e24-s08 e24-win
e25-s01 e25-s02 e25-s03 e25-s04 e25-s05 e25-s06 e25-s07 e25-s08 e25-win
```

Panels beyond scene 1 use the same id with `-2`, `-3`, and so on (`e08-s08-3.jpg`). Drop the files in this folder; no code change is required.
