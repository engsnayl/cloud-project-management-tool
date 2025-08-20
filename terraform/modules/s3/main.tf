# terraform/modules/s3/main.tf

# Documents bucket for requirement uploads
resource "aws_s3_bucket" "documents" {
  bucket = "${var.project_name}-${var.environment}-documents-${random_string.suffix.result}"
  
  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-documents"
    Environment = var.environment
    Purpose     = "document-storage"
  })
}

# Versioning for document history
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access (security best practice)
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy to manage costs
# Lifecycle policy to manage costs
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "transition_to_ia"
    status = var.enable_lifecycle_policy ? "Enabled" : "Disabled"

    filter {
      prefix = ""  # Apply to all objects
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = var.document_retention_days
    }
  }
}

# CORS configuration for web uploads
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Random suffix for bucket name uniqueness
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Event notification for document processing
resource "aws_s3_bucket_notification" "document_processing" {
  count  = var.enable_event_notifications ? 1 : 0
  bucket = aws_s3_bucket.documents.id

  lambda_function {
    lambda_function_arn = var.document_processor_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".pdf"
  }

  lambda_function {
    lambda_function_arn = var.document_processor_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".docx"
  }

  depends_on = [var.document_processor_lambda_permission]
}