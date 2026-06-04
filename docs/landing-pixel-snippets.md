# Landing Pixel Snippets

Attow Nexus does not currently include a separate public docs or landing site in this repository. Do not add marketing pixels to the local Attow Nexus Console dashboard.

Use this file when adding tracking to an external Attow, Inc.-owned docs or landing page. Start with one provider, not both, unless there is a deliberate comparison or lead-enrichment reason.

## Environment Flags

```bash
ATTOW_NEXUS_ENABLE_MARKETING_PIXEL=false
ATTOW_NEXUS_WEB_PIXEL_PROVIDER=none
ATTOW_NEXUS_KOALA_SNIPPET_ID=
ATTOW_NEXUS_RB2B_SCRIPT_ID=
```

Only load a marketing pixel when:

- The page is an owned public docs or landing page.
- `ATTOW_NEXUS_ENABLE_MARKETING_PIXEL=true`.
- The page includes a visible privacy disclosure linking to `PRIVACY.md` or the hosted privacy page.

## Koala Placeholder

Add the Koala script to the external docs/landing page `<head>` only after manual account setup.

```html
<!-- KOALA PIXEL GOES HERE -->
```

## RB2B Placeholder

Add the RB2B script to the external docs/landing page `<head>` only after manual account setup and domain authorization.

```html
<!-- RB2B PIXEL GOES HERE -->
```

## Do Not Track Local Developer Tools

The local dashboard is a developer tool used to inspect captured logical state. It must not load Koala, RB2B, or other marketing pixels by default.
