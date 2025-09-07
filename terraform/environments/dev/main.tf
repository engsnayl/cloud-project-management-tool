# terraform/environments/dev/main.tf

# Common locals for the environment
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner_email
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  cidr_block           = var.vpc_cidr
  public_subnet_count  = var.public_subnet_count
  private_subnet_count = var.private_subnet_count
  enable_nat_gateway   = var.enable_nat_gateway

  tags = local.common_tags
}

# DynamoDB Module
module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name                  = var.project_name
  environment                   = var.environment
  enable_point_in_time_recovery = var.enable_point_in_time_recovery

  tags = local.common_tags
}

# S3 Module
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

# Cognito Module
module "cognito" {
  source = "../../modules/cognito"

  project_name    = var.project_name
  environment     = var.environment
  frontend_url    = var.frontend_url
  api_gateway_arn = "" # Will be updated after API Gateway is created

  tags = local.common_tags
}

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  s3_bucket_name      = module.s3.bucket_name
  s3_bucket_arn       = module.s3.bucket_arn

  # Lambda zip paths - use the build artifacts
  api_handler_zip_path        = "${path.root}/../../../src/lambdas/api-handler/lambda-deployment.zip"
  document_processor_zip_path = "${path.root}/../../../src/lambdas/document-processor/lambda-deployment.zip"
  jwt_authorizer_zip_path     = "${path.root}/../../../src/lambdas/jwt-authorizer/lambda-deployment.zip"

  # Cognito integration
  cognito_user_pool_id      = module.cognito.user_pool_id
  cognito_app_client_id     = module.cognito.user_pool_client_id
  api_gateway_execution_arn = "" # Will be populated after API Gateway is created

  tags = local.common_tags

  depends_on = [module.cognito, module.vpc, module.dynamodb, module.s3]
}

# API Gateway Module
module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name              = var.project_name
  environment               = var.environment
  stage_name                = var.api_stage_name
  api_handler_function_name = module.lambda.api_handler_function_name
  api_handler_invoke_arn    = module.lambda.api_handler_invoke_arn
  jwt_authorizer_invoke_arn = module.lambda.jwt_authorizer_invoke_arn
  cognito_user_pool_id      = module.cognito.user_pool_id

  tags = local.common_tags

  depends_on = [module.lambda, module.cognito]
}

# EventBridge Module
module "eventbridge" {
  source = "../../modules/eventbridge"

  project_name                      = var.project_name
  environment                       = var.environment
  api_handler_function_arn          = module.lambda.api_handler_function_arn
  document_processor_function_arn   = module.lambda.document_processor_function_arn
  requirement_approval_workflow_arn = var.requirement_approval_workflow_arn
  document_processing_workflow_arn  = var.document_processing_workflow_arn

  tags = local.common_tags

  depends_on = [module.lambda]
}

# CloudWatch Monitoring Module
module "cloudwatch" {
  source = "../../modules/cloudwatch"

  project_name                     = var.project_name
  environment                      = var.environment
  api_gateway_name                 = module.api_gateway.api_gateway_name
  api_handler_function_name        = module.lambda.api_handler_function_name
  document_processor_function_name = module.lambda.document_processor_function_name
  dynamodb_table_name              = module.dynamodb.table_name
  s3_bucket_name                   = module.s3.bucket_name
  alert_email                      = var.alert_email
  log_retention_days               = var.log_retention_days
  enable_detailed_monitoring       = var.enable_monitoring
  high_error_threshold             = 10
  high_latency_threshold           = 10000
  alarm_evaluation_periods         = 2
  overdue_actions_threshold        = var.overdue_actions_threshold
  critical_alert_email             = var.critical_alert_email
  business_hours_actions_threshold = 1
  enable_business_hours_monitoring = false
  lambda_duration_cost_threshold   = 5000
  api_latency_threshold            = 2000

  tags = local.common_tags

  depends_on = [module.api_gateway, module.lambda, module.dynamodb, module.s3]
}