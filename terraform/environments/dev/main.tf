terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "action-tracker-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "action-tracker-terraform-locks"
  }
}

provider "aws" {
  region = "eu-west-1"
  
  default_tags {
    tags = {
      Environment = "development"
      Project     = "ActionTracker"
      ManagedBy   = "Terraform"
    }
  }
}

resource "aws_dynamodb_table" "actions" {
  name           = "action-tracker-dev-actions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  tags = {
    Name        = "ActionTracker Dev Actions"
    Environment = "development"
  }
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.actions.name
}
