# terraform/modules/lambda/outputs.tf

output "api_handler_role_arn" {
  description = "ARN of the API Handler Lambda execution role"
  value       = aws_iam_role.api_handler_role.arn
}

output "jwt_authorizer_role_arn" {
  description = "ARN of the JWT Authorizer Lambda execution role"
  value       = aws_iam_role.jwt_authorizer_role.arn
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

# Optional outputs
output "lambda_security_group_id" {
  description = "ID of the Lambda security group (if VPC access enabled)"
  value       = var.enable_vpc_access ? aws_security_group.lambda[0].id : null
}
