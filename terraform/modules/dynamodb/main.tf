# terraform/modules/dynamodb/main.tf

# Main application table - single table design
resource "aws_dynamodb_table" "main" {
  name         = "${var.project_name}-${var.environment}-main"
  billing_mode = "PAY_PER_REQUEST" # Cost-effective for dev
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # Global Secondary Index for queries
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL" # Project all attributes
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-main-table"
    Environment = var.environment
  })
}