# Activity Categories API Contract

All failures use the ASP.NET Core problem-details format (`application/problem+json`), as in `specs/002-user-login/contracts/auth-api.md`. Messages have no display prefix; the frontend adds "Error: ".

Every endpoint requires a signed-in **Active Administrator** (policy `ActiveAdministrator`, research section 1). The sign-in cookie is the one from feature 002.

## Authorization

| Caller | Every endpoint below |
|---|---|
| Visitor (no cookie, or an expired one) | `401`, empty body |
| Active Registered User | `403` |
| Suspended Registered User | `403` |
| Suspended Administrator | `403` |
| Active Administrator | Handled as described below |

The check reads the account from the database on every request, so a role or status change applies at once.

Exception: the `{id}` routes only match a GUID (`{id:guid}`). An address with an id that is not a GUID matches no endpoint, so routing answers `404` before authorization runs, for every caller including a visitor. No category data is involved, so this reveals nothing. Likewise a method the API does not provide (for example `DELETE`) answers `405` for every caller. Authorization is checked before the body is read: a refused caller never gets validation messages or category data.

## Category object

Returned by every successful call.

```json
{
  "id": "6c1f0d1e-6a43-4b8e-9d0a-1f2a3b4c5d6e",
  "name": "Kayaking",
  "type": "Outdoor",
  "defaultDurationHours": 2.0,
  "requiresDaylight": true,
  "maxWindMs": 8.0,
  "maxRainMmPerHour": 0.5,
  "minTemperatureC": 15.0,
  "maxTemperatureC": 35.0,
  "placeTags": ["leisure=slipway", "sport=canoe"],
  "version": 1042
}
```

- `type` is `"Indoor"` or `"Outdoor"`.
- For an Indoor category, `maxWindMs`, `maxRainMmPerHour`, `minTemperatureC` and `maxTemperatureC` are `null`.
- `placeTags` is the normalized list (spaces removed, empty entries dropped, duplicates removed, entered order kept).
- `version` must be sent back unchanged when the category is updated.

## List categories

```http
GET /api/admin/categories
```

`200 OK` with an array of category objects ordered by name without regard to letter case. An empty array when there are no categories.

## Get one category

```http
GET /api/admin/categories/{id}
```

`200 OK` with the category object; used by "Reload" after a conflict. `404` problem details when there is no category with that id. An `id` that is not a GUID also gives `404`.

## Create a category

```http
POST /api/admin/categories
Content-Type: application/json
```

```json
{
  "name": "Swimming",
  "type": "Outdoor",
  "defaultDurationHours": 2,
  "requiresDaylight": true,
  "maxWindMs": 8,
  "maxRainMmPerHour": 0.5,
  "minTemperatureC": 18,
  "maxTemperatureC": 35,
  "placeTags": "leisure=bathing_place, sport=swimming"
}
```

- `placeTags` is the text as the administrator typed it.
- For `"type": "Indoor"`, the four weather fields may be missing or `null`; any values sent are ignored and stored as `null`.
- A missing or `null` number field counts as missing. The frontend sends `null` for text that is not a number.

`201 Created` with the category object and a `Location` header `/api/admin/categories/{id}`.

## Update a category

```http
PUT /api/admin/categories/{id}
Content-Type: application/json
```

The same body as create, plus `"version"` from the category object the form was opened with.

- `200 OK` with the updated category object and its new `version`.
- `404` problem details when there is no category with that id.
- `409` (below) when `version` is not the stored version.

## Validation failure (create and update)

```http
400 Bad Request
```

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": {
    "name": ["A category with this name already exists."],
    "maxWindMs": ["Enter a wind limit between 0 and 30 m/s."],
    "placeTags": ["Enter tags in the form key=value, for example leisure=slipway."]
  }
}
```

Every failing field is returned at once, one message per field, in this key order:

| Key | Messages |
|---|---|
| `name` | "Enter a category name." (missing, empty or only spaces) · "Category name must be between 2 and 60 characters." · "A category with this name already exists." (another category has the same name without regard to letter case and spaces around it) |
| `type` | "Select a type." (missing, or not `"Indoor"` / `"Outdoor"`) |
| `defaultDurationHours` | "Enter a duration between 0.5 and 12 hours." (missing, outside 0.5 to 12, or not a multiple of 0.5) |
| `maxWindMs` | "Enter a wind limit between 0 and 30 m/s." (Outdoor only: missing, outside 0 to 30, or more than one decimal place) |
| `maxRainMmPerHour` | "Enter a rain limit between 0 and 20 mm/h." (Outdoor only, same rules, 0 to 20) |
| `minTemperatureC` | "Enter a minimum temperature between -30 and 45 °C." (Outdoor only, same rules, -30 to 45) · "Minimum temperature must be lower than maximum temperature." (both temperatures valid on their own, minimum not lower) |
| `maxTemperatureC` | "Enter a maximum temperature between -30 and 45 °C." (Outdoor only, same rules, -30 to 45) |
| `placeTags` | "Enter tags in the form key=value, for example leisure=slipway." (missing, no pair left after removing empty entries, or any entry is not `key=value` with a key and value of letters, digits, `_`, `:` and `-` only) · "Map place tags can be at most 200 characters." (the text as sent is longer than 200 characters) |

A body that is not valid JSON, or has a value of the wrong JSON type (for example a string for `maxWindMs`), returns `errors.request` = `["The request is invalid."]`, as in features 001 and 002. A form-encoded body returns `415`. Nothing is stored when validation fails.

## Changed by someone else

```http
409 Conflict
```

```json
{
  "title": "This category was changed by someone else. Reload it and try again.",
  "status": 409,
  "detail": "This category was changed by someone else. Reload it and try again."
}
```

Returned by update when the `version` sent is not the stored version, including when another save is committed between the check and the write (spec FR-026). Nothing is stored. The order of checks on update is: field rules (`400`), the category exists (`404`), the version matches (`409`), the name is not used by another category (`400` on `name`). So a request with invalid fields gets `400` even if its version is old, and a stale request is refused before its name is compared.

## Not found

```http
404 Not Found
```

```json
{
  "title": "Category not found.",
  "status": 404,
  "detail": "Category not found."
}
```

The frontend shows its general server error message for this case and reloads the list (spec Edge Cases).

## Technical failure

`500` problem details from the existing `ApiExceptionHandler`, which logs the exception type only. No technical details are returned.

## Not provided

There is no `DELETE` endpoint (spec FR-023) and no endpoint for visitors or Registered Users; feature 005 adds a public read endpoint for activity selection.
