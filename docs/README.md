# Documentation

This repository documents only what exists in this codebase. Historical plans for a
different Python project (`mcp-rooms`) are deliberately not included here.

Start with:

- [`../README.md`](../README.md) — feature list, API access rules, quick start.
- [`../AGENTS.md`](../AGENTS.md) — owner constraints and the honesty rules for agents.

## Strategy and Architecture

- [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md) — strategic product vision, agentic commerce fundamentals, hard problems, and GTM positioning.
- [`announcements/2026-11-02-marketplace-os-launch.md`](announcements/2026-11-02-marketplace-os-launch.md) — public launch announcement (Marketplace OS on top of MCP).
- [`announcements/2026-11-02-supplementary-nat-friendly-broker.md`](announcements/2026-11-02-supplementary-nat-friendly-broker.md) — architectural note on NAT-friendly broker topology vs raw A2A.
- [`agent_orchestration.md`](agent_orchestration.md) — protocol flow and actor roles.
- [`session_coordination.md`](session_coordination.md) — rules of engagement between agents.

## Proposals & Ecosystem Clients

- [`proposals/telegram-bot-kotelka.md`](proposals/telegram-bot-kotelka.md) — architecture specification and integration design for the «Хотелка» Telegram Bot client on top of Marketplace OS.

## Audit and plan

- [`final_production_roadmap.md`](final_production_roadmap.md) — 100% production readiness roadmap and status tracking.
- [`roadmap.md`](roadmap.md) — architectural and functional gap analysis, and open task breakdown.
- [`audit/2026-10-27-audit.md`](audit/2026-10-27-audit.md) — initial audit (P0/P1/P2 defect list).
- [`audit/2026-10-29-status-audit.md`](audit/2026-10-29-status-audit.md) — current audit and production readiness assessment (~88-90% RC1).
- [`audit/2026-10-28-pr3-access.md`](audit/2026-10-28-pr3-access.md) — access/isolation
  review for PR #3.
- [`audit/pr-plan.md`](audit/pr-plan.md) — bounded PR sequence from the audit.
- [`audit/comparison-with-mcp-rooms.md`](audit/comparison-with-mcp-rooms.md) and
  [`audit/integration-into-mcp-rooms.md`](audit/integration-into-mcp-rooms.md) —
  comparison/options notes; these describe another project and are **not** a plan for
  this repo.

## Runtime

- [`deployment.md`](deployment.md) — how to run the app with Docker Compose, with the
  caveats that matter (image build is CI-verified; no TLS, reverse proxy, or deployment).

## What is not documented as done

Do not treat the following as implemented just because they appear in old plans:
drafts/moderation, photo persistence, roles/scopes for keys, shared rate limiting across
instances (the current limiter is in-process), audit logs, live SSE negotiation, a public
production deployment, or real sales/demand data.
