# Code review for MAI-Code-1-Flash using copilot


- PR link: https://github.com/ElectNewt/Distribt/pull/55
- Date evaluated: 26 - June - 2026
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
 I would report the following findings:

  -------------------------------------------------------------------------------------------------------------------

   - Severity: Blocking
   - category: Logic error
   - filename and extension: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs
   - location: lines 27-31
   - one line root cause: The discount multiplier is computed with integer division because both operands are int, so most discounts resolve to 0.
   - impact: The new price-update flow will publish and apply a zero price for any non-zero discount, making the feature incorrect and potentially breaking product pricing.

  -------------------------------------------------------------------------------------------------------------------

   - Severity: Important
   - category: Logic error
   - filename and extension: src/Services/Products/Distribt.Services.Products.BusinessLogic/UseCases/UpdateProductPrice.cs
   - location: lines 33-38
   - one line root cause: The deduplication cache compares the incoming raw price instead of the computed discounted price, so a legitimate price change with the same base price is treated as a duplicate.
   - impact: A valid update can be silently skipped, leaving downstream systems and the warehouse price unchanged even though the caller requested a new price.

  -------------------------------------------------------------------------------------------------------------------

   - Severity: Important
   - category: Null handling / robustness
   - filename and extension: src/Services/Products/Distribt.Services.Products.BusinessLogic/DataAccess/ProductsReadStore.cs
   - location: lines 104-110
   - one line root cause: UpdateProductPrice dereferences the result of FirstOrDefaultAsync without checking whether a read-model document exists.
   - impact: A price-change event arriving before the read model is projected can throw and cause the consumer to fail instead of handling the update gracefully.

```

## Result

| Expected finding # | Description | Max points | Awarded points | Notes |
|--------------------|-------------|-----------:|---------------:|-------|
| 1 | Input validation | 8 | - |  |
| 2 | Return status code | 8 | - |  |
| 3 | CancellationToken | 4 | - |  |
| 4 | Int for division | 12 | 12 |  |
| 5 | Try catch swallows | 12 | - |  |
| 6 | Publishes event first | 12 | - |  |
| 7 | Money rounding | 8 | - |  |
| 8 | Static dictionary | 12 | - |  |
| 9 | Cache Key| 8 | 8 |  |
| 10 | Test validates nothing | 8 | - |  |
| 11 | Handler needs to validate the ID | 8 | 8 |  |

Subtotal: **28/100**

### Penalties

| Penalty reason | Description | Points deducted | Notes |
|----------------|-------------|----------------:|-------|
| T1 | flags the event as duplicated | (up to -20) | - |
| T2 | if #5 is flagged, this should be flagged too | (up to -20) | - |
| Other | any random AI thing | (up to -10) | - |

Penalty subtotal: **0**



Final score: **28/100**


## Cost (optional)
- time - aprox 5 minutes
- Tokens
 - Input 1.6M - (WTF)
 - output 17.8k
- monetary: 25.6 AIC (??)