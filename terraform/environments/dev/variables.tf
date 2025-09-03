# terraform/environments/dev/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "deliverycommand"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
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
  default     = "10.0.0.0/16"
}

# Frontend Configuration
variable "frontend_url" {
  description = "Frontend application URL for OAuth callbacks"
  type        = string
  default     = "http://localhost:3000"
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts (leave empty to disable)"
  type        = string
  default     = ""  # You can set your email here, e.g., "your.email@domain.com"
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alerting"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}