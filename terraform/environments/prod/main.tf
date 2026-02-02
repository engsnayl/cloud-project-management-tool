# terraform/environments/prod/main.tf
#
# Production environment - mirrors staging with production-grade settings.
# NOT deployed yet. This file exists so the Terraform config is complete
# and can pass validation in CI/CD.

# Common locals for the environment
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner_email
  }
}

# Data source for Route53 hosted zone
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# ─────────────────────────────────────────────
# Networking
# ─────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  project_name            = var.project_name
  environment             = var.environment
  cidr_block              = var.vpc_cidr
  public_subnet_count     = var.public_subnet_count
  private_subnet_count    = var.private_subnet_count
  enable_nat_gateway      = var.enable_nat_gateway
  enable_flow_logs        = var.enable_flow_logs
  flow_log_retention_days = var.log_retention_days

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────

module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name                  = var.project_name
  environment                   = var.environment
  enable_point_in_time_recovery = var.enable_point_in_time_recovery
  deletion_protection           = var.deletion_protection

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────

module "s3" {
  source = "../../modules/s3"

  project_name            = var.project_name
  environment             = var.environment
  enable_versioning       = var.enable_versioning
  enable_lifecycle_policy = var.enable_lifecycle_policy
  document_retention_days = var.document_retention_days
  allowed_origins         = var.allowed_origins

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Authentication
# ─────────────────────────────────────────────

module "cognito" {
  source = "../../modules/cognito"

  project_name = var.project_name
  environment  = var.environment
  frontend_url = var.frontend_url

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Event Processing
# ─────────────────────────────────────────────

module "eventbridge" {
  source = "../../modules/eventbridge"

  project_name                      = var.project_name
  environment                       = var.environment
  api_handler_function_arn          = ""
  document_processor_function_arn   = ""
  requirement_approval_workflow_arn = var.requirement_approval_workflow_arn
  document_processing_workflow_arn  = var.document_processing_workflow_arn

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Compute (Lambda Functions)
# ─────────────────────────────────────────────

module "lambda" {
  source = "../../modules/lambda"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  dynamodb_table_name  = module.dynamodb.table_name
  dynamodb_table_arn   = module.dynamodb.table_arn
  s3_bucket_name       = module.s3.bucket_name
  s3_bucket_arn        = module.s3.bucket_arn
  log_retention_days   = var.log_retention_days
  eventbridge_bus_name = module.eventbridge.event_bus_name
  eventbridge_bus_arn  = module.eventbridge.event_bus_arn
  allowed_origins      = join(",", var.allowed_origins)

  # Lambda zip paths for deployed functions
  api_handler_zip_path    = "${path.root}/../../../src/lambdas/api-handler/lambda-deployment.zip"
  jwt_authorizer_zip_path = "${path.root}/../../../src/lambdas/jwt-authorizer/lambda-deployment.zip"

  # Pass Cognito info to Lambda
  cognito_user_pool_id      = module.cognito.user_pool_id
  cognito_app_client_id     = module.cognito.user_pool_client_id
  api_gateway_execution_arn = ""

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# API Gateway
# ─────────────────────────────────────────────

module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name              = var.project_name
  environment               = var.environment
  stage_name                = var.api_stage_name
  api_handler_function_name = module.lambda.api_handler_function_name
  api_handler_invoke_arn    = module.lambda.api_handler_invoke_arn
  jwt_authorizer_invoke_arn = module.lambda.jwt_authorizer_invoke_arn
  cognito_user_pool_id      = module.cognito.user_pool_id
  log_retention_days        = var.log_retention_days
  # Tighter throttling in prod to protect against abuse
  throttle_rate_limit  = 50
  throttle_burst_limit = 100

  tags = local.common_tags
}

# Cognito authenticated user execute-api permission
# (Separated from cognito module to avoid circular dependency)
resource "aws_iam_role_policy" "cognito_execute_api" {
  name = "${var.project_name}-${var.environment}-cognito-execute-api"
  role = module.cognito.authenticated_role_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["execute-api:Invoke"]
        Resource = "${module.api_gateway.api_gateway_execution_arn}/*"
      }
    ]
  })
}

# ─────────────────────────────────────────────
# Monitoring (CloudWatch) - DISABLED FOR COST
# ─────────────────────────────────────────────
# Uncomment when you're ready to pay for CloudWatch in prod:
#
# module "cloudwatch" {
#   source = "../../modules/cloudwatch"
#
#   project_name              = var.project_name
#   environment               = var.environment
#   api_gateway_name          = module.api_gateway.api_gateway_name
#   api_handler_function_name = module.lambda.api_handler_function_name
#   dynamodb_table_name       = module.dynamodb.table_name
#   s3_bucket_name            = module.s3.bucket_name
#   alert_email               = var.alert_email
#   log_retention_days        = var.log_retention_days
#   enable_detailed_monitoring       = var.enable_monitoring
#   high_error_threshold             = 5
#   high_latency_threshold           = 5000
#   alarm_evaluation_periods         = 2
#   overdue_actions_threshold        = var.overdue_actions_threshold
#   critical_alert_email             = var.critical_alert_email
#   business_hours_actions_threshold = 1
#   enable_business_hours_monitoring = true
#   lambda_duration_cost_threshold   = 5000
#   api_latency_threshold            = 2000
#
#   tags = local.common_tags
# }

# ─────────────────────────────────────────────
# Security (CloudTrail)
# ─────────────────────────────────────────────

module "cloudtrail" {
  source = "../../modules/cloudtrail"

  project_name = var.project_name
  environment  = var.environment

  is_multi_region_trail         = true # Multi-region in prod for full coverage
  include_global_service_events = true
  enable_data_events            = var.enable_cloudtrail_data_events
  s3_bucket_arns                = [module.s3.bucket_arn]
  lambda_function_arns          = [module.lambda.api_handler_function_arn]

  cloudtrail_retention_days        = var.cloudtrail_retention_days
  cloudwatch_log_retention_days    = var.cloudtrail_cloudwatch_retention_days
  security_alert_email             = var.security_alert_email
  unauthorized_api_calls_threshold = var.unauthorized_api_calls_threshold
  enable_insight_selectors         = true # Prod gets CloudTrail Insights

  tags = local.common_tags

  depends_on = [module.s3, module.lambda]
}

# ─────────────────────────────────────────────
# Email Notifications
# ─────────────────────────────────────────────

module "email_notifications" {
  source = "../../modules/email-notifications"

  project_name           = var.project_name
  environment            = var.environment
  dynamodb_table_name    = module.dynamodb.table_name
  dynamodb_table_arn     = module.dynamodb.table_arn
  sender_email           = var.sender_email
  domain_name            = var.domain_name
  dashboard_url          = var.dashboard_url
  enable_daily_reminders = true
  enable_overdue_alerts  = true
  reminder_timezone      = "Europe/London"

  tags = local.common_tags
}

# ─────────────────────────────────────────────
# Frontend Hosting (CloudFront + S3)
# ─────────────────────────────────────────────

module "frontend_hosting" {
  source = "../../modules/frontend-hosting"

  project_name    = var.project_name
  environment     = var.environment
  domain_name     = var.dashboard_url_hostname
  zone_id         = data.aws_route53_zone.main.zone_id
  api_gateway_url = module.api_gateway.api_gateway_url
  tags            = local.common_tags

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}
