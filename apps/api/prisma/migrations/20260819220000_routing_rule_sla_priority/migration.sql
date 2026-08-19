-- Admin-configurable routing: a rule may carry its own SLA and default priority
-- instead of inheriting them from the category/department fallback.

ALTER TABLE "RoutingRule" ADD COLUMN "slaHours" INTEGER;
ALTER TABLE "RoutingRule" ADD COLUMN "defaultPriority" "Priority";
