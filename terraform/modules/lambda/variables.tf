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
  default     = false
}

# Lambda deployment packages
variable "api_handler_zip_path" {
  description = "Path to the API handler Lambda deployment package"
  type        = string
}

variable "jwt_authorizer_zip_path" {
  description = "Path to the JWT authorizer Lambda deployment package"
  type        = string
}

# EventBridge integration
variable "eventbridge_bus_name" {
  description = "Name of the EventBridge bus"
  type        = string
  default     = "default"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

# Cognito integration
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

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}