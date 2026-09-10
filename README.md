# banister

Training-model core in TypeScript for the [soma](https://github.com/drkostas/soma) ecosystem. Ported from soma's Python `training_engine` and verified against it with golden fixtures.

## Modules

**Banister fitness-fatigue model** — `p(t) = p0 + k1·Σ load·e^(-(t-i)/tau1) - k2·Σ load·e^(-(t-i)/tau2)`
- `banisterPredict(params, dailyLoads, targetDay)` — predict performance (VDOT).
- `fitBanister(dailyLoads, anchors)` — differential-evolution fit + Nelder-Mead polish, recency-weighted anchors. Reaches scipy-quality WSSE (1.9034 vs scipy 1.9227 on real training data).

**Daniels/Gilbert VDOT** — `vdotFromRace`, `allPaces`, `hmGoalPaces`, `timeFromVdot`, `velocityAtVo2max`, `adjustVdotForWeight`. Pace ints match Python's rounding exactly.

**Personal calibration** — 4-phase readiness-weight progression: `getCurrentPhase`, `computeCorrelations`, `getActiveWeights` (equal → |Pearson r| → LASSO). LASSO weights are computed in the consumer layer and passed in.

## Install
```
npm install banister
```

## Projection, pace zones and the PMC

Three modules that used to live as local copies in soma's web app (soma#835):

- `projection.ts`: `projectVdotSeries`, `projectFitnessOnlySeries`, `projectVdotAt` project a VDOT time-series over calendar dates from `DatedLoad[]` (`{ date, load }`) with the shared `BanisterParams`. `DEFAULT_BANISTER` is the projection default.
- `pace-zones.ts`: the Daniels VDOT table (35 to 60) with `getBasePace(vdot, runType)`, `getHRZone(runType)` and `getHMPrediction(vdot)`; run types map to zones through `RUN_TYPE_TO_ZONE`.
- `pmc.ts`: `computeActivityLoad`, `computeTrimp`, `computePmc` (EWMA CTL/ATL/TSB, tau 42/7) and `crossModalScale`, checked against the Python load-stream golden in `tests/pmc_golden.json`.

All of it is pure. Reading activities and storing the curve stay with the application that owns the tables.
