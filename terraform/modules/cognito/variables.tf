# terraform/modules/cognito/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "frontend_url" {
  description = "Frontend application URL for OAuth callbacks"
  type        = string
  default     = ""
}

variable "api_gateway_arn" {
  description = "API Gateway ARN for authenticated user permissions"
  type        = string
}

variable "tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default     = {}
}