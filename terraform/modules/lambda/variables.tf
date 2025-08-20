# terraform/modules/lambda/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for Lambda security groups"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC configuration"
  type        = list(string)
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  type        = string
}

variable "enable_vpc_access" {
  description = "Enable VPC access for Lambda functions"
  type        = bool
  default     = false  # Keep simple for dev
}

variable "document_processor_zip_path" {
  description = "Path to the document processor Lambda deployment package"
  type        = string
  default     = "../../src/lambdas/document-processor.zip"
}

variable "api_handler_zip_path" {
  description = "Path to the API handler Lambda deployment package"
  type        = string
  default     = "../../src/lambdas/api-handler.zip"
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}