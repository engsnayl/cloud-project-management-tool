# terraform/modules/cloudwatch/outputs.tf

output "system_health_dashboard_url" {
  description = "URL to the System Health CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.system_health.dashboard_name}"
}

output "business_metrics_dashboard_url" {
  description = "URL to the Business Metrics CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.business_metrics.dashboard_name}"
}

output "cost_monitoring_dashboard_url" {
  description = "URL to the Cost Monitoring CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.cost_monitoring.dashboard_name}"
}

output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "api_error_alarm_arn" {
  description = "ARN of the API high error rate alarm"
  value       = aws_cloudwatch_metric_alarm.api_high_error_rate.arn
}

output "lambda_error_alarm_arn" {
  description = "ARN of the Lambda high error rate alarm"
  value       = aws_cloudwatch_metric_alarm.lambda_high_error_rate.arn
}

output "lambda_duration_alarm_arn" {
  description = "ARN of the Lambda high duration alarm"
  value       = aws_cloudwatch_metric_alarm.lambda_high_duration.arn
}

output "log_group_names" {
  description = "Names of created CloudWatch log groups"
  value = {
    api_handler        = aws_cloudwatch_log_group.api_handler_logs.name
    document_processor = aws_cloudwatch_log_group.document_processor_logs.name
  }
}

output "log_insights_queries" {
  description = "Names of created CloudWatch Insights queries"
  value = {
    error_analysis       = aws_cloudwatch_query_definition.error_analysis.name
    performance_analysis = aws_cloudwatch_query_definition.performance_analysis.name
  }
}

output "dashboard_names" {
  description = "Names of created CloudWatch dashboards"
  value = {
    system_health    = aws_cloudwatch_dashboard.system_health.dashboard_name
    business_metrics = aws_cloudwatch_dashboard.business_metrics.dashboard_name
    cost_monitoring  = aws_cloudwatch_dashboard.cost_monitoring.dashboard_name
  }
}