# terraform/modules/lambda/outputs.tf

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "document_processor_function_name" {
  description = "Name of the document processor Lambda function"
  value       = aws_lambda_function.document_processor.function_name
}

output "document_processor_function_arn" {
  description = "ARN of the document processor Lambda function"
  value       = aws_lambda_function.document_processor.arn
}

output "document_processor_invoke_arn" {
  description = "Invoke ARN of the document processor Lambda function"
  value       = aws_lambda_function.document_processor.invoke_arn
}

output "api_handler_function_name" {
  description = "Name of the API handler Lambda function"
  value       = aws_lambda_function.api_handler.function_name
}

output "api_handler_function_arn" {
  description = "ARN of the API handler Lambda function"
  value       = aws_lambda_function.api_handler.arn
}

output "api_handler_invoke_arn" {
  description = "Invoke ARN of the API handler Lambda function"
  value       = aws_lambda_function.api_handler.invoke_arn
}

output "lambda_security_group_id" {
  description = "ID of the Lambda security group (if VPC access enabled)"
  value       = var.enable_vpc_access ? aws_security_group.lambda[0].id : null
}

output "s3_lambda_permission" {
  description = "S3 Lambda permission resource"
  value       = aws_lambda_permission.s3_invoke
}

# terraform/modules/lambda/outputs.tf - Add these outputs

output "jwt_authorizer_function_name" {
  description = "Name of the JWT authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.function_name
}

output "jwt_authorizer_function_arn" {
  description = "ARN of the JWT authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.arn
}

output "jwt_authorizer_invoke_arn" {
  description = "Invoke ARN of the JWT authorizer Lambda function"
  value       = aws_lambda_function.jwt_authorizer.invoke_arn
}