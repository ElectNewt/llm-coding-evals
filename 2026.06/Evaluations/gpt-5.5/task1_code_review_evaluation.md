# Code review for gpt5.5 using codex


- PR link: https://github.com/ElectNewt/Distribt/pull/55
- Date evaluated: 10 - June - 2026
- Version evaluated: [2026.06](./../../Tasks/task1_code_review.md)

## LLM Interaction
### Prompt
```
You are reviewing this code change (last commit) before it merges. Identify every finding you would report on.
For each finding do a report like the following: 
--
    - Severity (Blocking, important, minor)
    - category
    - filename and extension
    - location
    - one line root cause
    - impact
--
Do not fix anything, this is a review.
return in markdown format.
```

### copy&paste LLM output:
```
 ## Findings

  - Severity: Blocking
  - category: correctness
  - filename and extension: UpdateProductPrice.cs
  - location: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs:27
  - one line root cause: The discount multiplier is calculated with integer division before being assigned to decimal.
  - impact: Common discounts like 10 produce multiplier 0, so a 100m price is published and sent to the warehouse as
    0.00.

  ———

  - Severity: important
  - category: correctness
  - filename and extension: UpdateProductPrice.cs
  - location: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs:33-37
  - one line root cause: The duplicate suppression cache stores and compares only request.Price, ignoring the discounted
    final price.

  - impact: Updating the discount for the same base price is silently skipped, so no warehouse update or
    ProductPriceChanged event is sent.

  ———

  - Severity: important
  - category: concurrency / state management
  - filename and extension: UpdateProductPrice.cs
  - location: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs:16-37
  - one line root cause: Request handling uses a static mutable Dictionary<int, decimal> without synchronization.
  - impact: Concurrent price updates can race or throw, and behavior becomes process-local and inconsistent across
    multiple service instances.

  ———

  - Severity: important
  - category: data consistency
  - filename and extension: UpdateProductPrice.cs
  - location: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs:39-47
  - one line root cause: The domain event is published before the warehouse update, and warehouse failures are
    swallowed.

  - impact: The read model and external integrations can report a new product price even when the warehouse price update
    failed.

  ———

  - Severity: minor
  - category: build hygiene
  - filename and extension: Distribt.Tests.Services.Products.csproj
  - location: src/Tests/Services/Products/Distribt.Tests.Services.Products/Distribt.Tests.Services.Products.csproj:11-13
  - one line root cause: Microsoft.NET.Test.Sdk is referenced twice with different versions.
  - impact: Builds emit NU1504 duplicate package warnings and restore behavior may depend on package resolution order.
```

## Result

| Expected finding # | Description | Max points | Awarded points | Notes |
|--------------------|-------------|-----------:|---------------:|-------|
| 1 | Input validation | 8 |  |  |
| 2 | Return status code | 8 |  |  |
| 3 | CancellationToken | 4 |  |  |
| 4 | Int for division | 12 | 12 |  |
| 5 | Try catch swallows | 12 |  |  |
| 6 | Publishes event first | 12 | 12 |  |
| 7 | Money rounding | 8 |  |  |
| 8 | Static dictionary | 12 | 12 | it didnt raised the infinite growth of the cache |
| 9 | Cache Key| 8 | 8 |  |
| 10 | Test validates nothing | 8 |  |  |
| 11 | Handler needs to validate the ID | 8 |  |  |

Subtotal: **36/100**

### Penalties

| Penalty reason | Description | Points deducted | Notes |
|----------------|-------------|----------------:|-------|
| T1 | flags the event as duplicated | (up to -20) |  not flag |
| T2 | if #5 is flagged, this should be flagged too | (up to -20) | not flag, but #5 was not flag either  |


Penalty subtotal: **0**



Final score: **/100**


## Cost (optional)
- time - 3m 31s
- Tokens - 43.2k total
 - Input - 38.6k
 - output - 4.6k 
