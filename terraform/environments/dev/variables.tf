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

# VPC Variables
variable "vpc_cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
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
  default     = false  # Keep costs low in dev
}

# DynamoDB Variables
variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = false  # Keep costs low in dev
}

# S3 Variables
variable "enable_s3_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_s3_lifecycle" {
  description = "Enable S3 lifecycle policy"
  type        = bool
  default     = false  # Keep costs low in dev
}

variable "document_retention_days" {
  description = "Document retention in days"
  type        = number
  default     = 365  # 1 year for dev
}

variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]  # Open for dev, restrict in prod
}

# API Gateway Variables
variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "dev"
}

# Step Functions Variables
variable "workflow_review_timeout" {
  description = "Workflow review timeout in seconds"
  type        = number
  default     = 300  # 5 minutes for dev/demo
}

variable "workflow_log_retention_days" {
  description = "Step Functions log retention in days"
  type        = number
  default     = 7  # Keep costs low
}