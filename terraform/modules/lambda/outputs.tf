# terraform/modules/lambda/outputs.tf

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

# API Handler outputs
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

# JWT Authorizer outputs
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

# Document Review API outputs
output "document_review_api_function_name" {
  description = "Name of the document review API Lambda function"
  value       = aws_lambda_function.document_review_api.function_name
}

output "document_review_api_function_arn" {
  description = "ARN of the document review API Lambda function"
  value       = aws_lambda_function.document_review_api.arn
}

output "document_review_api_invoke_arn" {
  description = "Invoke ARN of the document review API Lambda function"
  value       = aws_lambda_function.document_review_api.invoke_arn
}

# Optional outputs
output "lambda_security_group_id" {
  description = "ID of the Lambda security group (if VPC access enabled)"
  value       = var.enable_vpc_access ? aws_security_group.lambda[0].id : null
}