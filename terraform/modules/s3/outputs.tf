# terraform/modules/s3/outputs.tf

output "bucket_name" {
  description = "Name of the S3 documents bucket"
  value       = aws_s3_bucket.documents.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 documents bucket"
  value       = aws_s3_bucket.documents.arn
}

output "bucket_id" {
  description = "ID of the S3 documents bucket"
  value       = aws_s3_bucket.documents.id
}

output "bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.documents.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.documents.bucket_regional_domain_name
}

output "bucket_website_endpoint" {
  description = "Website endpoint of the S3 bucket"
  value       = aws_s3_bucket.documents.website_endpoint
}