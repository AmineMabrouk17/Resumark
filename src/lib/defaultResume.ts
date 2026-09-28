/**
 * The example resume shipped with Resumark (PRD §37).
 * Demonstrates every supported Markdown construct used in a resume.
 */
export const DEFAULT_MARKDOWN = `# Amine Mabrouk

Full Stack Developer

[amine@example.com](mailto:amine@example.com) ·
[linkedin.com/in/amine](https://linkedin.com/in/amine) ·
[github.com/amine](https://github.com/amine) ·
[+33 6 12 34 56 78](tel:+33612345678)

## Summary

Full Stack Developer specialised in modern web applications using TypeScript,
Angular, Laravel and cloud technologies. Comfortable owning a feature from data
model to production, with a strong interest in developer experience and
reliability.

## Experience

### Full Stack Developer — Infraway

Jul 2025 — Present · Paris, France

- Developed customer-facing Angular applications with strict TypeScript typing.
- Built and documented Laravel REST APIs consumed by three product squads.
- Integrated S3-compatible object storage with signed uploads and lifecycle rules.
- Cut first-contentful-paint by 38 % through route-level code splitting.
- Introduced contract tests that removed recurring release regressions.
- Mentored two junior developers through their first production releases.

### Backend Developer — Northwind

Sep 2023 — Jun 2025 · Remote

- Migrated a legacy REST API to Laravel 11 with zero downtime.
- Designed MySQL schema changes and backfill scripts for 12 M+ rows.
- Automated deployments with Docker and GitHub Actions.
- Reduced p95 query latency by 61 % by rewriting the reporting queries.

## Projects

### Markdown Resume Builder

- Open source tool that turns Markdown into an ATS-friendly A4 resume.
- Designed the one-page compaction algorithm and the print stylesheet.
- Ships a byte-identical PDF text layer for every template.

### Design Tokens CLI

- Node tool that exports design tokens as CSS variables and Tailwind presets.

## Education

### Software Engineering — MSc

University of Paris, 2023

## Selected impact

| Area | Before | After |
| --- | --- | --- |
| First contentful paint | 3.4 s | 2.1 s |
| p95 API latency | 840 ms | 330 ms |
| Release regressions | 9 / quarter | 1 / quarter |

## Skills

**Languages:** TypeScript, JavaScript, PHP, SQL, Python, Bash

**Frontend:** Angular, React, Tailwind CSS, accessibility, performance

**Backend & infra:** Laravel, Node.js, PostgreSQL, MySQL, Redis, Docker, AWS

**Practices:** typed contracts, automated testing, trunk-based development

## Languages

French — Native · English — Professional (C1) · Arabic — Native
`;
