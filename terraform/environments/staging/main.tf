# terraform/environments/staging/main.tf

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner_email
    }
  }
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = var.owner_email
  }
}

locals {
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "action-tracker"
    Owner       = "cloud-engineering-project"
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  cidr_block   = var.vpc_cidr
  
  tags = local.common_tags
}

# DynamoDB Module
module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name = var.project_name
  environment  = var.environment
  
  tags = local.common_tags
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment
  
  tags = local.common_tags
}

# Lambda Module - COMBINED VERSION
module "lambda" {
  source = "../../modules/lambda"

  project_name        = var.project_name
  environment         = var.environment
  
  # Lambda zip paths
  api_handler_zip_path = "${path.root}/../../../src/lambdas/api-handler/lambda-deployment.zip"
  document_processor_zip_path = "${path.root}/../../../src/lambdas/document-processor/lambda-deployment.zip"
  jwt_authorizer_zip_path = "${path.root}/../../../src/lambdas/jwt-authorizer/lambda-deployment.zip"
  
  # Cognito parameters for JWT authorizer
  cognito_user_pool_id   = module.cognito.user_pool_id
  cognito_app_client_id  = module.cognito.user_pool_client_id
  api_gateway_execution_arn = module.api_gateway.api_gateway_execution_arn
  
  # Other existing parameters
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  s3_bucket_name      = module.s3.bucket_name
  s3_bucket_arn       = module.s3.bucket_arn
  
  tags = local.common_tags
}

# API Gateway Module
module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name = var.project_name
  environment  = var.environment
  
  # JWT authorizer parameters
  jwt_authorizer_invoke_arn = module.lambda.jwt_authorizer_invoke_arn
  cognito_user_pool_id      = module.cognito.user_pool_id
  
  # Existing parameters
  api_handler_function_name = module.lambda.api_handler_function_name
  api_handler_invoke_arn    = module.lambda.api_handler_invoke_arn
  
  tags = local.common_tags
}

# EventBridge Module
module "eventbridge" {
  source = "../../modules/eventbridge"

  project_name = var.project_name
  environment  = var.environment
  
  api_handler_function_arn        = module.lambda.api_handler_function_arn
  document_processor_function_arn = module.lambda.document_processor_function_arn
  
  # Use hardcoded ARNs for staging Step Functions (you'll need to update these after creating staging Step Functions)
  requirement_approval_workflow_arn  = "arn:aws:states:eu-west-1:340752829546:stateMachine:deliverycommand-staging-requirement-approval"
  document_processing_workflow_arn   = "arn:aws:states:eu-west-1:340752829546:stateMachine:deliverycommand-staging-document-processing"
  
  tags = local.common_tags
}

# Cognito Module
module "cognito" {
  source = "../../modules/cognito"

  project_name = var.project_name
  environment  = var.environment
  
  frontend_url      = var.frontend_url
  api_gateway_arn   = module.api_gateway.api_gateway_arn
  
  tags = local.common_tags
}

# CloudWatch Monitoring Module
module "cloudwatch" {
  source = "../../modules/cloudwatch"

  # Basic Configuration
  project_name = var.project_name
  environment  = var.environment

  # Resource Names from other modules
  api_gateway_name                   = module.api_gateway.api_gateway_name
  api_handler_function_name          = module.lambda.api_handler_function_name
  document_processor_function_name   = module.lambda.document_processor_function_name
  dynamodb_table_name               = module.dynamodb.table_name
  s3_bucket_name                    = module.s3.bucket_name

  # Alert Configuration
  alert_email                = var.alert_email
  log_retention_days         = var.log_retention_days
  enable_detailed_monitoring = true

  # Alarm Thresholds
  high_error_threshold     = 10
  high_latency_threshold   = 10000  # 10 seconds
  alarm_evaluation_periods = 2
  overdue_actions_threshold       = var.overdue_actions_threshold
  critical_alert_email           = var.critical_alert_email
  business_hours_actions_threshold = 1
  enable_business_hours_monitoring = var.enable_business_hours_monitoring
  lambda_duration_cost_threshold = 5000
  api_latency_threshold         = 2000

  tags = local.tags
}