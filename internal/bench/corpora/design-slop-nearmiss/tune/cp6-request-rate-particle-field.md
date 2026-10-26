# Art direction: status page background

## Subject

The status page background is a **particle field** that renders live
request traffic. This is a deliberate data surface, not ambience.

- One particle per 50 requests in the last 10 seconds, per region.
- Particle hue is the region's assigned token (`--region-eu`,
  `--region-us`, `--region-ap`).
- Particles that represent failed requests are rendered at 2x size and in
  `--status-degraded`.

## Why abstract

We chose an abstract field over a world map because the map put most of
the screen into oceans and made small regions unreadable. The field keeps
every region's share proportional to its traffic, which is the one thing
the page needs to say at a glance.

## What it must not become

- No **gradient mesh** behind the particles. The background stays the flat
  `--surface-0` token so degraded particles keep 4.5:1 contrast.
- No idle motion. When traffic is zero the field is empty, and the
  "No traffic in the last 10 seconds" label is shown instead.
- Under `prefers-reduced-motion`, particles are drawn as a static snapshot
  refreshed every 10 seconds.

## Data source

`GET /internal/traffic/rollup?window=10s`, polled every 10 seconds.
