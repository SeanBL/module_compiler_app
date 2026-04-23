# HealthMAP Module Compiler

Deterministic Python compiler that converts **human-certified Word (.docx) learning blueprints**
into **runtime JSON** used to generate offline HTML/CSS/JS learning modules for the HealthMAP app.

## Design principles

- No AI rewriting or content generation
- Input is assumed to be final and human-approved
- Deterministic output (same input → same JSON)
- Runtime-oriented schema (slides, engages, quizzes)
- Safe to regenerate at any time

## Status

Early scaffold.
