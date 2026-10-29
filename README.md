# OVERCLOCKED

Portrait puzzle game. Steven Cole hacks HELIX nodes with an Overclock Rig: a board of target blocks, a hand of math tiles, and a turn clock called the Sector Stability Pool.

200 stages. 25 episodes. English UI, aimed at a worldwide audience.

## Play in the browser

```bash
npm install
npm run dev
```

Open the URL Vite prints (port 5173). Use a narrow window or a phone. Progress is stored in `localStorage`.

## Tests

```bash
npm test          # pulse engine + board rules
npm run verify    # solver proves all 200 stages are clearable
```

`npm run verify` rewrites `src/data/stages.json` from the story-bible balance table. If a stage cannot be cleared, it lowers HP (and adds turns on non-countdown stages) into `src/data/fixes.json` and retries. The current table clears with an empty fix list.

## Android debug APK

Requirements: JDK 17+, Android SDK 35, `ANDROID_HOME` set.

```bash
export ANDROID_HOME="$HOME/android-sdk"   # or your SDK path
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
npm run android:apk
```

That builds the web bundle, syncs Capacitor, runs `assembleDebug`, and copies the APK to:

`releases/overclocked-debug.apk`

- Package id: `com.overclocked.game`
- Debug-signed by the Android Gradle debug keystore
- Install: `adb install -r releases/overclocked-debug.apk`

The debug APK in `releases/` is the build produced in this environment.

## Rules (short)

1. Stage 1-1 is a 4×4. Later boards grow, gain blocked cells, and change shape per the balance table. Bosses use their own shapes.
2. Play one tile orthogonal to a target or to a connected tile.
3. The touching network pulses. **Damage = (sum of value nodes) × (product of multipliers).** Earlier tiles fire again every placement.
4. One turn per placement. Hand refills to 3 from an infinite deck.
5. A target at 0 HP explodes. Tiles that no longer touch a living target are purged.
6. Overclock gauge: +5% per tile, +15% per clear, +30% on a multi-clear. At 100%, System Overload is Pulse ×2 or Manual Scrub.
7. From Episode 3, Overclock Shield is a one-shot failsafe (`+max(3, 10% of the turn limit)` and a scrub).
8. Fifteen modifiers (amplifiers, cleaners, stabilizers) unlock on stage 2 of episodes 2–16, return on stage 5, and mix into the pool from Episode 17. Non-4×4 scaling matches the story bible (75% fill for Scrappy Draw, fusion value = 75% of open cells, full open rows/columns for Laser Wipe, corners = cells with two or fewer open neighbors).
9. Bosses: Aegis Core, Bio-Drain Daemon, Flux Node, Mitosis Reactor, Countdown Prime. Episode 24 cycles all of them. Episode 25’s last armor only falls to Julia’s Root Access. Episode 22’s Winter Lattice opens with two branch cores, matching its gimmick line. Episode 23 floods the farthest empty cell each turn instead of deleting the chain, so the regen fight stays solvable.

Ally abilities (once per stage): Signal Boost, Overwatch, Backdoor, Breach, Cipher Read, Triage, Briefing, Last Stand (episodes 18–23), Root Access. Story allies are locked in. Episode 17 seals every ability. Fallen operators stay in the codex as memorials.

Stars are based on turns left (40% → 3, 15% → 2, otherwise 1). Boss-star total of 65 or more is the true ending.

## Cutscene art

See `public/assets/cutscenes/NAMING.md`. The renderer loads `assets/cutscenes/{id}-{panel}.jpg` and falls back to a styled placeholder. Stage 1-1 scene 1 uses the included graphic-novel sample.

## Layout

- `src/game` — pulse math, stage builder, engine, allies, solver
- `src/data/bible.json` — story, scripts, and the 200-row balance table
- `src/data/stages.json` — generated stage snapshot
- `src/ui` — save, audio, particles, hints
- `src/main.ts` — portrait screens
