# Contributing to Ave

Thanks for contributing.

Ave is split into several packages rather than one root workspace, so the quickest way to be productive is to work inside the package you are changing and keep changes scoped to the relevant surface.

## Repository layout

- `ave-web` contains the main user-facing product UI
- `ave-server` contains the OAuth/OIDC API, auth flows, signing, encryption, uploads, and developer portal backend routes
- `ave-devs` contains the developer portal frontend
- `ave-docs` contains the public documentation
- `sdks/ave-sdk` contains the typed SDK
- `sdks/ave-embed` contains the browser embed package

## Before you start

- Read the root [README.md](./README.md) for a repo overview and local setup
- Check whether the work belongs to one package or several
- If your change affects behavior, keep the relevant docs in `ave-docs` in sync
- For security issues, do not open a public issue; use [SECURITY.md](./SECURITY.md)

## Development setup

Ave uses Bun. There is no root package manager workspace right now, so install dependencies inside the package you are editing.

Examples:

```bash
cd ave-server
bun install
bun run dev
```

```bash
cd ave-web
bun install
bun run dev
```

```bash
cd ave-devs
bun install
bun run dev
```

Common verification commands:

- `ave-server`: `bun run check`
- `ave-web`: `bun run check`, `bun run build`
- `ave-devs`: `bun run check`, `bun run build`
- `sdks/ave-sdk`: `bun run build`
- `sdks/ave-embed`: `bun run build:windows`

If you work on the API locally, copy the example env files in `ave-server` first and run the local D1 migrations:

```bash
cd ave-server
bun run db:migrate:local
```

## How to contribute

### Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- The package or area involved
- Steps to reproduce
- Screenshots, logs, or request/response details when relevant

### Proposing features

For larger features or product changes, open an issue first so the direction can be discussed before implementation starts.

### Sending pull requests

Please try to keep pull requests focused and easy to review.

Good pull requests usually:

- Change one thing or one connected group of things
- Follow the existing structure and patterns of the package being edited
- Update docs when behavior, setup, or developer-facing APIs change
- Include enough context in the description for reviewers to understand the why, not just the diff

## Style and review expectations

- Prefer small, clear changes over broad refactors
- Reuse existing components, helpers, and patterns where possible
- Do not add new conventions unless the change really needs them
- Keep user-facing copy and docs aligned with the product as it behaves today

## Documentation changes

If you touch any of the following, check whether `ave-docs` should be updated too:

- OAuth or OIDC flow behavior
- SDK APIs or examples
- Developer portal behavior
- Security, signing, connector, or encryption flows
- Local setup, env vars, or deployment-facing behavior

## Questions

If you are unsure where a change belongs, open an issue and describe the problem you are trying to solve before starting a large implementation.
