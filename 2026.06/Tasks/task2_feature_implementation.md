# Feature implementation evaluation

Add a feature in the Distribt project


## Prompt

```
Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.

```

### LLM output
``` 
```

## Does not break anything - all 3 are needed -  10 points
- [] No errors
- [] Tests should pass
- [] The model should add tests for the code it has written

0 or 10 Points

## Behaviour - Implementation - (10 points each)
- [] endpoint creation to cancel an order
 - the endpoint must be either `POST cancel/{orderId}` or `PUT cancel` with the id on the body
- [] Result pattern - no exceptions are thrown.
- [] A cancelled order cannot be cancelled again
- [] Follows DDD principles
- [] Idempotency - it should not trigger another event.
- [] cancellation tokens everywhere
- [] can't cancel after dispatch. this should return some controlled error
- [] Domain handler for the domain event that publishes the integration event (it can be with a TODO)
- [] return the stock (this was behind a fake API)

X POINTS

## Bonus points - (10 points each)
- Created the infra (docker, RabbitMQ)
- Wire up the infrastructure for the integration event
- Write the fake API to return the stock.
- Mentions the outbox pattern

-X Points | NOTHING

## Penalties - 10 points
- Random AI slop

-X Points | Nothing


final result: **X/140**