# terraform/shared/variables.tf

variable "project_name" {
  description = "Name of the project - used for resource naming"
  type        = string
  default     = "deliverycommand"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-west-1"

  validation {
    condition = contains([
      "us-east-1", "us-east-2", "us-west-1", "us-west-2",
      "eu-west-1", "eu-west-2", "eu-central-1",
      "ap-southeast-1", "ap-southeast-2"
    ], var.aws_region)
    error_message = "AWS region must be a valid region."
  }
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "shared"
}