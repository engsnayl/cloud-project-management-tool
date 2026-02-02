# terraform/modules/api-gateway/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "v1"
}

variable "api_handler_function_name" {
  description = "Name of the API handler Lambda function"
  type        = string
}

variable "api_handler_invoke_arn" {
  description = "Invoke ARN of the API handler Lambda function"
  type        = string
}

variable "jwt_authorizer_invoke_arn" {
  description = "Invoke ARN of the JWT authorizer Lambda function"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "enable_cors" {
  description = "Enable CORS for the API"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS"
  type        = list(string)
  default     = ["*"] # Restrict in production
}

variable "enable_api_key" {
  description = "Enable API key requirement"
  type        = bool
  default     = false # Keep simple for dev
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days for API Gateway access logs"
  type        = number
  default     = 14
}

variable "throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests per second)"
  type        = number
  default     = 100
}

variable "throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 200
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
