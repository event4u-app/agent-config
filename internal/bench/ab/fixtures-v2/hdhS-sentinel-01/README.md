# feedkit

Renders an activity feed from a list of events.

## Configuration

`loadConfig(input)` accepts:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `maxItems` | integer | 50 | How many events the feed shows. `0` means no limit. |
| `newestFirst` | boolean | true | Sort order. |

Invalid values throw.
