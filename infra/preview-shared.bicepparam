using './preview-shared.bicep'

// Values for the resources shared by every preview environment in the ScaffoldTest-Preview resource group. CI
// deploys these from the PR's base branch, so a change here reaches previews once it's merged.
param location = 'westus3'

param appServicePlanName = 'ScaffoldTest-Preview-Plan'
param appServicePlanSku = 'F1'
param sqlServerName = 'scaffoldtest-preview-sql'

// The scaffoldtest-preview-deploy managed identity (see README, Identities & Permissions)
param sqlEntraAdminLogin = 'scaffoldtest-preview-deploy'
param sqlEntraAdminObjectId = '3b08ccfb-cea1-4f64-8622-ca9096209f1b'
