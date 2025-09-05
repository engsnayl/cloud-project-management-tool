# terraform/environments/staging/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "deliverycommand"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "owner_email" {
  description = "Email of the project owner"
  type        = string
  default     = "admin@example.com"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16"  # Different from dev (10.0.0.0/16) to avoid conflicts
}

# Frontend Configuration
variable "frontend_url" {
  description = "Frontend application URL for OAuth callbacks"
  type        = string
  default     = "https://staging.actiontracker.com"  # Staging-specific URL
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts (leave empty to disable)"
  type        = string
  default     = "alerts-staging@actiontracker.com"  # Staging-specific email
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alerting"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14  # Shorter retention for staging to save costs
}

variable "overdue_actions_threshold" {
  description = "Threshold for overdue actions alarm"   
  type        = number
  default     = 5
}

variable "critical_alert_email" {
  description = "Email for critical alerts"
  type        = string
  default     = "critical-staging@actiontracker.com"  # Staging-specific critical alerts
}

variable "enable_business_hours_monitoring" {
  description = "Enable business hours specific monitoring"
  type        = bool
  default     = true
}