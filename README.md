# banister

Banister fitness-fatigue (impulse-response) training model in TypeScript.

`p(t) = p0 + k1·Σ load·e^(-(t-i)/tau1) - k2·Σ load·e^(-(t-i)/tau2)`

- `banisterPredict(params, dailyLoads, targetDay)` — predict performance (VDOT).
- `fitBanister(dailyLoads, anchors)` — differential-evolution fit + Nelder-Mead polish, recency-weighted anchors.

Verified to reach the same fit quality as scipy's `differential_evolution` (WSSE parity on real training data). Part of the [soma](https://github.com/drkostas/soma) ecosystem.

## Install
```
npm install banister
```
