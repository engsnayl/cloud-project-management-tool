# terraform/modules/lambda/main.tf

# IAM role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC access policy for Lambda
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.enable_vpc_access ? 1 : 0
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom IAM policy for Lambda to access DynamoDB and S3
resource "aws_iam_role_policy" "lambda_custom" {
  name = "${var.project_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.s3_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Null resource to create zip files if they don't exist
resource "null_resource" "create_api_handler_zip" {
  triggers = {
    zip_path = var.api_handler_zip_path
  }

  provisioner "local-exec" {
    command     = <<-EOT
      mkdir -p $(dirname ${var.api_handler_zip_path})
      cd $(dirname ${var.api_handler_zip_path})
      if [ ! -f lambda_function.py ]; then
        echo 'def lambda_handler(event, context):\n    return {"statusCode": 200, "body": "API Handler"}' > lambda_function.py
      fi
      zip -r $(basename ${var.api_handler_zip_path}) lambda_function.py
    EOT
    interpreter = ["bash", "-c"]
  }
}

resource "null_resource" "create_jwt_authorizer_zip" {
  triggers = {
    zip_path = var.jwt_authorizer_zip_path
  }

  provisioner "local-exec" {
    command     = <<-EOT
      mkdir -p $(dirname ${var.jwt_authorizer_zip_path})
      cd $(dirname ${var.jwt_authorizer_zip_path})
      if [ ! -f lambda_function.py ]; then
        echo 'def lambda_handler(event, context):\n    return {"principalId": "user", "policyDocument": {"Version": "2012-10-17", "Statement": [{"Action": "execute-api:Invoke", "Effect": "Allow", "Resource": "*"}]}}' > lambda_function.py
      fi
      zip -r $(basename ${var.jwt_authorizer_zip_path}) lambda_function.py
    EOT
    interpreter = ["bash", "-c"]
  }
}

# API Handler Lambda Function
resource "aws_lambda_function" "api_handler" {
  filename      = var.api_handler_zip_path
  function_name = "${var.project_name}-${var.environment}-api-handler"
  role          = aws_iam_role.lambda_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = 30

  depends_on = [null_resource.create_api_handler_zip]

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
      S3_BUCKET      = var.s3_bucket_name
      ENVIRONMENT    = var.environment
    }
  }

  dynamic "vpc_config" {
    for_each = var.enable_vpc_access ? [1] : []
    content {
      subnet_ids         = var.private_subnet_ids
      security_group_ids = [aws_security_group.lambda[0].id]
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-api-handler"
    Environment = var.environment
    Purpose     = "api-processing"
  })
}

# JWT Authorizer Lambda Function
resource "aws_lambda_function" "jwt_authorizer" {
  filename      = var.jwt_authorizer_zip_path
  function_name = "${var.project_name}-${var.environment}-jwt-authorizer"
  role          = aws_iam_role.lambda_role.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = 10

  depends_on = [null_resource.create_jwt_authorizer_zip]

  environment {
    variables = {
      COGNITO_USER_POOL_ID  = var.cognito_user_pool_id != "" ? var.cognito_user_pool_id : "placeholder"
      COGNITO_APP_CLIENT_ID = var.cognito_app_client_id != "" ? var.cognito_app_client_id : "placeholder"
      API_ARN_PREFIX        = var.api_gateway_execution_arn != "" ? var.api_gateway_execution_arn : "placeholder"
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-jwt-authorizer"
    Environment = var.environment
    Purpose     = "authentication"
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api_handler" {
  name              = "/aws/lambda/${aws_lambda_function.api_handler.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-api-handler-logs"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_log_group" "jwt_authorizer" {
  name              = "/aws/lambda/${aws_lambda_function.jwt_authorizer.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-jwt-authorizer-logs"
    Environment = var.environment
  })
}

# Security Group for Lambda (if VPC access enabled)
resource "aws_security_group" "lambda" {
  count       = var.enable_vpc_access ? 1 : 0
  name        = "${var.project_name}-${var.environment}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-lambda-sg"
    Environment = var.environment
  })
}