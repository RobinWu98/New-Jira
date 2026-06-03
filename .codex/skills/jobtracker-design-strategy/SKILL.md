---
name: jobtracker-design-strategy
description: Use this skill when designing, extending, or reviewing UI pages or project files in the NewJira/jobTracker app. It fixes the product's design strategy to match the existing pages: editorial paper surfaces, Georgia typography, strong black borders, hard shadows, compact account-workflow layouts, accessible forms, restrained functional copy, and an English-only project-file policy.
---

# jobTracker Design Strategy

## Purpose

Use this skill before making frontend changes in this repository. Preserve the current jobTracker visual system and extend it with the same practical, document-like style already present in the app.

## Language Policy

Project files must be English-only. Do not add Chinese text to source code, UI copy, comments, CSS, SQL, environment examples, documentation, tests, commit messages prepared inside the project, or any other repository file.

If the user communicates in Chinese, you may respond to the user in Chinese, but any content written into this repository must be in English. Translate requested Chinese copy into concise English before editing files.

## Read First

Inspect the current UI before changing it:

- `app/globals.css` for tokens, spacing, borders, focus states, forms, notices, and responsive behavior.
- Existing route pages under `app/*/page.tsx` for page structure and copy tone.
- `components/AuthForms.tsx` and `components/FormStatus.tsx` for reusable form and button patterns.

## Core Strategy

Design jobTracker as a plainspoken account and workflow tool with a tactile paper interface. It should feel like a sturdy printed desk form brought onto the web: readable, direct, accessible, and slightly editorial.

Do not redesign it into a glossy SaaS dashboard, marketing landing page, glassmorphism layout, gradient-heavy app, rounded card system, or generic Tailwind-style interface.

## Visual Rules

- Keep the page skeleton: `<main className="page">`, `.shell`, `.masthead`, then one or more `.panel` sections.
- Use the existing palette variables from `app/globals.css`: `--bg`, `--paper`, `--ink`, `--muted`, `--line`, `--focus`, `--danger`, `--ok`, `--button`, and `--button-text`.
- Maintain the warm paper background and off-white panels.
- Use Georgia / Times-style serif typography unless there is a specific product reason to add a new type style.
- Keep borders strong and literal: 3px solid black for panels, controls, notices, and table-like surfaces; heavy double black borders for mastheads.
- Use hard offset shadows sparingly, matching `.panel` and `.button`. Avoid blur shadows.
- Use square or near-square corners. Do not introduce pill buttons, rounded cards, or soft container chrome.
- Keep focus states highly visible with the yellow outline pattern already defined.

## Layout Rules

- Favor one-column, form-first layouts with clear vertical rhythm.
- Keep content constrained by `.shell`; avoid full-bleed decorative sections.
- Use `.panel` for primary content groups, `.notice` for important status or guidance, `.table-like` for key-value account details, and `.button-row` for actions.
- On mobile, preserve the existing simplification pattern: reduced padding, no panel shadow, and single-column table rows.
- Avoid nested cards and decorative wrapper layers. If a section needs grouping, use one panel or a table-like block.

## Interaction Rules

- Buttons should use `.button`; secondary actions should use `.button.secondary`.
- Links can remain text links when they are navigation or secondary account actions.
- Forms should keep explicit labels, native inputs, proper autocomplete attributes, required/minLength constraints where relevant, and server action feedback through notices.
- Errors use `.notice.error`; successful outcomes use `.notice.success`; general warnings or instructions use `.notice`.
- Disabled/loading states should not move layout or resize buttons.

## Copy Rules

- Keep copy short, concrete, and operational.
- Use Title Case for page headings and action labels, matching existing pages.
- Prefer honest status text over promotional language, for example "The basic account system is active" rather than a marketing claim.
- Mention implementation limits plainly when needed, as existing pages do for development reset links and future verification.

## When Adding New Screens

Start from this structure:

```tsx
<main className="page">
  <div className="shell">
    <header className="masthead">
      <h1>Svida Job Tracker</h1>
      <p>Short operational context for this screen.</p>
    </header>
    <section className="panel">
      <h2>Screen Title</h2>
      {/* notices, forms, table-like details, or workflow content */}
    </section>
  </div>
</main>
```

Add new CSS only when existing classes cannot express the need. If new CSS is necessary, extend the current vocabulary: paper surfaces, strong lines, clear spacing, hard shadows, and accessible focus states.

## Review Checklist

Before finishing UI work, check:

- The screen still looks native to the existing jobTracker pages.
- No gradients, blur shadows, glass effects, pill controls, oversized marketing heroes, or unrelated decorative imagery were introduced.
- Text fits on mobile and desktop.
- Keyboard focus is obvious on links, buttons, and inputs.
- Form feedback is visible, semantic enough, and uses existing notice styles.
- The implementation reuses existing classes before adding new ones.
