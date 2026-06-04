# Web Pixel Setup

Use one web pixel provider for the public Attow, Inc. docs or landing page. Do not add Koala, RB2B, or other marketing pixels to the local Attow Nexus Console dashboard.

## Track A: Koala

- Create the Koala account manually.
- Prefer Google sign-up with `sharb1235@gmail.com`.
- Copy the JavaScript snippet from the Koala quickstart.
- Install only on the docs/landing page `<head>`.
- Verify in the Koala dashboard.
- Add privacy disclosure.
- Do not add to the local dashboard.

## Track B: RB2B

- Create the RB2B account manually.
- Prefer Google sign-up with `sharb1235@gmail.com`.
- Authorize the domain.
- Install the tracking script on the docs/landing page `<head>`.
- Verify the script.
- Add privacy disclosure.
- Do not add to the local dashboard.

## Recommendation

Start with either Koala or RB2B, not both, unless there is a deliberate A/B or lead-enrichment reason. Too many pixels can slow the landing page and raise privacy concerns.

## Runtime Boundary

Marketing pixels are for the hosted public web surface only. The Attow Nexus daemon, CLI, SDKs, local dashboard, and demo scripts should remain no-cloud and no-API-key by default.
