# Feature implementation evaluation

- Date evaluated: 10 - june - 2026
- Version evaluated: [2026.06](./../../Tasks/task2_feature_implementation.md)


## Prompt

```
Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

```

### LLM output
``` 
Implemented end-to-end order cancellation.

  Changed:

  - Added OrderCancelled event and Cancelled status in src/Services/Orders/Distribt.Services.Orders/Events/
    OrderEvents.cs.

  - Updated OrderDetails to apply cancellation.
  - Added OrderCancelledService with:
      - 404 NotFound when the order does not exist.
      - 409 Conflict when already dispatched or delivered.
      - idempotent success when already cancelled.

  - Added PUT /Order/cancel in src/Services/Orders/Distribt.Services.Orders/Controllers/OrderController.cs.
  - Registered cancellation service in DI and Mongo event mappings.
  - Fixed markasdelivered to use OrderDeliveredService instead of dispatching again.
  - Added unit tests for cancel success, not found, dispatched/delivered conflict, and already-cancelled behavior.

  Verified:

  - dotnet build src\Services\Orders\Distribt.Services.Orders\Distribt.Services.Orders.csproj --no-restore
  - dotnet test
    src\Tests\Services\Orders\Distribt.Tests.Services.Orders.BusinessLogicTests\Distribt.Tests.Services.Orders.BusinessL
    ogicTests.csproj --no-restore
```

## Does not break anything - all 3 are needed -  10 points
- [x] No errors
- [x] Tests should pass
- [x] The model should add tests for the code it has written

10 or 10 Points

## Behaviour - Implementation - (10 points each)
- [x] endpoint creation to cancel an order
 - the endpoint must be either `POST cancel/{orderId}` or `PUT cancel` with the id on the body
- [x] Result pattern - no exceptions are thrown.
- [x] A cancelled order cannot be cancelled again
- [x] Follows DDD principles
- [] Idempotency - it should not trigger another event. -> itdoes not trigger an event
- [x] cancellation tokens everywhere
- [x] can't cancel after dispatch. this should return some controlled error
- [] Domain handler for the domain event that publishes the integration event (it can be with a TODO)
- [] return the stock (this was behind a fake API)

60 POINTS

## Bonus points - (10 points each)
- Created the infra (docker, RabbitMQ)
- Wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- Mentions the outbox pattern

 NOTHING

## Penalties - 10 points
- Random AI slop

 Nothing


final result: **70/140**