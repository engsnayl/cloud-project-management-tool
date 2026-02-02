# terraform/modules/email-notifications/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table containing actions"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table containing actions"
  type        = string
}

variable "sender_email" {
  description = "Email address to send notifications from (must be verified in SES)"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.sender_email))
    error_message = "Sender email must be a valid email address."
  }
}

variable "domain_name" {
  description = "Domain name for SES (optional, used for domain verification)"
  type        = string
  default     = ""
}

variable "dashboard_url" {
  description = "URL of the action tracking dashboard for email links"
  type        = string
  default     = "https://localhost:3000"
}

variable "enable_daily_reminders" {
  description = "Enable daily reminder emails"
  type        = bool
  default     = true
}

variable "enable_overdue_alerts" {
  description = "Enable overdue action alert emails"
  type        = bool
  default     = true
}

variable "reminder_timezone" {
  description = "Timezone for scheduled reminders (e.g., 'Europe/London', 'America/New_York')"
  type        = string
  default     = "UTC"

  validation {
    condition = contains([
      "UTC", "Europe/London", "America/New_York", "America/Los_Angeles",
      "America/Chicago", "Asia/Tokyo", "Australia/Sydney", "Europe/Paris"
    ], var.reminder_timezone)
    error_message = "Reminder timezone must be a valid timezone string."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}