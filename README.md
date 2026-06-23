# llm-coding-evals

An ongoing evaluation of AI coding assistants on real-world software engineering tasks.

The goal is not to measure benchmark performance, but to assess how useful these systems are in practical development workflows.

## Current Test Suite (June 2026)

As of June 2026, the following evaluations are included:

| Test | Description |
|--------|-------------|
| Code Review | [View task](./2026.06/Tasks/task1_code_review.md) |
| Feature Implementation | [View task](./2026.06/Tasks/task2_feature_implementation.md) |


Additional tests may be added over time. Historical results remain available for comparison.

## Scoring

Each evaluation is scored using predefined criteria. The maximum possible score for the current test suite is **240 points** (100 for the code review and 140 for the feature implementation, bonus points included).

## 2026.06 Results (Current)
This test is focused on .NET backend development with a code review and a feature implementation.

Full results and a summary of both tests live in [2026.06.md](./2026.06/2026.06.md).

| Model | Score | Details |
|---------|---------|---------|
| GPT-5.5 | **106/240** | [Results](./Evaluations/gpt-5.5/gpt-5.5_results.md) |
| Composer-2.5 | **100/240** | [Results](./Evaluations/Composer-2.5/Composer-2.5_results.md) |
| MAI-Code-1-Flash | **78/240** | [results](./Evaluations/MAI-Code-1-Flash/MAI-Code-1-Flash-results.md) |
| GPT-5_mini | **63/240** | [Results](./Evaluations/GPT-5_mini/GPT-5mini_results.md) |


## Methodology

- All prompts are public.
- All scoring criteria are public.
- All model outputs are published.
- Tests are based on realistic software engineering tasks.
- Models are evaluated using the same instructions whenever possible.

One caveat: since the scoring criteria (including the expected findings for the code review) are published in this repo, a model with web access or trained on this repository could in theory look the answers up. Results are most meaningful for models evaluated before the tasks became part of their training data.

If a model scores the maximum (or close to it), we need a new test.

## Versioning

This repository evolves over time as new models and tasks become available.

The current benchmark version is:

**v2026.06**

Previous benchmark versions remain archived to preserve historical comparisons.