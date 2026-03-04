# Events & Outbox

::: info
This section is under development.
:::

Medipal uses CloudEvents and the transactional outbox pattern for reliable event-driven communication.

## CloudEvents

Domain events are published as CloudEvents, providing a standardised envelope format for inter-service communication.

## Outbox Pattern

Events are written to an outbox table within the same database transaction as the business operation, ensuring at-least-once delivery.

## Event Consumers

Consumers process events asynchronously, enabling decoupled reactions to domain changes such as notifications, audit logging, and workflow triggers.
