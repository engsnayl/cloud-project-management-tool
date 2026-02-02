# terraform/environments/staging/variables.tf

# Core Configuration
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
  default     = "10.1.0.0/16" # Different CIDR for staging
}

variable "public_subnet_count" {
  description = "Number of public subnets"
  type        = number
  default     = 2
}

variable "private_subnet_count" {
  description = "Number of private subnets"
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway"
  type        = bool
  default     = false
}

variable "enable_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

# Database Configuration
variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection for DynamoDB table"
  type        = bool
  default     = false
}

# Storage Configuration
variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_lifecycle_policy" {
  description = "Enable S3 lifecycle policy"
  type        = bool
  default     = false
}

variable "document_retention_days" {
  description = "Document retention in days"
  type        = number
  default     = 365
}

variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://actions-staging.engsnayl.com"]
}

# API Configuration
variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "staging"
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  default     = "https://actions-staging.engsnayl.com"
}

# Monitoring Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "overdue_actions_threshold" {
  description = "Threshold for overdue actions alarm"
  type        = number
  default     = 5
}

variable "critical_alert_email" {
  description = "Email for critical alerts"
  type        = string
  default     = ""
}

# Security Configuration
variable "enable_cloudtrail_data_events" {
  description = "Enable CloudTrail data events"
  type        = bool
  default     = false
}

variable "cloudtrail_retention_days" {
  description = "CloudTrail log retention days"
  type        = number
  default     = 90
}

variable "cloudtrail_cloudwatch_retention_days" {
  description = "CloudTrail CloudWatch log retention days"
  type        = number
  default     = 7
}

variable "security_alert_email" {
  description = "Email address for security alerts"
  type        = string
  default     = ""
}

variable "unauthorized_api_calls_threshold" {
  description = "Threshold for unauthorized API calls alarm"
  type        = number
  default     = 20
}

# Email Notifications
variable "sender_email" {
  description = "Email address for sending notifications"
  type        = string
  default     = "actions@engsnayl.com"
}

variable "dashboard_url" {
  description = "URL of the dashboard"
  type        = string
  default     = "https://actions-staging.engsnayl.com"
}

variable "domain_name" {
  description = "Domain name"
  type        = string
  default     = "engsnayl.com"
}

variable "dashboard_url_hostname" {
  description = "Dashboard hostname"
  type        = string
  default     = "actions-staging.engsnayl.com"
}

# Dynamic Workflow Configuration (removed hardcoded ARNs)
variable "requirement_approval_workflow_arn" {
  description = "ARN of requirement approval workflow"
  type        = string
  default     = ""
}

variable "document_processing_workflow_arn" {
  description = "ARN of document processing workflow"
  type        = string
  default     = ""
}