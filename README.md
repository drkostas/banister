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
