# terraform/environments/staging/outputs.tf

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

# DynamoDB Outputs
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = module.dynamodb.table_arn
}

# S3 Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.s3.bucket_arn
}

# Lambda Outputs
output "api_handler_function_name" {
  description = "Name of the API handler Lambda function"
  value       = module.lambda.api_handler_function_name
}

output "api_handler_function_arn" {
  description = "ARN of the API handler Lambda function"
  value       = module.lambda.api_handler_function_arn
}

output "document_processor_function_name" {
  description = "Name of the document processor Lambda function"
  value       = module.lambda.document_processor_function_name
}

output "document_processor_function_arn" {
  description = "ARN of the document processor Lambda function"
  value       = module.lambda.document_processor_function_arn
}

# API Gateway Outputs
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = module.api_gateway.api_gateway_url
}

output "api_gateway_arn" {
  description = "ARN of the API Gateway"
  value       = module.api_gateway.api_gateway_arn
}

output "health_endpoint" {
  description = "Health check endpoint"
  value       = module.api_gateway.health_endpoint
}

output "requirements_endpoint" {
  description = "Requirements endpoint"
  value       = module.api_gateway.requirements_endpoint
}

output "projects_endpoint" {
  description = "Projects endpoint"
  value       = module.api_gateway.projects_endpoint
}

# EventBridge Outputs
output "event_bus_name" {
  description = "Name of the custom EventBridge event bus"
  value       = module.eventbridge.event_bus_name
}

output "event_bus_arn" {
  description = "ARN of the custom EventBridge event bus"
  value       = module.eventbridge.event_bus_arn
}

output "event_patterns" {
  description = "EventBridge event patterns for integration"
  value       = module.eventbridge.event_patterns
}

output "event_dlq_url" {
  description = "URL of the EventBridge dead letter queue"
  value       = module.eventbridge.event_dlq_url
}

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.user_pool_client_id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = module.cognito.user_pool_domain
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = module.cognito.identity_pool_id
}

output "oauth_login_url" {
  description = "OAuth login URL for frontend"
  value       = module.cognito.oauth_login_url
  sensitive   = true
}

output "oauth_logout_url" {
  description = "OAuth logout URL for frontend"
  value       = module.cognito.oauth_logout_url
  sensitive   = true
}

# Complete Authentication Configuration
output "auth_config" {
  description = "Complete authentication configuration for frontend"
  value = {
    region           = var.aws_region
    userPoolId       = module.cognito.user_pool_id
    userPoolClientId = module.cognito.user_pool_client_id
    identityPoolId   = module.cognito.identity_pool_id
    domain           = module.cognito.user_pool_domain
    apiGatewayUrl    = module.api_gateway.api_gateway_url
  }
  sensitive = true
}

output "jwt_authorizer_function_name" {
  description = "Name of the JWT authorizer Lambda function"
  value       = module.lambda.jwt_authorizer_function_name
}

# CloudWatch Monitoring Outputs
output "monitoring_dashboards" {
  description = "URLs to CloudWatch monitoring dashboards"
  value = {
    system_health    = module.cloudwatch.system_health_dashboard_url
    business_metrics = module.cloudwatch.business_metrics_dashboard_url
    cost_monitoring  = module.cloudwatch.cost_monitoring_dashboard_url
  }
}

output "alert_topic_arn" {
  description = "ARN of SNS topic for alerts"
  value       = module.cloudwatch.sns_alerts_topic_arn
}

output "log_groups" {
  description = "CloudWatch log group information"
  value       = module.cloudwatch.log_group_names
}

# Display monitoring info after deployment
output "monitoring_setup_complete" {
  description = "Monitoring setup information"
  value       = <<EOF

CloudWatch Dashboards:
  - System Health: ${module.cloudwatch.system_health_dashboard_url}
  - Business Metrics: ${module.cloudwatch.business_metrics_dashboard_url}  
  - Cost Monitoring: ${module.cloudwatch.cost_monitoring_dashboard_url}

Alerts Configuration:
  - SNS Topic: ${module.cloudwatch.sns_alerts_topic_arn}
  - Email Alerts: ${var.alert_email != "" ? "Enabled" : "Disabled"}

Log Groups Created:
  - API Handler: ${module.cloudwatch.log_group_names.api_handler}
  - Document Processor: ${module.cloudwatch.log_group_names.document_processor}

EOF
}

# CloudTrail Outputs
output "cloudtrail_arn" {
  description = "ARN of the CloudTrail"
  value       = module.cloudtrail.cloudtrail_arn
}

output "cloudtrail_s3_bucket" {
  description = "S3 bucket storing CloudTrail logs"
  value       = module.cloudtrail.cloudtrail_s3_bucket_name
}

output "cloudtrail_log_group" {
  description = "CloudWatch log group for CloudTrail"
  value       = module.cloudtrail.cloudtrail_log_group_name
}

output "cloudtrail_alerts_topic" {
  description = "SNS topic for CloudTrail security alerts"
  value       = module.cloudtrail.cloudtrail_alerts_topic_arn
}

output "cloudtrail_configuration" {
  description = "CloudTrail configuration summary"
  value       = module.cloudtrail.cloudtrail_configuration
}

output "security_monitoring" {
  description = "Security monitoring resources"
  value = {
    metric_filters = module.cloudtrail.security_metric_filters
    alarms         = module.cloudtrail.security_alarms
  }
}

# Email Notifications Outputs - CORRECTED to match actual module outputs
output "ses_configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = module.email_notifications.ses_configuration_set_name
}

output "email_reminder_function_name" {
  description = "Email reminder Lambda function name"
  value       = module.email_notifications.email_reminder_function_name
}

output "email_reminder_function_arn" {
  description = "Email reminder Lambda function ARN"
  value       = module.email_notifications.email_reminder_function_arn
}

output "sender_email" {
  description = "Email address used for sending notifications"
  value       = module.email_notifications.sender_email
}

output "ses_domain_verification_token" {
  description = "SES domain verification token"
  value       = module.email_notifications.ses_domain_verification_token
  sensitive   = true
}

# Frontend Hosting Outputs - NEW for Phase 17!
output "frontend_bucket_name" {
  description = "S3 bucket name for frontend hosting"
  value       = module.frontend_hosting.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.frontend_hosting.cloudfront_distribution_id
}

output "frontend_url" {
  description = "Frontend application URL"
  value       = module.frontend_hosting.frontend_url
}

output "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  value       = module.frontend_hosting.ssl_certificate_arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.frontend_hosting.cloudfront_domain_name
}

# Phase 17 Completion Summary
output "phase_17_deployment_complete" {
  description = "Phase 17 frontend hosting deployment summary"
  value       = <<EOF

🎉 Phase 17 Frontend Hosting Deployment Complete!

Frontend Resources Created:
  - S3 Bucket: ${module.frontend_hosting.s3_bucket_name}
  - CloudFront Distribution: ${module.frontend_hosting.cloudfront_distribution_id}
  - SSL Certificate: ${module.frontend_hosting.ssl_certificate_arn}
  - Frontend URL: ${module.frontend_hosting.frontend_url}

Email System Status:
  - Sender Email: ${module.email_notifications.sender_email}
  - Lambda Function: ${module.email_notifications.email_reminder_function_name}
  - SES Configuration: ${module.email_notifications.ses_configuration_set_name}

Next Steps:
  1. Deploy your React frontend to: ${module.frontend_hosting.s3_bucket_name}
  2. Access your application at: ${module.frontend_hosting.frontend_url}
  3. Update email dashboard links to use: ${module.frontend_hosting.frontend_url}

Your email notifications now point to a real, working frontend! 🚀

EOF
}