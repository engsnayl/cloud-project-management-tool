# terraform/modules/frontend-hosting/outputs.tf

output "s3_bucket_name" {
  description = "Name of the S3 bucket for frontend hosting"
  value       = aws_s3_bucket.frontend.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "URL of the frontend application"
  value       = "https://${var.domain_name}"
}

output "ssl_certificate_arn" {
  description = "ARN of the SSL certificate"
  value       = aws_acm_certificate.frontend.arn
}