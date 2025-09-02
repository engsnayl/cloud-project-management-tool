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
  default     = "../../src/lambdas/document-processor.zip"  # This path should be relative to the environment
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

# terraform/modules/lambda/variables.tf - Add these variables

variable "jwt_authorizer_zip_path" {
  description = "Path to the JWT authorizer Lambda deployment package"
  type        = string
  default     = "../../src/lambdas/jwt-authorizer.zip"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT validation"
  type        = string
  default     = ""
}

variable "cognito_app_client_id" {
  description = "Cognito App Client ID for JWT validation"
  type        = string
  default     = ""
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN prefix for the JWT authorizer"
  type        = string
  default     = ""
}