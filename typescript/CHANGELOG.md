# Changelog

## 0.6.0

- `detectAnchorRuns`: picks the maximal-effort runs (at least 90% of HRmax over at least 2 km by default) the Banister fit anchors to, each with its VDOT.
- `dailyLoadSeries`: the daily load series the PMC and the Banister fit read, with each source's cross-modal scale applied, summed per day and rest days filled with 0.
- `computeWeightEma` takes an optional `digits` (2 by default). `null` keeps full precision for a caller that rounds its own display.

## 0.5.1

Earlier releases have no changelog.
