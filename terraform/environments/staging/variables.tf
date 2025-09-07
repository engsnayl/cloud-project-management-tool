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
  default     = "10.1.0.0/16" # Different from dev to avoid conflicts
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
  description = "Enable NAT Gateway (costs money)"
  type        = bool
  default     = false
}

# DynamoDB Configuration
variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = true # Enable in staging for better testing
}

# S3 Configuration - Updated to match module
variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_lifecycle_policy" {
  description = "Enable S3 lifecycle policy"
  type        = bool
  default     = true # Enable in staging
}

variable "document_retention_days" {
  description = "Document retention in days"
  type        = number
  default     = 90 # Shorter retention for staging
}

variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://staging.actiontracker.com"] # Staging-specific origins
}

# API Gateway Configuration
variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "staging"
}

# Frontend Configuration
variable "frontend_url" {
  description = "Frontend application URL for OAuth callbacks"
  type        = string
  default     = "https://staging.actiontracker.com"
}

# Monitoring Configuration
variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = "alerts-staging@actiontracker.com"
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

variable "overdue_actions_threshold" {
  description = "Threshold for overdue actions alarm"
  type        = number
  default     = 5
}

variable "critical_alert_email" {
  description = "Email for critical alerts"
  type        = string
  default     = "critical-staging@actiontracker.com"
}

variable "enable_business_hours_monitoring" {
  description = "Enable business hours specific monitoring"
  type        = bool
  default     = true
}

# Step Functions Configuration
variable "requirement_approval_workflow_arn" {
  description = "ARN of the requirement approval Step Functions workflow"
  type        = string
  default     = "arn:aws:states:eu-west-1:340752829546:stateMachine:deliverycommand-staging-requirement-approval"
}

variable "document_processing_workflow_arn" {
  description = "ARN of the document processing Step Functions workflow"
  type        = string
  default     = "arn:aws:states:eu-west-1:340752829546:stateMachine:deliverycommand-staging-document-processing"
}