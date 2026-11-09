# Plan Activities API

Both endpoints are under `/api/plan-activities`. JSON uses camelCase, numbers are JSON numbers and a string where a number belongs is refused (the existing strict number handling).

## Authorization

The `PlanCreator` policy from feature 004 applies to both endpoints:

| Caller | Result |
|---|---|
| Visitor (no sign-in cookie) | Allowed |
| Active Registered User | Allowed |
| Suspended Registered User | `403` |
| Active Administrator | `403` |
| Suspended Administrator | `403` |
| Sign-in cookie for a deleted account | `403` |

There is no request limit on these endpoints: they make no external call (research section 8).

## Category object

```json
{
  "id": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41",
  "name": "Kayaking",
  "type": "Outdoor",
  "defaultDurationHours": 2,
  "requiresDaylight": true,
  "maxWindMs": 8,
  "maxRainMmPerHour": 0.5,
  "minTemperatureC": 15,
  "maxTemperatureC": 35
}
```

`type` is `"Indoor"` or `"Outdoor"`. The four limits are `null` for Indoor. There is **no** `placeTags` and **no** `version`.

## List the categories for planning

`GET /api/plan-activities/categories`

- `200`: `{ "categories": [ <category object>, ... ], "maxActivities": 10 }`. The categories are ordered by name as on the Activity categories page (feature 003), and the list is empty when there are none. `maxActivities` is the most activities one plan may have, from `PlanActivityValidator.MaxActivities`. The page uses only this value to disable Add and to word "You can add up to <n> activities.", so the limit exists only on the server (constitution I, the same approach as `maxDates` in feature 004).
- `403`: see Authorization.

## Check the plan's activities

`POST /api/plan-activities/check`

Request:

```json
{
  "activities": [
    {
      "categoryId": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41",
      "type": "Outdoor",
      "durationHours": 2.5,
      "requiresDaylight": true,
      "maxWindMs": 8,
      "maxRainMmPerHour": 0.5,
      "minTemperatureC": 18,
      "maxTemperatureC": 35
    },
    {
      "categoryId": "0b7d4a9e-1c2f-4e8a-8f3d-5a6b7c8d9e10",
      "type": "Indoor",
      "durationHours": 2,
      "requiresDaylight": false,
      "maxWindMs": null,
      "maxRainMmPerHour": null,
      "minTemperatureC": null,
      "maxTemperatureC": null
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `activities` | array or null | 1 to 10 items; the same `categoryId` may appear more than once |
| `categoryId` | GUID string or null | |
| `type` | `"Indoor"`, `"Outdoor"` or null | The type the activity was added with |
| `durationHours` | number or null | |
| `requiresDaylight` | boolean | Missing means `false` |
| `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC`, `maxTemperatureC` | number or null | Required for Outdoor; ignored for Indoor |

- `200`: the checked activities, in request order, with the stored name and type:

  ```json
  {
    "activities": [
      { "categoryId": "6f1c2c1e-5d8c-4a5e-9b1a-2b7f0c3e9d41", "name": "Kayaking", "type": "Outdoor", "durationHours": 2.5, "requiresDaylight": true, "maxWindMs": 8, "maxRainMmPerHour": 0.5, "minTemperatureC": 18, "maxTemperatureC": 35 },
      { "categoryId": "0b7d4a9e-1c2f-4e8a-8f3d-5a6b7c8d9e10", "name": "Museum", "type": "Indoor", "durationHours": 2, "requiresDaylight": false, "maxWindMs": null, "maxRainMmPerHour": null, "minTemperatureC": null, "maxTemperatureC": null }
    ]
  }
  ```

- `400`: `ValidationProblemDetails`, title "One or more request fields are invalid.", with keys in the order from `data-model.md` (Validation rules):

  ```json
  {
    "errors": {
      "activities[0].durationHours": ["Enter a duration between 0.5 and 12 hours."],
      "activities[0].minTemperatureC": ["Minimum temperature must be lower than maximum temperature."],
      "activities[1]": ["This activity's category has changed. Remove it and add it again."]
    }
  }
  ```

  A body that is not valid JSON, a `categoryId` that is not a GUID or a string where a number belongs gives the existing `errors.request = ["The request is invalid."]`.
- `403`: see Authorization.

## Technical failure

Any unexpected exception, for example a database failure, gives the existing `500` problem details ("An unexpected error occurred."). The page shows "Error: Activity categories could not be loaded." (list) or "Error: Something went wrong. Try again." (check), each with Retry.

## Not provided

No endpoint stores a plan or changes a category.
