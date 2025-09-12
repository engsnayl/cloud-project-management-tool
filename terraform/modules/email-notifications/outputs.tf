# terraform/modules/email-notifications/outputs.tf

output "ses_configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = aws_ses_configuration_set.action_reminders.name
}

output "daily_reminder_template_name" {
  description = "Name of the daily reminder email template"
  value       = aws_ses_template.daily_action_reminder.name
}

output "overdue_alert_template_name" {
  description = "Name of the overdue alert email template"
  value       = aws_ses_template.overdue_action_alert.name
}

output "email_reminder_function_arn" {
  description = "ARN of the email reminder Lambda function"
  value       = aws_lambda_function.email_reminder.arn
}

output "email_reminder_function_name" {
  description = "Name of the email reminder Lambda function"
  value       = aws_lambda_function.email_reminder.function_name
}

output "daily_reminder_schedule_arn" {
  description = "ARN of the daily reminder EventBridge schedule"
  value       = aws_scheduler_schedule.daily_reminder.arn
}

output "overdue_alert_schedule_arn" {
  description = "ARN of the overdue alert EventBridge schedule"
  value       = var.enable_overdue_alerts ? aws_scheduler_schedule.overdue_alert[0].arn : null
}

output "email_dlq_url" {
  description = "URL of the email notifications dead letter queue"
  value       = aws_sqs_queue.email_dlq.url
}

output "sender_email" {
  description = "Email address used for sending notifications"
  value       = var.sender_email
}

output "ses_domain_verification_token" {
  description = "Domain verification token for SES (if domain is provided)"
  value       = var.domain_name != "" ? aws_ses_domain_identity.action_tracker[0].verification_token : null
  sensitive   = true
}