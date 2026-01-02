# terraform/modules/cloudwatch/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "api_gateway_name" {
  description = "Name of the API Gateway"
  type        = string
}

variable "api_handler_function_name" {
  description = "Name of the API handler Lambda function"
  type        = string
}


variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts (leave empty to disable email alerts)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "alarm_evaluation_periods" {
  description = "Number of periods to evaluate for alarms"
  type        = number
  default     = 2

  validation {
    condition     = var.alarm_evaluation_periods >= 1 && var.alarm_evaluation_periods <= 10
    error_message = "Alarm evaluation periods must be between 1 and 10."
  }
}

variable "high_error_threshold" {
  description = "Threshold for high error rate alarm"
  type        = number
  default     = 10
}

variable "high_latency_threshold" {
  description = "Threshold for high latency alarm (in milliseconds)"
  type        = number
  default     = 10000 # 10 seconds
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Advanced Alerting Configuration
variable "overdue_actions_threshold" {
  description = "Threshold for overdue actions alarm"
  type        = number
  default     = 5
}

variable "critical_alert_email" {
  description = "Email address for critical system alerts (separate from regular alerts)"
  type        = string
  default     = ""
}

variable "enable_business_hours_monitoring" {
  description = "Enable business hours specific monitoring"
  type        = bool
  default     = false
}

variable "business_hours_actions_threshold" {
  description = "Minimum actions expected during business hours"
  type        = number
  default     = 1
}

variable "lambda_duration_cost_threshold" {
  description = "Lambda duration threshold for cost monitoring (milliseconds)"
  type        = number
  default     = 5000 # 5 seconds
}

variable "api_latency_threshold" {
  description = "API Gateway latency threshold for performance monitoring (milliseconds)"
  type        = number
  default     = 2000 # 2 seconds
}

