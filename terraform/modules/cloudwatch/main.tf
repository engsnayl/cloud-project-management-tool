# terraform/modules/cloudwatch/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get current region and account ID
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# CloudWatch Dashboard - System Health Overview
resource "aws_cloudwatch_dashboard" "system_health" {
  dashboard_name = "${var.project_name}-${var.environment}-system-health"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "${var.api_gateway_name}"],
            [".", "Latency", ".", "."],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "API Gateway Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.api_handler_function_name}"],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."],
            [".", "ConcurrentExecutions", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Lambda Function Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.dynamodb_table_name}"],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "UserErrors", ".", "."],
            [".", "SystemErrors", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "DynamoDB Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/S3", "BucketRequests", "BucketName", "${var.s3_bucket_name}", "FilterId", "EntireBucket"],
            [".", "BucketSizeBytes", ".", ".", "StorageType", "StandardStorage"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "S3 Usage"
          period  = 300
        }
      }
    ]
  })
  # Note: CloudWatch dashboards don't support tags
}

# CloudWatch Dashboard - Business Metrics
resource "aws_cloudwatch_dashboard" "business_metrics" {
  dashboard_name = "${var.project_name}-${var.environment}-business-metrics"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DeliveryCommand/Business", "ActionsCreated", "Environment", var.environment],
            [".", "ActionsCompleted", ".", "."],
            [".", "ActionsPending", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Action Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DeliveryCommand/Business", "DocumentsUploaded", "Environment", var.environment],
            [".", "DocumentsProcessed", ".", "."],
            [".", "DocumentProcessingErrors", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Document Processing"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DeliveryCommand/Business", "ActiveUsers", "Environment", var.environment],
            [".", "LoginAttempts", ".", "."],
            [".", "FailedLogins", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "User Activity"
          period  = 300
        }
      }
    ]
  })
  # Note: CloudWatch dashboards don't support tags
}

# CloudWatch Dashboard - Cost Monitoring
resource "aws_cloudwatch_dashboard" "cost_monitoring" {
  dashboard_name = "${var.project_name}-${var.environment}-costs"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "${var.api_handler_function_name}"],
            [".", "Duration", "FunctionName", "${var.document_processor_function_name}"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Lambda Execution Time (Cost Driver)"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.dynamodb_table_name}"],
            [".", "ConsumedWriteCapacityUnits", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "DynamoDB Capacity Usage"
          period  = 300
        }
      }
    ]
  })
  # Note: CloudWatch dashboards don't support tags
}

# CloudWatch Alarms - Critical System Health
resource "aws_cloudwatch_metric_alarm" "api_high_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-api-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This alarm monitors API Gateway 5XX errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiName = var.api_gateway_name
  }
  # Note: CloudWatch metric alarms don't support tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_high_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-high-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This alarm monitors Lambda function errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = var.api_handler_function_name
  }
  # Note: CloudWatch metric alarms don't support tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_high_duration" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-high-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000"  # 10 seconds
  alarm_description   = "This alarm monitors Lambda function duration"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = var.api_handler_function_name
  }
  # Note: CloudWatch metric alarms don't support tags
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Log Groups for Application Logs
resource "aws_cloudwatch_log_group" "api_handler_logs" {
  name              = "/aws/lambda/${var.api_handler_function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "document_processor_logs" {
  name              = "/aws/lambda/${var.document_processor_function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# Custom Log Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.project_name}-${var.environment}-error-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.api_handler_logs.name,
    aws_cloudwatch_log_group.document_processor_logs.name
  ]

  query_string = <<EOF
fields @timestamp, @message, @logStream, @log
| filter @message like /ERROR/ or @message like /Exception/ or @message like /Failed/
| sort @timestamp desc
| limit 100
EOF
  # Note: CloudWatch query definitions don't support tags
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.project_name}-${var.environment}-performance-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.api_handler_logs.name
  ]

  query_string = <<EOF
fields @timestamp, @duration, @billedDuration, @message
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
| sort @timestamp desc
EOF
  # Note: CloudWatch query definitions don't support tags
}