# terraform/modules/eventbridge/outputs.tf

output "event_bus_name" {
  description = "Name of the custom EventBridge event bus"
  value       = aws_cloudwatch_event_bus.deliverycommand.name
}

output "event_bus_arn" {
  description = "ARN of the custom EventBridge event bus"
  value       = aws_cloudwatch_event_bus.deliverycommand.arn
}

output "eventbridge_role_arn" {
  description = "ARN of the EventBridge execution role"
  value       = aws_iam_role.eventbridge_role.arn
}

output "requirement_created_rule_arn" {
  description = "ARN of the requirement created EventBridge rule"
  value       = aws_cloudwatch_event_rule.requirement_created.arn
}

output "document_uploaded_rule_arn" {
  description = "ARN of the document uploaded EventBridge rule"
  value       = aws_cloudwatch_event_rule.document_uploaded.arn
}

output "requirement_status_changed_rule_arn" {
  description = "ARN of the requirement status changed EventBridge rule"
  value       = aws_cloudwatch_event_rule.requirement_status_changed.arn
}

output "workflow_completed_rule_arn" {
  description = "ARN of the workflow completed EventBridge rule"
  value       = aws_cloudwatch_event_rule.workflow_completed.arn
}

output "event_dlq_arn" {
  description = "ARN of the event dead letter queue"
  value       = aws_sqs_queue.event_dlq.arn
}

output "event_dlq_url" {
  description = "URL of the event dead letter queue"
  value       = aws_sqs_queue.event_dlq.url
}

output "event_archive_arn" {
  description = "ARN of the EventBridge archive (if enabled)"
  value       = var.enable_event_archive ? aws_cloudwatch_event_archive.deliverycommand_archive[0].arn : null
}

output "event_patterns" {
  description = "Event patterns used by EventBridge rules for documentation"
  value = {
    requirement_created = {
      source      = ["deliverycommand.requirements"]
      detail-type = ["Requirement Created"]
    }
    document_uploaded = {
      source      = ["deliverycommand.documents"]
      detail-type = ["Document Uploaded"]
    }
    requirement_status_changed = {
      source      = ["deliverycommand.requirements"]
      detail-type = ["Requirement Status Changed"]
    }
    workflow_completed = {
      source      = ["deliverycommand.workflows"]
      detail-type = ["Workflow Completed"]
    }
  }
}