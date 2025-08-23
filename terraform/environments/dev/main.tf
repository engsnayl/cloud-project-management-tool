# terraform/environments/dev/main.tf

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = "Development"
    }
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  cidr_block           = var.vpc_cidr_block
  public_subnet_count  = var.public_subnet_count
  private_subnet_count = var.private_subnet_count
  enable_nat_gateway   = var.enable_nat_gateway

  tags = {
    Backup = "daily"
    Owner  = "DevTeam"
  }
}

# DynamoDB Module  
module "dynamodb" {
  source = "../../modules/dynamodb"

  project_name                  = var.project_name
  environment                   = var.environment
  enable_point_in_time_recovery = var.enable_point_in_time_recovery

  tags = {
    DataClassification = "internal"
    BackupSchedule     = "daily"
  }
}

# Add this to your existing main.tf (after DynamoDB module)

# S3 Module for Document Storage
module "s3" {
  source = "../../modules/s3"

  project_name            = var.project_name
  environment             = var.environment
  enable_versioning       = var.enable_s3_versioning
  enable_lifecycle_policy = var.enable_s3_lifecycle
  document_retention_days = var.document_retention_days
  allowed_origins         = var.allowed_origins

  tags = {
    DataClassification = "internal"
    BackupSchedule     = "daily"
    DocumentType       = "requirements"
  }
}

# Lambda Module for API and Document Processing

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
  enable_vpc_access   = false

  # Use the correct paths - these should be relative to the dev environment directory
  document_processor_zip_path = "../../../src/lambdas/document-processor.zip"
  api_handler_zip_path        = "../../../src/lambdas/api-handler.zip"

  tags = {
    Purpose = "serverless-compute"
  }
}

# API Gateway Module
module "api_gateway" {
  source = "../../modules/api-gateway"

  project_name              = var.project_name
  environment               = var.environment
  stage_name                = var.api_stage_name
  api_handler_function_name = module.lambda.api_handler_function_name
  api_handler_invoke_arn    = module.lambda.api_handler_invoke_arn
  enable_cors               = true
  cors_allowed_origins      = ["*"] # Open for dev

  tags = {
    Purpose = "api-layer"
    Access  = "public"
  }
}

# Step Functions Module for Workflow Orchestration
module "step_functions" {
  source = "../../modules/step-functions"

  project_name                    = var.project_name
  environment                     = var.environment
  api_handler_function_arn        = module.lambda.api_handler_function_arn
  document_processor_function_arn = module.lambda.document_processor_function_arn
  dynamodb_table_arn              = module.dynamodb.table_arn
  review_timeout_seconds          = var.workflow_review_timeout
  log_retention_days              = var.workflow_log_retention_days
  enable_logging                  = false # Disable logging for dev
  enable_express_workflows        = false
  enable_xray_tracing             = false

  tags = {
    Purpose    = "workflow-orchestration"
    Complexity = "enterprise"
  }
}

# Add this to your existing main.tf (after Step Functions module)

# EventBridge Module for Event-Driven Architecture
module "eventbridge" {
  source = "../../modules/eventbridge"

  project_name                      = var.project_name
  environment                       = var.environment
  requirement_approval_workflow_arn = module.step_functions.requirement_approval_state_machine_arn
  document_processing_workflow_arn  = module.step_functions.document_processing_state_machine_arn
  api_handler_function_arn          = module.lambda.api_handler_function_arn
  document_processor_function_arn   = module.lambda.document_processor_function_arn
  enable_event_archive              = var.enable_event_archive
  event_archive_retention_days      = var.event_archive_retention_days
  enable_cross_account_events       = false # Keep simple for dev
  enable_detailed_monitoring        = true  # Good for debugging

  tags = {
    Purpose      = "event-driven-architecture"
    Architecture = "serverless"
    Integration  = "step-functions"
  }
}