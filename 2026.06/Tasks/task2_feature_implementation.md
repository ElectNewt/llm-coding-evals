# Feature implementation evaluation

Add a feature in the Distribt project


## Prompt

```
Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

```

## Does not break anything - 10 puntos
- [] No errors
- [] Test should pass
- [] The model should add test of the code it has written


## Bbehaviour - Implementation - (10 points each)
- [] endpoint creation to cancel order
 - the endpoint must be either `POST cancel\{orderID}` or `PUT cancel` and the id on the body
- [] Result pattern - no exemptions are thrown.
- [] A canceled order cannot be cancelled again
- [] Follow DDD princples
- [] Idempotency - it should to trigger another event.
- [] cancellation tokens everywere 
- [] cant cancel after dispatch. this should return some controlled error
- [] Domain handler for the domain event that publishes the integration event (It can be with a TODO)
- [] return the stock (this was behind a fake API)



## Bonus points - (10 points each)
- Created the infra (docker, rabbitMQ)
- wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- mentions outbox pattern

## Penalties - 10 points
- Random AI slop