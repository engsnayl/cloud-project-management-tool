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