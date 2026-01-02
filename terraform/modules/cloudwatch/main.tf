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
}

resource "aws_cloudwatch_metric_alarm" "lambda_high_duration" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-high-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000" # 10 seconds
  alarm_description   = "This alarm monitors Lambda function duration"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = var.api_handler_function_name
  }
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

# Custom Log Insights Queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.project_name}-${var.environment}-error-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.api_handler_logs.name,
  ]

  query_string = <<EOF
fields @timestamp, @message, @logStream, @log
| filter @message like /ERROR/ or @message like /Exception/ or @message like /Failed/
| sort @timestamp desc
| limit 100
EOF
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
}

# PHASE 9.2: Advanced Business Metrics Alarms
resource "aws_cloudwatch_metric_alarm" "actions_overdue_high" {
  alarm_name          = "${var.project_name}-${var.environment}-actions-overdue-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ActionsOverdueCount"
  namespace           = "DeliveryCommand/Business"
  period              = "300"
  statistic           = "Maximum"
  threshold           = var.overdue_actions_threshold
  alarm_description   = "This alarm monitors overdue actions count"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_metric_alarm" "actions_created_low" {
  alarm_name          = "${var.project_name}-${var.environment}-actions-created-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "ActionsCreatedToday"
  namespace           = "DeliveryCommand/Business"
  period              = "3600" # 1 hour
  statistic           = "Maximum"
  threshold           = var.business_hours_actions_threshold
  alarm_description   = "Actions creation rate is unusually low"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Composite Alarm for System Health
resource "aws_cloudwatch_composite_alarm" "system_critical_health" {
  alarm_name        = "${var.project_name}-${var.environment}-system-critical-health"
  alarm_description = "Composite alarm for critical system health issues"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.api_high_error_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.lambda_high_error_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.lambda_high_duration.alarm_name})"
  ])

  actions_enabled = true
  alarm_actions   = [aws_sns_topic.critical_alerts.arn]
}

# Critical alerts SNS topic (separate from regular alerts)
resource "aws_sns_topic" "critical_alerts" {
  name = "${var.project_name}-${var.environment}-critical-alerts"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "critical_email_alerts" {
  count     = var.critical_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.critical_alert_email
}

# Business Hours Alert (conditional)
resource "aws_cloudwatch_metric_alarm" "business_hours_actions_low" {
  count = var.enable_business_hours_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-business-hours-actions-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "ActionsCreatedToday"
  namespace           = "DeliveryCommand/Business"
  period              = "3600" # 1 hour
  statistic           = "Sum"
  threshold           = var.business_hours_actions_threshold
  alarm_description   = "Actions creation rate is unusually low during business hours"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Cost Alert - Lambda Duration Trending Up
resource "aws_cloudwatch_metric_alarm" "lambda_cost_trend" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-cost-trend"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  datapoints_to_alarm = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "900" # 15 minutes
  statistic           = "Average"
  threshold           = var.lambda_duration_cost_threshold
  alarm_description   = "Lambda execution time trending upward - cost impact"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = var.api_handler_function_name
  }
}

# API Gateway Latency Trend
resource "aws_cloudwatch_metric_alarm" "api_latency_trend" {
  alarm_name          = "${var.project_name}-${var.environment}-api-latency-trend"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  datapoints_to_alarm = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Average"
  threshold           = var.api_latency_threshold
  alarm_description   = "API Gateway latency is trending upward"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
  }
}

# DynamoDB Throttling Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttling" {
  alarm_name          = "${var.project_name}-${var.environment}-dynamodb-throttling"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "DynamoDB requests are being throttled"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = var.dynamodb_table_name
  }
}

# Advanced Alerts Dashboard
resource "aws_cloudwatch_dashboard" "advanced_alerts" {
  dashboard_name = "${var.project_name}-${var.environment}-advanced-alerts"

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
            ["DeliveryCommand/Business", "ActionsOverdueCount", "Environment", var.environment],
            [".", "ActionsPending", ".", "."],
            [".", "ActionsCompleted", ".", "."],
            [".", "ActionsCreatedToday", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Business Alerts - Action Metrics"
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
            ["AWS/ApiGateway", "Latency", "ApiName", var.api_gateway_name],
            ["AWS/Lambda", "Duration", "FunctionName", var.api_handler_function_name]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Performance Trends"
          period  = 300
        }
      }
    ]
  })
}