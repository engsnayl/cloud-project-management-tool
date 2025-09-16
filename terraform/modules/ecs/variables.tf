# terraform/modules/ecs/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ECS resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for document storage"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket for document storage"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "eventbridge_bus_name" {
  description = "Name of the EventBridge custom event bus"
  type        = string
}

variable "eventbridge_bus_arn" {
  description = "ARN of the EventBridge custom event bus"
  type        = string
}

variable "document_processor_cpu" {
  description = "CPU units for the document processor task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.document_processor_cpu)
    error_message = "CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "document_processor_memory" {
  description = "Memory in MB for the document processor task"
  type        = number
  default     = 1024

  validation {
    condition     = var.document_processor_memory >= 512 && var.document_processor_memory <= 30720
    error_message = "Memory must be between 512 MB and 30720 MB."
  }
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for the ECS cluster"
  type        = bool
  default     = false # Disable in dev to reduce costs
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7 # Short retention for dev

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch retention period."
  }
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}