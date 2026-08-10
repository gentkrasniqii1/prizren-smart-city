# Required GitHub configuration for production deploys (Phase 11)
#
# Repository variables (Settings → Variables):
#   ENABLE_VERCEL_DEPLOY=true     # unlocks deploy-web job on push to main
#   ENABLE_RAILWAY_DEPLOY=true    # unlocks deploy-api job on push to main
#
# Repository secrets (Settings → Secrets):
#   VERCEL_TOKEN
#   VERCEL_ORG_ID
#   VERCEL_PROJECT_ID
#   RAILWAY_TOKEN
#   RAILWAY_PROJECT_ID
#   RAILWAY_SERVICE_ID
#
# Optional app env (Vercel / Railway dashboards):
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SENTRY_DSN
#   DATABASE_URL, JWT_*, CLOUDINARY_*, ANTHROPIC_*, CORS_ORIGIN, SENTRY_DSN
