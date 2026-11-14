# Repository Agent Rules

Before acting on repository work, read and apply the root [AGENTS.md](../../AGENTS.md). Follow its instruction precedence and authorization rules. This entry point applies to all repository workstreams.

For assigned Dev 2 work, also read the relevant ticket in [DEV2_TICKETED_IMPLEMENTATION.md](../DEV2_TICKETED_IMPLEMENTATION.md). Use [DEV2_IMPLEMENTATION_PLAN.md](../DEV2_IMPLEMENTATION_PLAN.md) for context and merge decisions, and confirm recorded checkout observations before relying on them.

This file points to the canonical instructions to keep future updates consistent.

## Remote Synchronization Baseline

Apply root AGENTS.md rule 28 before repository changes, including `git fetch origin` and integration of the relevant base through a normal merge. Follow root rule 2 for shared-history protection.

## Mandatory Pull Request Draft & Notification

Apply root AGENTS.md rule 29 when pushing or completing branch work. Prepare the draft from [.github/pull_request_template.md](../../.github/pull_request_template.md), include observed `npm test`, lint, type-check, and build evidence, and notify the developer to paste or update the description. Root AGENTS.md governs the full requirements and external-action authorization.
