# terraform/modules/api-gateway/main.tf
# API Gateway REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.project_name}-${var.environment}-api"
  description = "DeliveryCommand API for requirements and project management"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-api"
    Environment = var.environment
  })
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_method.health_get,
    aws_api_gateway_method.requirements_get,
    aws_api_gateway_method.requirements_post,
    aws_api_gateway_method.projects_get,
    aws_api_gateway_method.projects_post,
    aws_api_gateway_method.actions_get,
    aws_api_gateway_method.actions_post,
    aws_api_gateway_method.options_health,
    aws_api_gateway_method.options_requirements,
    aws_api_gateway_method.options_projects,
    aws_api_gateway_method.options_actions
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id

  lifecycle {
    create_before_destroy = true
  }

  # Force redeployment on changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.api.id,
      aws_api_gateway_resource.v1.id,
      aws_api_gateway_resource.health.id,
      aws_api_gateway_resource.requirements.id,
      aws_api_gateway_resource.projects.id,
      aws_api_gateway_resource.actions.id,
      aws_api_gateway_method.health_get.id,
      aws_api_gateway_method.requirements_get.id,
      aws_api_gateway_method.requirements_post.id,
      aws_api_gateway_method.projects_get.id,
      aws_api_gateway_method.projects_post.id,
      aws_api_gateway_method.actions_get.id,
      aws_api_gateway_method.actions_post.id,
    ]))
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.stage_name

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-${var.stage_name}"
    Environment = var.environment
  })
}

# Enable CloudWatch logging
resource "aws_api_gateway_method_settings" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled = true
  }
}

# Create /api resource
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "api"
}

# Create /api/v1 resource
resource "aws_api_gateway_resource" "v1" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "v1"
}

# Create /api/v1/health resource
resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "health"
}

# Create /api/v1/requirements resource
resource "aws_api_gateway_resource" "requirements" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "requirements"
}

# Create /api/v1/projects resource
resource "aws_api_gateway_resource" "projects" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "projects"
}

# Create /api/v1/actions resource
resource "aws_api_gateway_resource" "actions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "actions"
}

# Lambda Authorizer
resource "aws_api_gateway_authorizer" "jwt_authorizer" {
  name                   = "${var.project_name}-${var.environment}-jwt-authorizer"
  rest_api_id            = aws_api_gateway_rest_api.main.id
  authorizer_uri         = var.jwt_authorizer_invoke_arn
  authorizer_credentials = aws_iam_role.api_gateway_authorizer.arn
  type                   = "TOKEN"
  identity_source        = "method.request.header.Authorization"
  identity_validation_expression = "^Bearer [\\w-]*\\.[\\w-]*\\.[\\w-]*$"  # JWT token pattern
}

# IAM role for API Gateway to invoke the authorizer Lambda
resource "aws_iam_role" "api_gateway_authorizer" {
  name = "${var.project_name}-${var.environment}-apigw-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
}

# Policy to allow API Gateway to invoke the authorizer Lambda
resource "aws_iam_role_policy" "api_gateway_authorizer" {
  name = "${var.project_name}-${var.environment}-apigw-auth-policy"
  role = aws_iam_role.api_gateway_authorizer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = "lambda:InvokeFunction"
        Effect   = "Allow"
        Resource = var.jwt_authorizer_invoke_arn
      }
    ]
  })
}

# Health endpoint - GET method (keep this open for health checks)
resource "aws_api_gateway_method" "health_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "GET"
  authorization = "NONE"  # No authorization for health checks
}

# Health endpoint - GET integration
resource "aws_api_gateway_integration" "health_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.health_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Requirements endpoint - GET method with JWT authorizer
resource "aws_api_gateway_method" "requirements_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.requirements.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Requirements endpoint - GET integration
resource "aws_api_gateway_integration" "requirements_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.requirements.id
  http_method = aws_api_gateway_method.requirements_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Requirements endpoint - POST method with JWT authorizer
resource "aws_api_gateway_method" "requirements_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.requirements.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Requirements endpoint - POST integration
resource "aws_api_gateway_integration" "requirements_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.requirements.id
  http_method = aws_api_gateway_method.requirements_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Projects endpoint - GET method with JWT authorizer
resource "aws_api_gateway_method" "projects_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Projects endpoint - GET integration
resource "aws_api_gateway_integration" "projects_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Projects endpoint - POST method with JWT authorizer
resource "aws_api_gateway_method" "projects_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Projects endpoint - POST integration
resource "aws_api_gateway_integration" "projects_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.projects_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Actions endpoint - GET method with JWT authorizer
resource "aws_api_gateway_method" "actions_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.actions.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Actions endpoint - GET integration
resource "aws_api_gateway_integration" "actions_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.actions.id
  http_method = aws_api_gateway_method.actions_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# Actions endpoint - POST method with JWT authorizer
resource "aws_api_gateway_method" "actions_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.actions.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt_authorizer.id
}

# Actions endpoint - POST integration
resource "aws_api_gateway_integration" "actions_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.actions.id
  http_method = aws_api_gateway_method.actions_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.api_handler_invoke_arn
}

# CORS OPTIONS methods
resource "aws_api_gateway_method" "options_health" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "options_requirements" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.requirements.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "options_projects" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.projects.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "options_actions" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.actions.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# CORS OPTIONS integrations
resource "aws_api_gateway_integration" "options_health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.options_health.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "options_requirements" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.requirements.id
  http_method = aws_api_gateway_method.options_requirements.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "options_projects" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.options_projects.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_integration" "options_actions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.actions.id
  http_method = aws_api_gateway_method.options_actions.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

# CORS method responses
resource "aws_api_gateway_method_response" "options_health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.options_health.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_method_response" "options_requirements" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.requirements.id
  http_method = aws_api_gateway_method.options_requirements.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_method_response" "options_projects" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.options_projects.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_method_response" "options_actions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.actions.id
  http_method = aws_api_gateway_method.options_actions.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# CORS integration responses
resource "aws_api_gateway_integration_response" "options_health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.health.id
  http_method = aws_api_gateway_method.options_health.http_method
  status_code = aws_api_gateway_method_response.options_health.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "options_requirements" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.requirements.id
  http_method = aws_api_gateway_method.options_requirements.http_method
  status_code = aws_api_gateway_method_response.options_requirements.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "options_projects" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.projects.id
  http_method = aws_api_gateway_method.options_projects.http_method
  status_code = aws_api_gateway_method_response.options_projects.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

resource "aws_api_gateway_integration_response" "options_actions" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.actions.id
  http_method = aws_api_gateway_method.options_actions.http_method
  status_code = aws_api_gateway_method_response.options_actions.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.api_handler_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Data source for current AWS region
data "aws_region" "current" {}