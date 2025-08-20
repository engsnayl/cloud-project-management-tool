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
  
  project_name             = var.project_name
  environment              = var.environment
  enable_versioning        = var.enable_s3_versioning
  enable_lifecycle_policy  = var.enable_s3_lifecycle
  document_retention_days  = var.document_retention_days
  allowed_origins          = var.allowed_origins
  
  tags = {
    DataClassification = "internal"
    BackupSchedule     = "daily"
    DocumentType       = "requirements"
  }
}

# Lambda Module for API and Document Processing

module "lambda" {
  source = "../../modules/lambda"
  
  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  dynamodb_table_name   = module.dynamodb.table_name
  dynamodb_table_arn    = module.dynamodb.table_arn
  s3_bucket_name        = module.s3.bucket_name
  s3_bucket_arn         = module.s3.bucket_arn
  enable_vpc_access     = false
  
  # Use the correct paths - these should be relative to the dev environment directory
  document_processor_zip_path = "../../../src/lambdas/document-processor.zip"
  api_handler_zip_path       = "../../../src/lambdas/api-handler.zip"
  
  tags = {
    Purpose = "serverless-compute"
  }
}