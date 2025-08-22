# terraform/environments/dev/outputs.tf

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = module.dynamodb.table_arn
}

output "s3_bucket_name" {
  description = "Name of the documents S3 bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the documents S3 bucket"
  value       = module.s3.bucket_arn
}

output "api_gateway_url" {
  description = "Base URL for the API Gateway"
  value       = module.api_gateway.api_gateway_url
}

output "health_endpoint" {
  description = "Health check endpoint"
  value       = module.api_gateway.health_endpoint
}

output "requirements_endpoint" {
  description = "Requirements API endpoint"
  value       = module.api_gateway.requirements_endpoint
}

output "projects_endpoint" {
  description = "Projects API endpoint"
  value       = module.api_gateway.projects_endpoint
}