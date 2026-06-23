# Feature implementation evaluation

- Date evaluated: 23 - june - 2026
- Version evaluated: [2026.06](./../../Tasks/task2_feature_implementation.md)


## Prompt

```
Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

```

### LLM output
``` 

● The feature is implemented and tested; I’m marking the task complete in-session and capturing the exact behavior change for handoff.

✔ Todo completed cancel-order

● Implemented end-to-end order cancellation.

   - Added PUT /Order/cancel?orderId=... to the orders service.
   - Orders can now be cancelled from created/paid states, and cancelling an already dispatched/delivered order returns a 409 Conflict with a clear message.
   - Added a new OrderCancelled event and Cancelled status in the aggregate, plus DI registration and unit tests covering success and rejection cases.
   - I also fixed the delivered endpoint so it uses the correct delivered-service flow.
   - Verified with:
   dotnet test src\Tests\Services\Orders\Distribt.Tests.Services.Orders.BusinessLogicTests\Distribt.Tests.Services.Orders.BusinessLogicTests.csproj


```

## Does not break anything - all 3 are needed -  10 points
- [x] No errors
- [x] Tests should pass
- [x] The model should add tests for the code it has written

10 or 10 Points

## Behaviour - Implementation - (10 points each)
- [x] endpoint creation to cancel an order
 - the endpoint must be either `POST cancel/{orderId}` or `PUT cancel` with the id on the body
- [] Result pattern - no exceptions are thrown. RESULT: uses result pattern (wrongly) and it throws exemptions
- [x] A cancelled order cannot be cancelled again
- [x] Follows DDD principles
- [] Idempotency - it should not trigger another event. - It needs to generate the domain event
- [] cancellation tokens everywhere
- [x] can't cancel after dispatch. this should return some controlled error
- [] Domain handler for the domain event that publishes the integration event (it can be with a TODO)
- [] return the stock (this was behind a fake API)

40 POINTS

## Bonus points - (10 points each)
- Created the infra (docker, RabbitMQ)
- Wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- Mentions the outbox pattern

 NOTHING

## Penalties - 10 points
- Random AI slop

 Nothing


final result: **50/140**