# terraform/modules/s3/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_lifecycle_policy" {
  description = "Enable S3 lifecycle policy for cost optimization"
  type        = bool
  default     = true
}

variable "document_retention_days" {
  description = "Number of days to retain documents before deletion"
  type        = number
  default     = 2555  # ~7 years for compliance
  
  validation {
    condition     = var.document_retention_days >= 30
    error_message = "Document retention must be at least 30 days."
  }
}

variable "allowed_origins" {
  description = "Allowed origins for CORS (web app domains)"
  type        = list(string)
  default     = ["*"]  # Restrict in production
}

variable "enable_event_notifications" {
  description = "Enable S3 event notifications for document processing"
  type        = bool
  default     = false  # Enable when Lambda exists
}

variable "document_processor_lambda_arn" {
  description = "ARN of Lambda function for document processing"
  type        = string
  default     = ""
}

variable "document_processor_lambda_permission" {
  description = "Lambda permission resource for S3 notifications"
  type        = any
  default     = null
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}