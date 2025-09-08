# terraform/modules/dynamodb/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB table"
  type        = bool
  default     = false # Disable in dev to save costs
}

variable "deletion_protection" {
  description = "Enable deletion protection for DynamoDB table"
  type        = bool
  default     = false # Allow deletion in dev
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}