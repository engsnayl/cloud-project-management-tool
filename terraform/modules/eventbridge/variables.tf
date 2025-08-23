# terraform/modules/eventbridge/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "requirement_approval_workflow_arn" {
  description = "ARN of the requirement approval Step Functions workflow"
  type        = string
}

variable "document_processing_workflow_arn" {
  description = "ARN of the document processing Step Functions workflow"
  type        = string
}

variable "api_handler_function_arn" {
  description = "ARN of the API handler Lambda function"
  type        = string
}

variable "document_processor_function_arn" {
  description = "ARN of the document processor Lambda function"
  type        = string
}

variable "enable_event_archive" {
  description = "Enable EventBridge archive for event replay"
  type        = bool
  default     = false  # Disable in dev to save costs
}

variable "event_archive_retention_days" {
  description = "Number of days to retain archived events"
  type        = number
  default     = 7  # Keep costs low in dev
  
  validation {
    condition     = var.event_archive_retention_days >= 1 && var.event_archive_retention_days <= 3653
    error_message = "Event archive retention must be between 1 and 3653 days (10 years)."
  }
}

variable "enable_cross_account_events" {
  description = "Enable cross-account event sharing"
  type        = bool
  default     = false  # Keep simple for dev
}

variable "allowed_event_sources" {
  description = "List of allowed event sources for this bus"
  type        = list(string)
  default     = [
    "deliverycommand.requirements",
    "deliverycommand.documents", 
    "deliverycommand.workflows",
    "deliverycommand.notifications"
  ]
}

variable "dlq_message_retention_seconds" {
  description = "Message retention period for dead letter queue in seconds"
  type        = number
  default     = 1209600  # 14 days
  
  validation {
    condition     = var.dlq_message_retention_seconds >= 60 && var.dlq_message_retention_seconds <= 1209600
    error_message = "DLQ message retention must be between 60 seconds and 14 days."
  }
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring for EventBridge rules"
  type        = bool
  default     = true  # Good for debugging in dev
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}