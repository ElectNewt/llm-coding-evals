# Code review for Composer 2.5 through Cursor


- PR link: https://github.com/ElectNewt/Distribt/pull/55
- Date evaluated: 07 - june - 2026
- Version evaluated: [2026.06](./../../Tasks/task1_code_review.md)

## LLM Interaction
### Prompt
````
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
````


### copy&paste LLM output:
```
Finding 1
Severity: Blocking
Category: Correctness / Business logic
Filename and extension: UpdateProductPrice.cs
Location: Lines 27–28 (discountMultiplier calculation)
Root cause: (100 - request.DiscountPercentage) / 100 uses integer division before assignment to decimal.
Impact: Any discount percentage between 1 and 99 yields a multiplier of 0, so finalPrice becomes 0 instead of the discounted amount (e.g. 100 with 10% off becomes 0, not 90).

Finding 2
Severity: Blocking
Category: Testing / Build
Filename and extension: Distribt.Tests.Services.Products.csproj
Location: Package references (lines 14–15)
Root cause: xUnit v3 packages are referenced without a compatible dotnet test adapter/runner configuration used elsewhere in the repo.
Impact: dotnet test reports “No test is available” for this project; the two new tests never execute, giving false confidence in coverage.

Finding 3
Severity: Important
Category: Correctness / Deduplication logic
Filename and extension: UpdateProductPrice.cs
Location: Lines 33–37 (LastPublishedPrice check and assignment)
Root cause: Dedup cache keys and compares request.Price (list price), not the computed finalPrice or discount.
Impact: Same list price with a different DiscountPercentage is treated as unchanged and skips publish/warehouse update, leaving stale discounted prices in the read model and warehouse.

Finding 4
Severity: Important
Category: Concurrency
Filename and extension: UpdateProductPrice.cs
Location: Line 17 (private static readonly Dictionary<int, decimal> LastPublishedPrice)
Root cause: Shared mutable static Dictionary is accessed from scoped service instances without synchronization.
Impact: Concurrent price updates can cause race conditions, corrupted state, or InvalidOperationException under load in a multi-threaded ASP.NET host.

Finding 5
Severity: Important
Category: Data consistency
Filename and extension: UpdateProductPrice.cs
Location: Lines 39–48 (publish before warehouse; bare catch)
Root cause: Domain event is published first; warehouse failures are swallowed and the method always returns true.
Impact: Read model (via consumer) can reflect a new price while the warehouse still has the old one; API callers receive success with no indication of partial failure. Retries with the same list price are later blocked by the dedup cache (Finding 3).

Finding 6
Severity: Important
Category: Testing / Assertion quality
Filename and extension: UpdateProductPriceTests.cs
Location: Lines 11–23 (Execute_AppliesPromotionalDiscount_AndUpdatesSalesPrice)
Root cause: Test name claims discount verification, but ModifySalesPrice is verified with It.IsAny<decimal>() and publisher is never asserted.
Impact: The integer-division bug (Finding 1) passes this test; regressions in discount math and event publishing would go undetected.

Finding 7
Severity: Important
Category: Testing / Test isolation
Filename and extension: UpdateProductPrice.cs + UpdateProductPriceTests.cs
Location: UpdateProductPrice.cs line 17; tests at lines 19 and 34
Root cause: Static LastPublishedPrice persists across test runs in the same process.
Impact: Test order or parallel execution can cause flaky behavior (e.g. second call with same product id skips warehouse/publish unexpectedly).

Finding 8
Severity: Important
Category: Reliability / Error handling
Filename and extension: ProductPriceChangedHandler.cs + ProductsReadStore.cs
Location: Handler line 13; ProductsReadStore.UpdateProductPrice lines 104–109
Root cause: Handler calls UpdateProductPrice without checking entity existence; read store dereferences entity without a null guard.
Impact: Price update for a product missing from the Mongo read model throws NullReferenceException and fails message handling.

Finding 9
Severity: Important
Category: Input validation
Filename and extension: ProductDto.cs + UpdateProductPrice.cs
Location: UpdateProductPriceRequest record (line 13); Execute (lines 27–28)
Root cause: No bounds or sign validation on Price or DiscountPercentage.
Impact: Values such as discount > 100 or negative discount produce negative or inflated prices with no error response.

Finding 10
Severity: Important
Category: CI / Process
Filename and extension: build&Test.yml
Location: Test step (line 28)
Root cause: CI only runs Orders tests; the new Products test project is not included.
Impact: This feature and its tests are never exercised in the pipeline, even after fixing test discovery.

Finding 11
Severity: Important
Category: Observability
Filename and extension: UpdateProductPrice.cs
Location: Lines 45–47 (empty catch)
Root cause: Warehouse exceptions are caught and discarded with no logging or metric.
Impact: Production failures updating warehouse pricing are silent, complicating debugging and monitoring.

Finding 12
Severity: Minor
Category: Correctness / Precision
Filename and extension: UpdateProductPrice.cs
Location: Lines 30–31 (Math.Round via double)
Root cause: Monetary rounding uses double intermediate conversion instead of decimal rounding.
Impact: Potential floating-point rounding errors on edge-case decimal values before persisting price.

Finding 13
Severity: Minor
Category: Consistency
Filename and extension: ProductPriceChangedHandler.cs
Location: Line 13 (UpdateProductPrice call)
Root cause: cancellationToken is not forwarded to readStore.UpdateProductPrice, unlike sibling handlers (ProductCreatedHandler, ProductUpdatedHandler).
Impact: In-flight operations may not honor cancellation during shutdown or message retry scenarios.

Finding 14
Severity: Minor
Category: Consistency / Code style
Filename and extension: ProductPriceChangedHandler.cs
Location: Class declaration (lines 6–9)
Root cause: Primary-constructor syntax used while other handlers in the same folder use explicit fields and constructors.
Impact: Inconsistent style within the Consumer handlers folder; slightly harder maintenance for contributors following existing patterns.

Finding 15
Severity: Minor
Category: Project structure
Filename and extension: Distribt.Tests.Services.Products.csproj
Location: Project references (lines 23–24)
Root cause: Tests reference Api.Read and Api.Write web projects instead of BusinessLogic directly (pattern used by Orders tests).
Impact: Heavier test build graph and coupling to web host projects for pure business-logic unit tests.

Finding 16
Severity: Minor
Category: Consistency / Tooling
Filename and extension: Distribt.Tests.Services.Products.csproj
Location: xUnit package versions (lines 14–15)
Root cause: New project adopts xUnit v3 while existing test projects use xUnit 2.4.x.
Impact: Split test stack across the solution increases maintenance and adapter/configuration risk.

Finding 17
Severity: Minor
Category: Test coverage
Filename and extension: ProductPriceChangedHandler.cs, ProductController.cs
Location: New handler and UpdateProductPrice endpoint (lines 43–49)
Root cause: No tests added for consumer handler or API endpoint.
Impact: Integration path (domain message → read store update → external publish) and HTTP contract are unverified.

Finding 18
Severity: Minor
Category: Style
Filename and extension: Multiple (.cs)
Location: EOF of ProductController.cs, UpdateProductPrice.cs, ProductPriceChangedHandler.cs, ProductDto.cs, UpdateProductPriceTests.cs, Distribt.Tests.Services.Products.csproj
Root cause: Files end without a trailing newline (\ No newline at end of file in diff).
Impact: Minor diff noise; some editors/linters flag missing final newline.

Finding 19
Severity: Minor
Category: Process / Git hygiene
Filename and extension: N/A (commit metadata)
Location: Commit a05ee780 message
Root cause: Commit message llm-test-eval-pr does not describe the functional change.
Impact: Harder to trace history, review blame, and understand release notes.

```

## Result

| Expected finding # | Max points | Awarded points | Notes |
|--------------------|-----------:|---------------:|-------|
| 1 | 8 | 8 |  |
| 2 | 8 | 0 | not found |
| 3 | 4 | 4 |  |
| 4 | 12 | 12 |  |
| 5 | 12 | 12 |  |
| 6 | 12 | 0 | not found |
| 7 | 8 | 8 |  |
| 8 | 12 | 12 |  |
| 9 | 8 | 8 |  |
| 10 | 8 | 8 |  |
| 11 | 8 | 8 |  |

Subtotal: **80/100**

### Penalties

| Penalty reason | Points deducted | Notes |
|----------------|----------------:|-------|
| T1 | 0 |  |
| T2 | -20 |  |
| Finding 18 | -10 |  |

Penalty subtotal: **30**



Final score: **50/100**