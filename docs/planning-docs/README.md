# DiscDock — Planning Documentation

DiscDock is a cross-platform-ready (Linux-first) Electron desktop application for cataloging external and removable media — optical discs (CD/DVD/Blu-ray), USB flash drives, external HDD/SSD drives, SD cards, and disc images (ISO) — so users can search "what's on that drive/disc?" without physically connecting it.

This directory contains the full planning package for handoff to a development team.

## Document Index

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Product Requirements Document](01-product-requirements.md) | Vision, goals, target users, scope, success metrics |
| 02 | [User Stories & Epics](02-user-stories.md) | Backlog of user stories with acceptance criteria |
| 03 | [Functional Requirements](03-functional-requirements.md) | Detailed feature-by-feature requirements |
| 04 | [Non-Functional Requirements](04-non-functional-requirements.md) | Performance, reliability, compatibility, accessibility |
| 05 | [Technical Specification](05-technical-specification.md) | Architecture, stack, module design, IPC, scanning engine |
| 06 | [Data Model](06-data-model.md) | Database schema, ERD, entity definitions |
| 07 | [UI/UX Specification](07-ui-ux-specification.md) | Screens, navigation, layout, interaction design |
| 08 | [Internal API / IPC Contract](08-api-internal-spec.md) | Main↔renderer IPC channels and payload contracts |
| 09 | [Packaging & Deployment](09-packaging-deployment.md) | electron-builder config, deb/AppImage build & release |
| 10 | [Security & Privacy](10-security-privacy.md) | Threat model, hardening, data handling |
| 11 | [Roadmap & Release Plan](11-roadmap.md) | MVP scope, phased releases, future ideas |
| 12 | [Glossary](12-glossary.md) | Terminology reference |
| 13 | [Help System Specification](13-help-system.md) | In-app contextual help panel: layout, content model, topics |
| 14 | [Initial Release Readiness Checklist](14-release-readiness-checklist.md) | Release blockers, acceptance evidence, and execution order |

## Product Snapshot

- **Name:** DiscDock
- **Platform (v1):** Linux only, packaged as `.deb` and `.AppImage`
- **Framework:** Electron (Chromium + Node.js)
- **Primary Use Case:** Catalog the contents of removable/external media so it can be searched, tagged, and located later without re-inserting the physical media.
- **Primary Users:** Home archivists, IT hobbyists, photographers/videographers with large backup collections, small offices/labs managing physical media libraries.

## How to Use This Package

Start with the [PRD](01-product-requirements.md) for context, then [User Stories](02-user-stories.md) for scope, then the [Technical Specification](05-technical-specification.md) and [Data Model](06-data-model.md) for implementation design. The [UI/UX Specification](07-ui-ux-specification.md) and [IPC Contract](08-api-internal-spec.md) are the primary references for building the renderer and main process respectively.
