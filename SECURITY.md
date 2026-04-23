# Security Policy

## Supported versions

Ave is an actively developed project, and security fixes are applied to the current code on the default branch.

Because this repository contains the hosted product, API, developer portal, SDKs, and docs in one place, we do not maintain long-term security support branches for older snapshots.

If you believe you have found a security issue, please test against the latest code in this repository before reporting it.

## Reporting a vulnerability

Please do not open public GitHub issues, pull requests, discussions, or documentation edits for suspected security vulnerabilities.

Instead, email the details to:

- `security@lantharos.com`

Include as much of the following as you can:

- A clear description of the issue and why it is security-sensitive
- The affected package or surface, such as `ave-server`, `ave-web`, `ave-devs`, `sdks/ave-sdk`, or `sdks/ave-embed`
- Reproduction steps, proof of concept, or a minimal test case
- Any environment or configuration details needed to reproduce the issue
- Your assessment of impact, affected users, or likely attack scenarios

If you already have a fix in mind, you can include it in the report, but please do not publish it before we have had a chance to investigate.

## What to expect

We will review reports as quickly as we can and follow up by email when we need more detail.

When a report is confirmed, the general process is:

1. Reproduce and scope the issue
2. Prepare and test a fix
3. Coordinate release timing
4. Publish the fix and any follow-up guidance

We ask that you keep the report private until a fix is available or we agree on a disclosure timeline together.

## Out of scope

The following are usually not treated as security vulnerabilities by themselves:

- Requests for general hardening advice without a concrete vulnerability
- Reports that only affect unsupported, modified, or outdated local deployments
- Missing best-practice headers or configuration recommendations with no practical exploit path
- Issues that require access you already control unless they expose additional privilege, data, or execution paths

If you are unsure whether something qualifies, send the report anyway and we will take a look.
