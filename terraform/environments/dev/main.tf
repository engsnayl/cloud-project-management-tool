# terraform/environments/dev/main.tf

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

# Lambda Module
module "lambda" {
  source = "../../modules/lambda"

  project_name        = var.project_name
  environment         = var.environment
  
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  s3_bucket_name      = module.s3.bucket_name
  s3_bucket_arn       = module.s3.bucket_arn
  
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  
  enable_vpc_access = false
  
  tags = local.common_tags
}

# API Gateway Module (preserve existing)
module "api_gateway" {
  source = "../../modules/api_gateway"

  project_name = var.project_name
  environment  = var.environment
  
  api_handler_function_name = module.lambda.api_handler_function_name
  api_handler_invoke_arn    = module.lambda.api_handler_invoke_arn
  
  tags = local.common_tags
}

# Step Functions Module (preserve existing)
module "step_functions" {
  source = "../../modules/step_functions"

  project_name = var.project_name
  environment  = var.environment
  
  api_handler_function_arn       = module.lambda.api_handler_function_arn
  document_processor_function_arn = module.lambda.document_processor_function_arn
  dynamodb_table_arn             = module.dynamodb.table_arn
  
  tags = local.common_tags
}

# EventBridge Module (preserve existing)
module "eventbridge" {
  source = "../../modules/eventbridge"

  project_name = var.project_name
  environment  = var.environment
  
  api_handler_function_arn                   = module.lambda.api_handler_function_arn
  document_processor_function_arn            = module.lambda.document_processor_function_arn
  requirement_approval_workflow_arn          = module.step_functions.requirement_approval_workflow_arn
  document_processing_workflow_arn           = module.step_functions.document_processing_workflow_arn
  
  tags = local.common_tags
}

# Cognito Module (NEW - adding authentication)
module "cognito" {
  source = "../../modules/cognito"

  project_name = var.project_name
  environment  = var.environment
  
  frontend_url      = var.frontend_url
  api_gateway_arn   = module.api_gateway.api_arn
  
  tags = local.common_tags
}