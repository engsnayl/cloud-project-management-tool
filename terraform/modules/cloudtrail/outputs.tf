# terraform/modules/cloudtrail/outputs.tf

# CloudTrail Outputs
output "cloudtrail_arn" {
  description = "ARN of the CloudTrail"
  value       = aws_cloudtrail.main.arn
}

output "cloudtrail_name" {
  description = "Name of the CloudTrail"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_home_region" {
  description = "Home region of the CloudTrail"
  value       = aws_cloudtrail.main.home_region
}

# S3 Bucket Outputs
output "cloudtrail_s3_bucket_name" {
  description = "Name of the S3 bucket storing CloudTrail logs"
  value       = aws_s3_bucket.cloudtrail_logs.bucket
}

output "cloudtrail_s3_bucket_arn" {
  description = "ARN of the S3 bucket storing CloudTrail logs"
  value       = aws_s3_bucket.cloudtrail_logs.arn
}

output "cloudtrail_s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.cloudtrail_logs.bucket_domain_name
}

# CloudWatch Outputs
output "cloudtrail_log_group_name" {
  description = "Name of the CloudWatch log group for CloudTrail"
  value       = aws_cloudwatch_log_group.cloudtrail_logs.name
}

output "cloudtrail_log_group_arn" {
  description = "ARN of the CloudWatch log group for CloudTrail"
  value       = aws_cloudwatch_log_group.cloudtrail_logs.arn
}

# IAM Outputs
output "cloudtrail_cloudwatch_role_arn" {
  description = "ARN of the IAM role for CloudTrail CloudWatch logs"
  value       = aws_iam_role.cloudtrail_cloudwatch_role.arn
}

output "cloudtrail_cloudwatch_role_name" {
  description = "Name of the IAM role for CloudTrail CloudWatch logs"
  value       = aws_iam_role.cloudtrail_cloudwatch_role.name
}

# SNS Outputs
output "cloudtrail_alerts_topic_arn" {
  description = "ARN of the SNS topic for CloudTrail alerts"
  value       = aws_sns_topic.cloudtrail_alerts.arn
}

output "cloudtrail_alerts_topic_name" {
  description = "Name of the SNS topic for CloudTrail alerts"
  value       = aws_sns_topic.cloudtrail_alerts.name
}

# Metric Filter Outputs
output "security_metric_filters" {
  description = "List of security metric filters created"
  value = {
    root_access_count      = aws_cloudwatch_log_metric_filter.root_access_count.name
    unauthorized_api_calls = aws_cloudwatch_log_metric_filter.unauthorized_api_calls.name
    no_mfa_console_logins  = aws_cloudwatch_log_metric_filter.no_mfa_console_logins.name
    iam_policy_changes     = aws_cloudwatch_log_metric_filter.iam_policy_changes.name
  }
}

# Alarm Outputs
output "security_alarms" {
  description = "List of security alarms created"
  value = {
    root_access_alarm            = aws_cloudwatch_metric_alarm.root_access_alarm.arn
    unauthorized_api_calls_alarm = aws_cloudwatch_metric_alarm.unauthorized_api_calls_alarm.arn
    no_mfa_console_logins_alarm  = aws_cloudwatch_metric_alarm.no_mfa_console_logins_alarm.arn
    iam_policy_changes_alarm     = aws_cloudwatch_metric_alarm.iam_policy_changes_alarm.arn
  }
}

# Configuration Summary
output "cloudtrail_configuration" {
  description = "Summary of CloudTrail configuration"
  value = {
    trail_name                = aws_cloudtrail.main.name
    multi_region              = aws_cloudtrail.main.is_multi_region_trail
    global_service_events     = aws_cloudtrail.main.include_global_service_events
    log_file_validation       = aws_cloudtrail.main.enable_log_file_validation
    s3_bucket                 = aws_s3_bucket.cloudtrail_logs.bucket
    cloudwatch_log_group      = aws_cloudwatch_log_group.cloudtrail_logs.name
    cloudwatch_retention_days = aws_cloudwatch_log_group.cloudtrail_logs.retention_in_days
  }
}