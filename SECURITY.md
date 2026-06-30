# Security Policy

## Supported Versions

The current `0.1.x` release candidate is the supported line for security fixes.

## Reporting a Vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories for
this repository when available, or by opening a minimal issue that avoids
including credentials, customer details, private repository data, or sensitive
approval packets.

## Scope

`action-approval-skill` generates local dry-run approval packets. It does not
call external services, execute proposed actions, or approve side effects by
itself. Report issues where parsing, redaction boundaries, package contents, or
generated approval evidence could expose sensitive data or misrepresent action
risk.
