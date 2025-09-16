# terraform/environments/dev/outputs.tf

# Infrastructure Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# Database Outputs
output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = module.dynamodb.table_arn
}

# Storage Outputs
output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3.bucket_arn
}

# API Outputs
output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.api_gateway.api_gateway_url
}

output "api_gateway_arn" {
  description = "API Gateway ARN"
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

# Authentication Outputs
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

# Event Processing Outputs
output "event_bus_name" {
  description = "EventBridge event bus name"
  value       = module.eventbridge.event_bus_name
}

output "event_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = module.eventbridge.event_bus_arn
}

output "event_dlq_url" {
  description = "EventBridge dead letter queue URL"
  value       = module.eventbridge.event_dlq_url
}

# Monitoring Outputs
output "alert_topic_arn" {
  description = "SNS alerts topic ARN"
  value       = module.cloudwatch.sns_alerts_topic_arn
}

# Security Outputs
output "cloudtrail_arn" {
  description = "CloudTrail ARN"
  value       = module.cloudtrail.cloudtrail_arn
}

output "cloudtrail_s3_bucket" {
  description = "CloudTrail S3 bucket name"
  value       = module.cloudtrail.cloudtrail_s3_bucket_name
}

# Email Outputs
output "sender_email" {
  description = "Email sender address"
  value       = module.email_notifications.sender_email
}

output "email_reminder_function_name" {
  description = "Email reminder function name"
  value       = module.email_notifications.email_reminder_function_name
}

# Frontend Outputs
output "frontend_url" {
  description = "Frontend application URL"
  value       = module.frontend_hosting.frontend_url
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  value       = module.frontend_hosting.s3_bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.frontend_hosting.cloudfront_distribution_id
}

# Container Platform Outputs
output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecs.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.ecs_cluster_name
}

output "container_log_group" {
  description = "Container log group name"
  value       = module.ecs.cloudwatch_log_group_name
}

# Application Configuration
output "auth_config" {
  description = "Authentication configuration for frontend"
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

output "container_deployment_info" {
  description = "Container deployment information"
  value = {
    repository_url = module.ecs.ecr_repository_url
    cluster_name   = module.ecs.ecs_cluster_name
    task_family    = module.ecs.task_definition_family
    log_group      = module.ecs.cloudwatch_log_group_name
  }
}