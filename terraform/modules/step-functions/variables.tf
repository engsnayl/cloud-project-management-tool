# terraform/modules/step-functions/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "api_handler_function_arn" {
  description = "ARN of the API handler Lambda function"
  type        = string
}

variable "document_processor_function_arn" {
  description = "ARN of the document processor Lambda function"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "review_timeout_seconds" {
  description = "Timeout in seconds for review process"
  type        = number
  default     = 300 # 5 minutes for dev/demo

  validation {
    condition     = var.review_timeout_seconds >= 60 && var.review_timeout_seconds <= 86400
    error_message = "Review timeout must be between 60 seconds and 1 day."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7 # Keep costs low in dev

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "enable_express_workflows" {
  description = "Enable Express workflows for high-volume processing"
  type        = bool
  default     = false # Standard workflows for dev (better for debugging)
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing for Step Functions"
  type        = bool
  default     = false # Keep simple for dev
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Add this variable to your existing variables.tf

variable "enable_logging" {
  description = "Enable CloudWatch logging for Step Functions"
  type        = bool
  default     = false # Disable for dev to avoid permission complexity
}