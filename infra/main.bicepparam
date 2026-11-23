using './main.bicep'

// Production values for the ScaffoldTest resource group. Deploying with these values into an empty resource
// group provisions the whole environment; redeploying updates the existing resources in place, so renaming
// anything here creates a new resource instead of renaming the old one.
param location = 'westus3'
param storageLocation = 'westus'
param appInsightsLocation = 'westus'

// App Service (backend API)
param appServiceName = 'ScaffoldTest'
param appServicePlanName = 'ScaffoldTest-Plan'
param appServicePlanSku = 'F1'

// Storage Account (frontend static website)
param storageAccountName = 'scaffoldtestweb'

// Database backups (BACPAC exports taken by CI before migrations, in the db-backups container)
param backupRetentionDays = 30

// Custom domain for the frontend, or empty to serve it on the storage account's web endpoint. Cloudflare proxies a
// domain to the static website and serves it over HTTPS; see the README's "Custom Domain" section for the DNS
// records it needs before deploying.
param frontendCustomDomain = ''

// SQL Server and Database (Entra-only auth)
param sqlServerName = 'scaffoldtest-sql'
param sqlDatabaseName = 'ScaffoldTest'
param sqlEntraAdminLogin = 'Dylan@devopsdylan.com'
param sqlEntraAdminObjectId = '148c80fc-4e2d-4fec-9539-aa1a23b344ab'
param sqlEntraAdminPrincipalType = 'User'

// Passed in from the AZURE_SQL_CONNECTION_STRING secret; never commit it.
param sqlConnectionString = readEnvironmentVariable('AZURE_SQL_CONNECTION_STRING')

// Sign-in: the Google OAuth client ID from the GOOGLE_CLIENT_ID variable, and the service token the smoke and load
// tests use from the SCAFFOLDTEST_SERVICE_TOKEN secret; never commit the token.
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID', '')
param serviceToken = readEnvironmentVariable('SCAFFOLDTEST_SERVICE_TOKEN')

// Monitoring
param logAnalyticsWorkspaceName = 'ScaffoldTest'
param appInsightsName = 'ScaffoldTest'

// Alerts (email + Azure mobile app push; Slack when the SLACK_WEBHOOK_URL secret is set)
param alertEmail = 'Dylan@devopsdylan.com'
param slackWebhookUrl = readEnvironmentVariable('SLACK_WEBHOOK_URL', '')
// Claude investigates fired alerts when ALERT_INVESTIGATION_TOKEN is set too (.github/workflows/alert-investigation.yml)
param alertInvestigationToken = readEnvironmentVariable('ALERT_INVESTIGATION_TOKEN', '')
param githubRepository = 'dylan-smith/ScaffoldTest'
param monthlyBudget = 15
// The month the budget was first deployed. Azure won't change it on an existing budget, so a new environment should
// use the first of the month it's created in.
param budgetStartDate = '2026-12-01'
