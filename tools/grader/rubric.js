// Rubric configuration for the current benchmark version.
// When a new benchmark version ships, update this file (or swap it out).
const RUBRIC = {
  version: "2026.06",
  pr: { owner: "ElectNewt", repo: "Distribt", number: 55, link: "https://github.com/ElectNewt/Distribt/pull/55" },

  task1: {
    title: "Code Review",
    maxScore: 100,
    prompt: `You are reviewing this code change (last commit) before it merges. Identify every finding you would report on.
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
return in markdown format.`,
    expected: [
      { id: 1,  severity: "Important",   points: 8,  short: "Input validation",
        where: "ProductController.UpdateProductPrice",
        detail: "No input validation: negative Price, or DiscountPercentage <0 / >100 all accepted." },
      { id: 2,  severity: "Important",   points: 8,  short: "Return status code",
        where: "ProductController.UpdateProductPrice",
        detail: "Endpoint always returns 200 OK regardless of outcome or whether the product exists." },
      { id: 3,  severity: "Minor",       points: 4,  short: "CancellationToken",
        where: "ProductPriceChangedHandler.Handle",
        detail: "cancellationToken accepted but not passed to readStore.UpdateProductPrice(...)." },
      { id: 4,  severity: "Blocking",    points: 12, short: "Int for division",
        where: "UpdateProductPrice.Execute",
        detail: "(100 - request.DiscountPercentage) / 100 uses int division, which returns 0." },
      { id: 5,  severity: "Blocking",    points: 12, short: "Try catch swallows",
        where: "UpdateProductPrice.Execute",
        detail: "try { ModifySalesPrice } catch { } swallows the failure and returns true; price never changed." },
      { id: 6,  severity: "Blocking",    points: 12, short: "Publishes event first",
        where: "UpdateProductPrice.Execute",
        detail: "Publishes ProductPriceChanged before ModifySalesPrice; if the write fails the event is already out." },
      { id: 7,  severity: "Important",   points: 8,  short: "Money rounding",
        where: "UpdateProductPrice.Execute",
        detail: "Rounds money through double: (decimal)Math.Round((double)finalPrice, 2)." },
      { id: 8,  severity: "Blocking",    points: 12, short: "Static dictionary",
        where: "UpdateProductPrice (LastPublishedPrice)",
        detail: "static Dictionary<int, decimal> shared across concurrent requests; not thread-safe, memory issues." },
      { id: 9,  severity: "Important",   points: 8,  short: "Cache key",
        where: "UpdateProductPrice.Execute",
        detail: "Compares/stores request.Price but the value actually published/written is finalPrice." },
      { id: 10, severity: "Testing gap", points: 8,  short: "Test validates nothing",
        where: "UpdateProductPriceTests.Execute_AppliesPromotionalDiscount_AndUpdatesSalesPrice",
        detail: "The test validates nothing really; should suggest correct tests." },
      { id: 11, severity: "Important",   points: 8,  short: "Handler must validate ID",
        where: "ProductPriceChangedHandler.cs",
        detail: "Updates without verifying the ID exists, so it throws an exception." },
    ],
    traps: [
      { id: "T1", points: -20, short: "Flags event as duplicated",
        detail: "Publishing ProductPriceChanged to \"external\" may look duplicated, but domain events and integration events are different concerns. Do not flag." },
      { id: "T2", points: -20, short: "#5 flagged but its test not flagged",
        detail: "Execute_WhenWarehouseUpdateFails_StillReportsSuccess validates the bug from #5. If #5 is reported this test must be flagged too." },
    ],
    // default penalty for an incorrect finding, keyed by the severity the LLM claimed
    incorrectPenalty: { blocking: -8, important: -5, minor: -2, default: -2 },
    slopPenalty: -10, // full penalty; the ½ button gives -5
  },

  task2: {
    title: "Feature Implementation",
    maxScore: 140,
    prompt: `Add the ability to cancel an Order end to end.
- An order that has already been dispatched/delivered cannot be cancelled, return a sensible error.`,
    gate: {
      title: "Does not break anything — all 3 needed",
      points: 10,
      items: [
        { id: "g1", label: "No errors" },
        { id: "g2", label: "Tests should pass" },
        { id: "g3", label: "The model added tests for the code it has written" },
      ],
    },
    behaviour: {
      title: "Behaviour — Implementation",
      pointsEach: 10,
      items: [
        { id: "b1", label: "Endpoint creation to cancel an order", hint: "POST cancel/{orderId} or PUT cancel with the id in the body" },
        { id: "b2", label: "Result pattern — no exceptions are thrown" },
        { id: "b3", label: "A cancelled order cannot be cancelled again" },
        { id: "b4", label: "Follows DDD principles" },
        { id: "b5", label: "Idempotency — no extra event; it must generate the domain event" },
        { id: "b6", label: "Cancellation tokens everywhere" },
        { id: "b7", label: "Can't cancel after dispatch — controlled error" },
        { id: "b8", label: "Domain handler for the domain event publishing the integration event", hint: "a TODO is acceptable" },
        { id: "b9", label: "Returns the stock", hint: "this was behind a fake API" },
      ],
    },
    bonus: {
      title: "Bonus points",
      pointsEach: 10,
      items: [
        { id: "x1", label: "Created the infra (docker, RabbitMQ)" },
        { id: "x2", label: "Wired up the infrastructure for the integration event" },
        { id: "x3", label: "Wrote the fake API to return the stock" },
        { id: "x4", label: "Mentions the outbox pattern" },
      ],
    },
    penalty: { title: "Penalties", label: "Random AI slop", max: -10 },
  },
};
