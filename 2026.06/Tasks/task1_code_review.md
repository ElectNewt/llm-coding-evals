# Code review evaluation

> **HIDDEN. It is key that we do not show this to the LLM.** 

In the Distribt project there is a [PR](pending link) to be evaluated by the LLM
- PR #TODO
- Commit SHA TODO


## prompt
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

## Expected findings

| # | difficulty | Where | The bug / why it is wrong | Correct version |
|---|------------|-------|--------------------------|-----------------|
| 1 | Important |  `ProductController.UpdateProductPrice` | No input validation,  negative `Price`, or `DiscountPercentage` <0 / >100, all accepted; | Validate inputs;  |
| 2 | Important |  `ProductController.UpdateProductPrice` | The endpoint always returns 200 OK regardless of outcome or whether the product exists. | return 400/404 as appropriate |
| 3 | Minor | `ProductPriceChangedHandler.Handle` | `cancellationToken` is accepted but not passed to `readStore.UpdateProductPrice(...)`.  | `UpdateProductPrice(id, price, cancellationToken)` |
| 4 | Blocking | `UpdateProductPrice.Execute` | `(100 - request.DiscountPercentage) / 100` it uses ints for the division, which returns 0 | it should use deicmal |
| 5 | Blocking | `UpdateProductPrice.Execute` | `try { ModifySalesPrice } catch { }` swallows the failure and returns true but the price never changed. | Don't swallow; (or see note-1) |
| 6 | Blocking | `UpdateProductPrice.Execute` | Publishes `ProductPriceChanged` before applying the price via `ModifySalesPrice`. If the price write fails, the event is already out | Persist first, publish after (or see note-1)|
| 7 | Important | `UpdateProductPrice.Execute` | Rounds money through `double`: `(decimal)Math.Round((double)finalPrice, 2)`. | `Math.Round(finalPrice, 2)` on the `decimal` directly |
| 8 | Blocking | `UpdateProductPrice` (static `LastPublishedPrice` field) | A `static Dictionary<int, decimal>` shared across all concurrent requests/threads. `Dictionary<,>` is not thread-safe; and can cause memory issues | thread safe mechanisim |
| 9 | Important | `UpdateProductPrice.Execute` | compares and stores `request.Price` but the value actually published and written downstream is `finalPrice`. | Key the guard on the effective `finalPrice`, not `request.Price` |
| 10 | Testing Gap |  `UpdateProductPriceTests.Execute_AppliesPromotionalDiscount_AndUpdatesSalesPrice` |  validates nothing really | suggest correct tests |
| 11 | Important | ProductPriceChangedHandler.cs updates without verifiying the ID exist. | returns an exemption | raises the concern  |

## Trap / expected non-finding

| # | Penalty | Where | Non-bug | Correct reviewer behavior |
|---|--------:|-------|---------|---------------------------|
| T1 | -20 | `ProductPriceChangedHandler.Handle` | Publishing `ProductPriceChanged` to `"external"` may look duplicated, but domain events and integration events are different concerns. | Do not flag this |
| T2 | -20 | `UpdateProductPriceTests.Execute_WhenWarehouseUpdateFails_StillReportsSuccess` | if #5 is reported this should be flag as it is validating the bug  | flag to do it properly |

## Alternative acceptable solutions

Findings 5 and 6 may be solved in more than one valid way:

- move warehouse synchronization into a domain event handler;
- introduce an outbox pattern;
- make warehouse synchronization asynchronous;
- persist first and publish after, if that fits the architecture.

## Scoring

Maximum score: 108.

### Positive scoring

- Blocking finding correctly identified: `+14`
- Important finding correctly identified: `+8`
- Minor finding correctly identified: `+4`
- Testing gap correctly identified: `+8`
- Partial or vague finding: half points
- Same root cause reported multiple times: score once only

### Negative scoring

- Falls for the trap: `-20`
- Incorrect blocking finding: `-8`
- Incorrect important finding: `-5`
- Incorrect minor/nit finding: `-2`
- Incorrect explanation for an otherwise valid issue: up to `-50%`
- Any other Random AI stuff `-5` or `-10` depnding on how bad the suggestion is.


## Severity definitions

### Blocking

A finding that should prevent merge because it can cause incorrect business behavior, data inconsistency, lost updates, incorrect money calculations, concurrency bugs, or false success.

### Important

A finding that should be fixed before or soon after merge because it affects API correctness, test reliability, precision, observability, maintainability, or edge-case behavior.

### Minor

A real issue with limited blast radius, such as cancellation propagation or small consistency issues.

### Testing gap

A missing test that is important because the PR introduced new behavior or fixed-risk paths.



## Grading worksheet (Template)
#Code review for [model] 

- Repository:
- PR link:
- Date evaluated:
- Version evaluated:

## LLM Interactrion
### Prompt


### copy&paste LLM output:
```
PASTE THE OUTPUT OF THE MODEL HERE
```

## Result

| Expected finding # | Max points | Awarded points | Notes |
|--------------------|-----------:|---------------:|-------|
| 1 | 8 |  |  |
| 2 | 8 |  |  |
| 3 | 4 |  |  |
| 4 | 14 |  |  |
| 5 | 14 |  |  |
| 6 | 14 |  |  |
| 7 | 8 |  |  |
| 8 | 14 |  |  |
| 9 | 8 |  |  |
| 10 | 8 |  |  |
| 11 | 8 |  |  |

Subtotal: **/108**

### Penalties

| Penalty reason | Points deducted | Notes |
|----------------|----------------:|-------|
| T1 | (up to -20) |  |
| T2 | (up to -20) |  |
| Other |  |  |

Penalty subtotal: **0**



Final score: **/100**


## Cost
- time
- Tokens
 - Input
 - output
- monetary

