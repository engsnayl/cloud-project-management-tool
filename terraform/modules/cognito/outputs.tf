# terraform/modules/cognito/outputs.tf

output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_pool_domain_cloudfront_distribution" {
  description = "CloudFront distribution for the User Pool Domain"
  value       = aws_cognito_user_pool_domain.main.cloudfront_distribution_arn
}

output "identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "authenticated_role_arn" {
  description = "IAM role ARN for authenticated users"
  value       = aws_iam_role.authenticated.arn
}

# OAuth URLs for frontend integration
output "oauth_login_url" {
  description = "OAuth login URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.main.id}&response_type=code&scope=email+openid+profile&redirect_uri=${var.frontend_url != "" ? var.frontend_url : "http://localhost:3000"}/callback"
}

output "oauth_logout_url" {
  description = "OAuth logout URL"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/logout?client_id=${aws_cognito_user_pool_client.main.id}&logout_uri=${var.frontend_url != "" ? var.frontend_url : "http://localhost:3000"}/"
}

# Data source for current AWS region
data "aws_region" "current" {}