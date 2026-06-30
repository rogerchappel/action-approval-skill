# Contributing

Thanks for helping improve `action-approval-skill`.

## Local Setup

```sh
npm install
npm run build
```

## Before Opening a PR

Run the broad release-readiness gate:

```sh
npm run release:check
```

For smaller iterations, use:

- `npm run check` for TypeScript validation.
- `npm test` for fixture-backed tests.
- `npm run smoke` for the maintained approval-packet fixture.
- `npm run package:smoke` for package contents review.

Keep examples local and synthetic. Do not add real credentials, customer data,
private repository details, or sensitive approval packets to fixtures or docs.
