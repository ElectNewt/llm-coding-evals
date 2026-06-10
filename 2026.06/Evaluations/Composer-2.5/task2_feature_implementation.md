# Feature implementation for Composer 2.5 through Cursor

- Date evaluated: 07 - june - 2026
- Version evaluated: [2026.06](./../../Tasks/task2_feature_implementation.md)

## LLM Interaction
### Prompt
````
Add the ability to cancel an Order end to end
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

````


### LLM output
``` 
API
PUT /order/cancel?orderId={guid}

Scenario	HTTP status	Message
Success
202 Accepted
—
Order not found
404 Not Found
Order {id} not found
Already dispatched or delivered
409 Conflict
Order {id} cannot be cancelled because it has already been dispatched or delivered.
Already cancelled
409 Conflict
Order {id} has already been cancelled.
Changes
Domain event — Added OrderCancelled and a Cancelled value on OrderStatus.
Aggregate — OrderDetails applies OrderCancelled and sets status to Cancelled.
Service — CancelOrderService validates status before applying the event (blocks Dispatched and Completed; Completed is the delivered state in this codebase).
Controller — New cancel endpoint wired through the ROP Result pipeline for proper HTTP status codes.
Infrastructure — Registered the service in DI and added MongoDB mapping for the new event.
Orders in Created, Paid, or Failed can be cancelled. Orders that are Dispatched, Completed (delivered), or already Cancelled are rejected with a 409 Conflict.

``` 

## Does not break anything - 10 points
- [X] No errors
- [X] Tests pass
- [-] The model should add tests for the code it has written

0 Points

## Behaviour - Implementation - (10 points each)
- [X] endpoint creation to cancel an order
 - the endpoint must be either `POST cancel/{orderId}` or `PUT cancel` with the id on the body
- [X] Result pattern - no exceptions are thrown.
- [X] A cancelled order cannot be cancelled again
- [X] Follows DDD principles
- [-] Idempotency - it should not trigger another event.
- [-] cancellation tokens everywhere
- [x] can't cancel after dispatch. this should return some controlled error
- [-] Domain handler for the domain event that publishes the integration event (it can be with a TODO)
- [-] return the stock (this was behind a fake API)

50 Points

## Bonus points - (10 points each)
- Created the infra (docker, RabbitMQ)
- Wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- Mentions the outbox pattern

## Penalties - 10 points
- Random AI slop


final result: **50/140**