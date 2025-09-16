# terraform/modules/ecs/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0.0"
    }
  }
}

# ECR Repository for Document Processing Container
resource "aws_ecr_repository" "document_processor" {
  name                 = "${var.project_name}-${var.environment}-document-processor"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }



  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processor"
    Environment = var.environment
    Purpose     = "container-registry"
  })
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-cluster"
    Environment = var.environment
    Purpose     = "container-orchestration"
  })
}

# CloudWatch Log Group for ECS Tasks
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-ecs-logs"
    Environment = var.environment
    Purpose     = "container-logging"
  })
}

# CloudWatch Log Group for Document Processor
resource "aws_cloudwatch_log_group" "document_processor" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}/document-processor"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processor-logs"
    Environment = var.environment
    Purpose     = "application-logging"
  })
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-ecs-task-execution"
    Environment = var.environment
    Purpose     = "container-execution"
  })
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for Document Processing Task
resource "aws_iam_role" "document_processor_task" {
  name = "${var.project_name}-${var.environment}-document-processor-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processor-task"
    Environment = var.environment
    Purpose     = "application-permissions"
  })
}

# IAM Policy for Document Processor Task
resource "aws_iam_policy" "document_processor_task" {
  name = "${var.project_name}-${var.environment}-document-processor-task"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${var.s3_bucket_arn}",
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
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
          "events:PutEvents"
        ]
        Resource = var.eventbridge_bus_arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.document_processor.arn}:*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processor-task"
    Environment = var.environment
    Purpose     = "application-permissions"
  })
}

# Attach custom policy to task role
resource "aws_iam_role_policy_attachment" "document_processor_task" {
  role       = aws_iam_role.document_processor_task.name
  policy_arn = aws_iam_policy.document_processor_task.arn
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-${var.environment}-ecs-tasks-"
  vpc_id      = var.vpc_id
  description = "Security group for ECS tasks in ${var.environment}"

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-ecs-tasks"
    Environment = var.environment
    Purpose     = "container-security"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ECS Task Definition for Document Processor
resource "aws_ecs_task_definition" "document_processor" {
  family                   = "${var.project_name}-${var.environment}-document-processor"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.document_processor_cpu
  memory                   = var.document_processor_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.document_processor_task.arn

  container_definitions = jsonencode([
    {
      name      = "document-processor"
      image     = "${aws_ecr_repository.document_processor.repository_url}:latest"
      essential = true

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "PROJECT_NAME"
          value = var.project_name
        },
        {
          name  = "DYNAMODB_TABLE_NAME"
          value = var.dynamodb_table_name
        },
        {
          name  = "S3_BUCKET_NAME"
          value = var.s3_bucket_name
        },
        {
          name  = "EVENTBRIDGE_BUS_NAME"
          value = var.eventbridge_bus_name
        },
        {
          name  = "AWS_DEFAULT_REGION"
          value = data.aws_region.current.name
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.document_processor.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "python", "-c", "print('healthy')"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processor"
    Environment = var.environment
    Purpose     = "container-definition"
  })
}

# Data source for current AWS region
data "aws_region" "current" {}

# EventBridge Rule for S3 Document Uploads
resource "aws_cloudwatch_event_rule" "document_upload" {
  name           = "${var.project_name}-${var.environment}-document-upload"
  event_bus_name = var.eventbridge_bus_name
  description    = "Trigger document processing on S3 upload"

  event_pattern = jsonencode({
    source      = ["deliverycommand.documents"]
    detail-type = ["Document Uploaded"]
    detail = {
      bucket   = [var.s3_bucket_name]
      fileType = ["pdf", "docx", "doc", "txt"]
    }
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-upload"
    Environment = var.environment
    Purpose     = "event-processing"
  })
}

# EventBridge Target: Document Upload -> ECS Task
resource "aws_cloudwatch_event_target" "document_processor" {
  rule           = aws_cloudwatch_event_rule.document_upload.name
  target_id      = "DocumentProcessorTask"
  arn            = aws_ecs_cluster.main.arn
  event_bus_name = var.eventbridge_bus_name
  role_arn       = aws_iam_role.eventbridge_ecs.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.document_processor.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"

    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = [aws_security_group.ecs_tasks.id]
      assign_public_ip = false
    }


  }

  input_transformer {
    input_paths = {
      bucket = "$.detail.bucket"
      key    = "$.detail.key"
      userId = "$.detail.userId"
    }
    input_template = jsonencode({
      containerOverrides = [
        {
          name = "document-processor"
          environment = [
            {
              name  = "DOCUMENT_BUCKET"
              value = "<bucket>"
            },
            {
              name  = "DOCUMENT_KEY"
              value = "<key>"
            },
            {
              name  = "USER_ID"
              value = "<userId>"
            }
          ]
        }
      ]
    })
  }
}

# IAM Role for EventBridge to invoke ECS
resource "aws_iam_role" "eventbridge_ecs" {
  name = "${var.project_name}-${var.environment}-eventbridge-ecs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-eventbridge-ecs"
    Environment = var.environment
    Purpose     = "event-ecs-integration"
  })
}

# IAM Policy for EventBridge ECS Role
resource "aws_iam_policy" "eventbridge_ecs" {
  name = "${var.project_name}-${var.environment}-eventbridge-ecs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask"
        ]
        Resource = aws_ecs_task_definition.document_processor.arn
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.document_processor_task.arn
        ]
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-eventbridge-ecs"
    Environment = var.environment
    Purpose     = "event-ecs-permissions"
  })
}

# Attach policy to EventBridge ECS role
resource "aws_iam_role_policy_attachment" "eventbridge_ecs" {
  role       = aws_iam_role.eventbridge_ecs.name
  policy_arn = aws_iam_policy.eventbridge_ecs.arn
}