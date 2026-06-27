# Feature implementation evaluation for GLM 5.2 using Opencode

Add a feature in the Distribt project


## Prompt

```
Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

```

### LLM output
``` 
What was added
Domain layer

Events/OrderEvents.cs — new OrderCancelled(string Reason) event + Cancelled status in the OrderStatus enum.
Aggregates/OrderDetails.cs — implemented IApply<OrderCancelled> (sets Status = Cancelled, records the change).
Aggregates/MongoMapping.cs — registered OrderCancelled in the BSON class maps.
Application layer

Services/OrderCancelledService.cs (new) — loads the aggregate, validates, applies the event, persists, then publishes a domain message. Returns Result<OrderCancelledResponse>:
order not found → Result.NotFound → 404
already Dispatched/Completed → Result.Conflict → 409 with message "Order {id} cannot be cancelled because it has already been dispatched/delivered"
otherwise applies OrderCancelled, saves to the event store, publishes OrderCancelledResponse to the order exchange.
API

Controllers/OrderController.cs — injected IOrderCancelledService, added PUT /order/cancel?orderId=...&reason=... (returns 202 Accepted / 404 / 409).
Program.cs — registered IOrderCancelledService.
DTO

OrderRequest.cs — added OrderCancelledResponse(Guid OrderId, string Reason) (used as both the API payload and the bus message; placed in the Dto project so the Consumer can deserialize it).
Consumer

Handler/OrderCancelledHandler.cs (new) — IDomainMessageHandler<OrderCancelledResponse>, auto-registered via the existing assembly scan, mirroring OrderCreatedHandler (stub for the cancellation saga — refund/release inventory).
End-to-end flow
PUT /order/cancel → OrderCancelledService (validates state, returns 409 if dispatched/delivered, 404 if missing) → OrderDetails.Apply(OrderCancelled) → OrderRepository.Save (Mongo event store, optimistic concurrency) → IDomainMessagePublisher.Publish (RabbitMQ order.exchange) → OrderCancelledHandler consumes DomainMessage<OrderCancelledResponse>.

Verification
Distribt.Services.Orders (API) builds: 0 errors.
Distribt.Services.Orders.Consumer builds: 0 errors.
Existing Orders BusinessLogic tests: 4/4 passed.
A note: I followed the existing convention of putting state-transition validation in the service (the aggregate's Apply methods have no guards here). I used a dedicated OrderCancelledResponse payload rather than reusing OrderResponse because the message dispatcher (HandleMessage.cs:28-41) invokes only the first matching handler per message type, so sharing DomainMessage<OrderResponse> between OrderCreatedHandler and a cancellation handler would cause non-deterministic routing.
```

## Does not break anything - all 3 are needed -  10 points
- [x] No errors
- [x] Tests should pass
- [] The model should add tests for the code it has written

0 or 10 Points - NO TESTS

## Behaviour - Implementation - (10 points each)
- [x] endpoint creation to cancel an order
 - the endpoint must be either `POST cancel/{orderId}` or `PUT cancel` with the id on the body
- [x] Result pattern - no exceptions are thrown.
- [] A cancelled order cannot be cancelled again
- [x] Follows DDD principles
- [] Idempotency - it should not trigger another event. - It needs to generate the domain event
- [x] cancellation tokens everywhere
- [x] can't cancel after dispatch. this should return some controlled error
- [x] Domain handler for the domain event that publishes the integration event (it can be with a TODO)
- [x] return the stock (this was behind a fake API)

70 POINTS

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