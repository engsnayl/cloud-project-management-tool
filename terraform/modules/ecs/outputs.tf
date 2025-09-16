# terraform/modules/ecs/outputs.tf

output "ecr_repository_url" {
  description = "URL of the ECR repository for document processor"
  value       = aws_ecr_repository.document_processor.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.document_processor.arn
}

output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.document_processor.name
}

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "task_definition_arn" {
  description = "ARN of the document processor task definition"
  value       = aws_ecs_task_definition.document_processor.arn
}

output "task_definition_family" {
  description = "Family of the document processor task definition"
  value       = aws_ecs_task_definition.document_processor.family
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "document_processor_task_role_arn" {
  description = "ARN of the document processor task role"
  value       = aws_iam_role.document_processor_task.arn
}

output "ecs_security_group_id" {
  description = "ID of the ECS tasks security group"
  value       = aws_security_group.ecs_tasks.id
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for document processor"
  value       = aws_cloudwatch_log_group.document_processor.name
}

output "eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule for document processing"
  value       = aws_cloudwatch_event_rule.document_upload.arn
}

output "eventbridge_rule_name" {
  description = "Name of the EventBridge rule for document processing"
  value       = aws_cloudwatch_event_rule.document_upload.name
}

# Container deployment information
output "container_deployment_info" {
  description = "Information needed for container deployment"
  value = {
    repository_url = aws_ecr_repository.document_processor.repository_url
    task_family    = aws_ecs_task_definition.document_processor.family
    cluster_name   = aws_ecs_cluster.main.name
    log_group      = aws_cloudwatch_log_group.document_processor.name
  }
}

# Integration points for existing services
output "integration_info" {
  description = "Integration information for existing services"
  value = {
    eventbridge_rule = aws_cloudwatch_event_rule.document_upload.name
    s3_trigger_pattern = {
      source      = ["deliverycommand.documents"]
      detail-type = ["Document Uploaded"]
      detail = {
        bucket   = [var.s3_bucket_name]
        fileType = ["pdf", "docx", "doc", "txt"]
      }
    }
  }
}