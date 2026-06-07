# Feature implementation for GPT-5 mini through Copilot

- Date evaluated: 07 - june - 2026
- Version evaluated: [2026.06](./../../Tasks/task2_feature_implementation.md)

## LLM Interactrion
### Prompt
````
Add the ability to cancel an Order.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

````


### LLM output? thinking what to do here
``` 
What changed

   - Added OrderCancelled event and Cancelled status (Events/OrderEvents.cs).
   - Order aggregate now handles OrderCancelled and sets Status = Cancelled (Aggregates/OrderDetails.cs).
   - New OrderCancelService that applies cancellation and saves; it throws InvalidOperationException if order.Status is Dispatched or Completed (Services/OrderCancelService.cs).
   - OrderController gains a cancel endpoint (PUT /Order/cancel?orderId={id}). Controller returns 400 Bad Request with a message when cancellation is not allowed.

  Behavior

   - PUT /Order/cancel?orderId={guid} cancels an order unless it's already dispatched or delivered (Completed); then returns 400 with a clear message.

  Committed changes to the repo.

```
x correct 
- incorrect

## Does not break anything - 10 puntos
- [X] No errors
- [X] Test should pass
- [-] The model should add test of the code it has written\

0 points


## Bbehaviour - Implementation - (10 points each)
- [X] endpoint creation to cancel order
 - the endpoint must be either `POST cancel\{orderID}` or `PUT cancel` and the id on the body
- [-] Result pattern - no exemptions are thrown.
- [-] A canceled order cannot be cancelled again
- [X] Follow DDD princples
- [-] Idempotency - it should to trigger another event.
- [X] cancellation tokens everywere 
- [-] cant cancel after dispatch. this should return some controlled error - It throws an exemption 
- [-] Domain handler for the domain event that publishes the integration event (It can be with a TODO)
- [-] return the stock (this was behind a fake API)

30 points.


## Bonus points - (10 points each)
- Created the infra (docker, rabbitMQ)
- wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- mentions outbox pattern

Nothing.

## Penalties - 10 points
- Random AI slop

NOTHING.


final result: **30/140**