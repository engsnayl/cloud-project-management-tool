# terraform/modules/cloudtrail/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# CloudTrail Configuration
variable "is_multi_region_trail" {
  description = "Enable multi-region trail (recommended for production)"
  type        = bool
  default     = true
}

variable "include_global_service_events" {
  description = "Include global service events (IAM, STS, CloudFront)"
  type        = bool
  default     = true
}

variable "enable_data_events" {
  description = "Enable data events for S3 and Lambda (increases costs)"
  type        = bool
  default     = false  # Disable for dev to save costs
}

variable "exclude_management_event_sources" {
  description = "Management event sources to exclude"
  type        = list(string)
  default     = ["kms.amazonaws.com", "rdsdata.amazonaws.com"]
}

# S3 Configuration
variable "cloudtrail_retention_days" {
  description = "Number of days to retain CloudTrail logs in S3"
  type        = number
  default     = 2555  # ~7 years for compliance
  
  validation {
    condition     = var.cloudtrail_retention_days >= 90
    error_message = "CloudTrail retention must be at least 90 days for compliance."
  }
}

# CloudWatch Logs Configuration
variable "cloudwatch_log_retention_days" {
  description = "Number of days to retain CloudTrail logs in CloudWatch"
  type        = number
  default     = 7  # 1 week for cost optimization
  
  validation {
    condition = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.cloudwatch_log_retention_days)
    error_message = "CloudWatch log retention days must be a valid CloudWatch retention period."
  }
}

# Data Events Configuration
variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs to monitor for data events"
  type        = list(string)
  default     = []
}

variable "lambda_function_arns" {
  description = "List of Lambda function ARNs to monitor for data events"
  type        = list(string)
  default     = []
}

# Alerting Configuration
variable "security_alert_email" {
  description = "Email address for security alerts"
  type        = string
  default     = ""
}

variable "unauthorized_api_calls_threshold" {
  description = "Threshold for unauthorized API calls alarm"
  type        = number
  default     = 5
  
  validation {
    condition     = var.unauthorized_api_calls_threshold >= 1
    error_message = "Unauthorized API calls threshold must be at least 1."
  }
}

# Cost Optimization
variable "enable_insight_selectors" {
  description = "Enable CloudTrail Insights for anomaly detection (costs extra)"
  type        = bool
  default     = false  # Disable for dev environment
}

variable "insight_selector_types" {
  description = "Types of insights to enable"
  type        = list(string)
  default     = ["ApiCallRateInsight"]
  
  validation {
    condition = alltrue([
      for type in var.insight_selector_types : contains(["ApiCallRateInsight"], type)
    ])
    error_message = "Valid insight selector types are: ApiCallRateInsight."
  }
}