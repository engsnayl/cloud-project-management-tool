# terraform/modules/email-notifications/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for current AWS caller identity
data "aws_caller_identity" "current" {}

# SES Domain Identity for sending emails
resource "aws_ses_domain_identity" "action_tracker" {
  count  = var.domain_name != "" ? 1 : 0
  domain = var.domain_name
}

# SES Email Identity for development (using specific email)
resource "aws_ses_email_identity" "sender_email" {
  count = var.sender_email != "" ? 1 : 0
  email = var.sender_email
}

# SES Configuration Set for tracking email metrics
resource "aws_ses_configuration_set" "action_reminders" {
  name = "${var.project_name}-${var.environment}-action-reminders"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
}

# SES Email Template for daily action reminders
resource "aws_ses_template" "daily_action_reminder" {
  name    = "${var.project_name}-${var.environment}-daily-reminder"
  subject = "Your Action Items for {{date}}"
  
  html = <<-EOT
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px; }
            .action-item { background-color: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
            .priority-high { border-left-color: #ef4444; }
            .priority-medium { border-left-color: #f59e0b; }
            .priority-low { border-left-color: #10b981; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
            .btn { background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Your Daily Action Items</h1>
            <p>Hello {{owner_name}}, here are your action items for {{date}}</p>
        </div>
        
        {{#actions}}
        <div class="action-item priority-{{priority_lower}}">
            <h3>{{title}}</h3>
            <p><strong>Description:</strong> {{description}}</p>
            <p><strong>Project:</strong> {{project_name}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Deadline:</strong> {{deadline}}</p>
            <p><strong>Status:</strong> {{status}}</p>
        </div>
        {{/actions}}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboard_url}}" class="btn">Update Your Actions</a>
        </div>
        
        <div class="footer">
            <p>This is an automated reminder from ActionTracker. Total actions: {{total_actions}}</p>
            <p>Dashboard: <a href="{{dashboard_url}}">{{dashboard_url}}</a></p>
        </div>
    </body>
    </html>
  EOT

  text = <<-EOT
    Your Daily Action Items - {{date}}
    
    Hello {{owner_name}},
    
    Here are your action items for today:
    
    {{#actions}}
    - {{title}} ({{priority}} Priority)
      Project: {{project_name}}
      Deadline: {{deadline}}
      Status: {{status}}
      Description: {{description}}
    
    {{/actions}}
    
    Total actions: {{total_actions}}
    
    Update your actions: {{dashboard_url}}
    
    ---
    This is an automated reminder from ActionTracker
  EOT
}

# SES Email Template for overdue action alerts
resource "aws_ses_template" "overdue_action_alert" {
  name    = "${var.project_name}-${var.environment}-overdue-alert"
  subject = "URGENT: {{overdue_count}} Overdue Action Items"
  
  html = <<-EOT
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 8px; }
            .action-item { background-color: #fef2f2; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #ef4444; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
            .btn { background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⚠️ Overdue Action Items</h1>
            <p>Hello {{owner_name}}, you have {{overdue_count}} overdue action items that need immediate attention!</p>
        </div>
        
        {{#overdue_actions}}
        <div class="action-item">
            <h3>{{title}} - {{days_overdue}} days overdue</h3>
            <p><strong>Description:</strong> {{description}}</p>
            <p><strong>Project:</strong> {{project_name}}</p>
            <p><strong>Original Deadline:</strong> {{deadline}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
        </div>
        {{/overdue_actions}}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboard_url}}" class="btn">Update Overdue Actions Now</a>
        </div>
        
        <div class="footer">
            <p>Please update these actions immediately to maintain project momentum.</p>
        </div>
    </body>
    </html>
  EOT

  text = <<-EOT
    URGENT: {{overdue_count}} Overdue Action Items
    
    Hello {{owner_name}},
    
    You have overdue action items that need immediate attention:
    
    {{#overdue_actions}}
    - {{title}} ({{days_overdue}} days overdue)
      Project: {{project_name}}
      Original Deadline: {{deadline}}
      Priority: {{priority}}
      Description: {{description}}
    
    {{/overdue_actions}}
    
    Please update these actions immediately: {{dashboard_url}}
    
    ---
    This is an automated alert from ActionTracker
  EOT
}

# Lambda function for sending daily email reminders
resource "aws_lambda_function" "email_reminder" {
  filename         = "${path.module}/email-reminder.zip"
  function_name    = "${var.project_name}-${var.environment}-email-reminder"
  role            = aws_iam_role.email_reminder_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 300

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = var.dynamodb_table_name
      SES_CONFIGURATION_SET = aws_ses_configuration_set.action_reminders.name
      SENDER_EMAIL = var.sender_email
      DASHBOARD_URL = var.dashboard_url
      DAILY_REMINDER_TEMPLATE = aws_ses_template.daily_action_reminder.name
      OVERDUE_ALERT_TEMPLATE = aws_ses_template.overdue_action_alert.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.email_reminder_policy,
    aws_cloudwatch_log_group.email_reminder_logs,
  ]

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-email-reminder"
    Environment = var.environment
    Purpose     = "email-notifications"
  })
}

# CloudWatch Log Group for email reminder Lambda
resource "aws_cloudwatch_log_group" "email_reminder_logs" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-email-reminder"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-email-reminder-logs"
    Environment = var.environment
    Purpose     = "logging"
  })
}

# IAM Role for email reminder Lambda
resource "aws_iam_role" "email_reminder_role" {
  name = "${var.project_name}-${var.environment}-email-reminder-role"

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

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-email-reminder-role"
    Environment = var.environment
    Purpose     = "lambda-execution"
  })
}

# IAM Policy for email reminder Lambda
resource "aws_iam_role_policy" "email_reminder_policy" {
  name = "${var.project_name}-${var.environment}-email-reminder-policy"
  role = aws_iam_role.email_reminder_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendTemplatedEmail",
          "ses:SendBulkTemplatedEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach basic execution role to Lambda
resource "aws_iam_role_policy_attachment" "email_reminder_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.email_reminder_role.name
}

# EventBridge Scheduler for daily reminders (9 AM weekdays)
resource "aws_scheduler_schedule" "daily_reminder" {
  name                         = "${var.project_name}-${var.environment}-daily-reminder"
  description                  = "Send daily action reminders at 9 AM on weekdays"
  state                        = var.enable_daily_reminders ? "ENABLED" : "DISABLED"
  group_name                   = "default"
  
  # Cron expression: 9 AM Monday-Friday UTC (adjust for your timezone)
  schedule_expression          = "cron(0 9 ? * MON-FRI *)"
  schedule_expression_timezone = var.reminder_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.email_reminder.arn
    role_arn = aws_iam_role.scheduler_role.arn

    input = jsonencode({
      action = "send_daily_reminders"
      reminder_type = "daily"
    })

    retry_policy {
      maximum_retry_attempts = 3
    }

    dead_letter_config {
      arn = aws_sqs_queue.email_dlq.arn
    }
  }
}

# EventBridge Scheduler for overdue alerts (daily at 10 AM)
resource "aws_scheduler_schedule" "overdue_alert" {
  count                        = var.enable_overdue_alerts ? 1 : 0
  name                         = "${var.project_name}-${var.environment}-overdue-alert"
  description                  = "Send overdue action alerts at 10 AM daily"
  state                        = "ENABLED"
  group_name                   = "default"
  
  # Cron expression: 10 AM daily UTC
  schedule_expression          = "cron(0 10 * * ? *)"
  schedule_expression_timezone = var.reminder_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.email_reminder.arn
    role_arn = aws_iam_role.scheduler_role.arn

    input = jsonencode({
      action = "send_overdue_alerts"
      reminder_type = "overdue"
    })

    retry_policy {
      maximum_retry_attempts = 3
    }

    dead_letter_config {
      arn = aws_sqs_queue.email_dlq.arn
    }
  }
}

# IAM Role for EventBridge Scheduler
resource "aws_iam_role" "scheduler_role" {
  name = "${var.project_name}-${var.environment}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-scheduler-role"
    Environment = var.environment
    Purpose     = "scheduler-execution"
  })
}

# IAM Policy for EventBridge Scheduler to invoke Lambda
resource "aws_iam_role_policy" "scheduler_policy" {
  name = "${var.project_name}-${var.environment}-scheduler-policy"
  role = aws_iam_role.scheduler_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.email_reminder.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.email_dlq.arn
      }
    ]
  })
}

# Dead Letter Queue for failed email notifications
resource "aws_sqs_queue" "email_dlq" {
  name                       = "${var.project_name}-${var.environment}-email-dlq"
  message_retention_seconds  = 1209600  # 14 days
  visibility_timeout_seconds = 300

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-email-dlq"
    Environment = var.environment
    Purpose     = "email-failure-handling"
  })
}

# Lambda permission for EventBridge Scheduler
resource "aws_lambda_permission" "allow_scheduler" {
  statement_id  = "AllowExecutionFromScheduler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_reminder.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.daily_reminder.arn
}

# Lambda permission for overdue alerts scheduler
resource "aws_lambda_permission" "allow_overdue_scheduler" {
  count         = var.enable_overdue_alerts ? 1 : 0
  statement_id  = "AllowExecutionFromOverdueScheduler"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_reminder.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.overdue_alert[0].arn
}