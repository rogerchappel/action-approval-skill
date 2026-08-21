# Changelog

## [Unreleased]

- Ignore example headings inside fenced code when validating packet structure.
- Add release-readiness checks for package metadata, pack contents, and CI verification.
- Reject invalid proposal shapes and require standalone packet section headings.
- Reject unstructured or incomplete proposals that lack a non-empty action or summary.
- Reject approval packets whose required semantic sections have no content.
- Keep generated packet structure coherent when proposal values contain line
  breaks or Markdown heading text.
## 0.1.0

- Initial release candidate for the local approval packet CLI and skill.
- Includes fixture-backed dry-run packet generation for Slack, CRM, GitHub, and
  repository-push proposal shapes.
- Adds release-readiness checks for type checking, tests, fixture smoke, and
  dry-run package contents review.
- Adds explicit package metadata readiness validation and CLI version smoke
  coverage for release-candidate review.
