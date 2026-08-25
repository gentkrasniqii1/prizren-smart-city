# Production env (dashboards — not GitHub Actions)
#
# Render API:
#   Keep DATABASE_URL as the Neon pooled connection (`-pooler`). Do not replace it.
#   Add DIRECT_URL = Neon Console → Connection Details → Direct connection
#   (hostname without `-pooler`). Prisma migrate uses schema `directUrl`.
#
# Vercel web:
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SENTRY_DSN
#   Deploy is the Vercel GitHub integration, not this repo's CI workflow.
