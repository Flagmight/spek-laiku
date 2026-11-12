# Plan Forecast API: Changes in Feature 007

The contract in `specs/006-hourly-forecast/contracts/plan-forecast-api.md` stays as it is, with the changes below. Each is an addition or an internal change, so no field is removed or renamed.

## 1. `longestPeriod` on each activity date

Each entry of `activities[i].days` gains `longestPeriod`. It is one of the date's `periods`: the longest, the earliest when two are equally long. It is `null` when the date has no suitable period, including a date with no hours left.

```json
{
  "date": "2026-11-14",
  "periods": [
    { "start": "08:00", "end": "10:00", "lengthHours": 2, "shorterThanDuration": false },
    { "start": "12:00", "end": "16:00", "lengthHours": 4, "shorterThanDuration": false }
  ],
  "longestPeriod": { "start": "12:00", "end": "16:00", "lengthHours": 4, "shorterThanDuration": false },
  "hours": [ … ]
}
```

The step 3 overview shows it as "★ 12:00–16:00 (4 h)", adding ", too short" when `shorterThanDuration` is true (spec FR-016). The page does not pick the period itself.

## 2. The checks before the forecast

`PlanForecastService` now starts with the shared `PlanRecheckService` (research section 2). The `400` keys and their order are unchanged:

- `setup`, or `setup.<key>`;
- otherwise `activities…`;
- `setup.dates` when midnight passed during the request.

The existing integration tests for these keys must still pass unchanged.

## 3. The request limit text

`RateLimitPolicies.PlanSetup`'s comment names place requests too. The behaviour does not change: forecast and place requests share the one limiter.
