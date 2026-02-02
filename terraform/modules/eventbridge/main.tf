# terraform/modules/eventbridge/main.tf

# Custom EventBridge Event Bus
resource "aws_cloudwatch_event_bus" "deliverycommand" {
  name = "${var.project_name}-${var.environment}-event-bus"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-event-bus"
    Environment = var.environment
    Purpose     = "event-driven-architecture"
  })
}

# IAM Role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_role" {
  name = "${var.project_name}-${var.environment}-eventbridge-role"

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
    Name        = "${var.project_name}-${var.environment}-eventbridge-role"
    Environment = var.environment
  })
}

# IAM Policy for EventBridge to invoke Step Functions and Lambda - FIXED
resource "aws_iam_role_policy" "eventbridge_policy" {
  count = var.api_handler_function_arn != "" || var.document_processor_function_arn != "" || var.requirement_approval_workflow_arn != "" || var.document_processing_workflow_arn != "" ? 1 : 0
  name  = "${var.project_name}-${var.environment}-eventbridge-policy"
  role  = aws_iam_role.eventbridge_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      var.api_handler_function_arn != "" || var.document_processor_function_arn != "" ? [
        {
          Effect = "Allow"
          Action = [
            "lambda:InvokeFunction"
          ]
          Resource = compact([
            var.api_handler_function_arn != "" ? var.api_handler_function_arn : null,
            var.document_processor_function_arn != "" ? var.document_processor_function_arn : null
          ])
        }
      ] : [],
      var.requirement_approval_workflow_arn != "" || var.document_processing_workflow_arn != "" ? [
        {
          Effect = "Allow"
          Action = [
            "states:StartExecution"
          ]
          Resource = compact([
            var.requirement_approval_workflow_arn != "" ? var.requirement_approval_workflow_arn : null,
            var.document_processing_workflow_arn != "" ? var.document_processing_workflow_arn : null
          ])
        }
      ] : []
    )
  })
}

# EventBridge Rule: Requirement Created -> Start Approval Workflow
resource "aws_cloudwatch_event_rule" "requirement_created" {
  name           = "${var.project_name}-${var.environment}-requirement-created"
  description    = "Trigger approval workflow when requirement is created"
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  event_pattern = jsonencode({
    source      = ["deliverycommand.requirements"]
    detail-type = ["Requirement Created"]
    detail = {
      status = ["DRAFT"]
    }
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-requirement-created"
    Environment = var.environment
    Purpose     = "workflow-trigger"
  })
}

# EventBridge Target: Requirement Created -> Step Functions - FIXED
resource "aws_cloudwatch_event_target" "requirement_created_target" {
  count          = var.requirement_approval_workflow_arn != "" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.requirement_created.name
  target_id      = "RequirementCreatedTarget"
  arn            = var.requirement_approval_workflow_arn
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name
  role_arn       = aws_iam_role.eventbridge_role.arn

  input_transformer {
    input_paths = {
      requirementId = "$.detail.requirementId"
      projectId     = "$.detail.projectId"
      priority      = "$.detail.priority"
    }
    input_template = jsonencode({
      requirementId = "<requirementId>"
      projectId     = "<projectId>"
      priority      = "<priority>"
      source        = "eventbridge"
      timestamp     = "$$.Execution.StartTime"
    })
  }
}

# EventBridge Rule: Document Uploaded -> Start Processing Workflow
resource "aws_cloudwatch_event_rule" "document_uploaded" {
  name           = "${var.project_name}-${var.environment}-document-uploaded"
  description    = "Trigger document processing when file is uploaded"
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  event_pattern = jsonencode({
    source      = ["deliverycommand.documents"]
    detail-type = ["Document Uploaded"]
    detail = {
      fileType = ["pdf", "docx", "doc"]
    }
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-uploaded"
    Environment = var.environment
    Purpose     = "document-processing"
  })
}

# EventBridge Target: Document Uploaded -> Step Functions - FIXED
resource "aws_cloudwatch_event_target" "document_uploaded_target" {
  count          = var.document_processing_workflow_arn != "" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.document_uploaded.name
  target_id      = "DocumentUploadedTarget"
  arn            = var.document_processing_workflow_arn
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name
  role_arn       = aws_iam_role.eventbridge_role.arn

  input_transformer {
    input_paths = {
      bucketName = "$.detail.bucketName"
      objectKey  = "$.detail.objectKey"
      documentId = "$.detail.documentId"
      fileType   = "$.detail.fileType"
    }
    input_template = jsonencode({
      Records = [
        {
          s3 = {
            bucket = {
              name = "<bucketName>"
            }
            object = {
              key = "<objectKey>"
            }
          }
        }
      ]
      documentId = "<documentId>"
      fileType   = "<fileType>"
      source     = "eventbridge"
      timestamp  = "$$.Execution.StartTime"
    })
  }
}

# EventBridge Rule: Requirement Status Changed -> Notifications
resource "aws_cloudwatch_event_rule" "requirement_status_changed" {
  name           = "${var.project_name}-${var.environment}-requirement-status-changed"
  description    = "Send notifications when requirement status changes"
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  event_pattern = jsonencode({
    source      = ["deliverycommand.requirements"]
    detail-type = ["Requirement Status Changed"]
    detail = {
      newStatus = ["APPROVED", "REJECTED", "PENDING_REVIEW", "REVIEW_TIMEOUT"]
    }
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-requirement-status-changed"
    Environment = var.environment
    Purpose     = "notification-trigger"
  })
}

# EventBridge Target: Status Changed -> Lambda Notification - FIXED TO BE CONDITIONAL
resource "aws_cloudwatch_event_target" "requirement_status_changed_target" {
  count          = var.api_handler_function_arn != "" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.requirement_status_changed.name
  target_id      = "RequirementStatusChangedTarget"
  arn            = var.api_handler_function_arn
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  input_transformer {
    input_paths = {
      requirementId = "$.detail.requirementId"
      oldStatus     = "$.detail.oldStatus"
      newStatus     = "$.detail.newStatus"
      assignedTo    = "$.detail.assignedTo"
      priority      = "$.detail.priority"
    }
    input_template = jsonencode({
      action        = "send-status-notification"
      requirementId = "<requirementId>"
      oldStatus     = "<oldStatus>"
      newStatus     = "<newStatus>"
      assignedTo    = "<assignedTo>"
      priority      = "<priority>"
      timestamp     = "$$.Execution.StartTime"
      source        = "eventbridge"
    })
  }
}

# EventBridge Rule: Workflow Execution Completed
resource "aws_cloudwatch_event_rule" "workflow_completed" {
  name           = "${var.project_name}-${var.environment}-workflow-completed"
  description    = "Handle workflow completion events"
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  event_pattern = jsonencode({
    source      = ["deliverycommand.workflows"]
    detail-type = ["Workflow Completed"]
    detail = {
      workflowType = ["requirement-approval", "document-processing"]
      status       = ["SUCCEEDED", "FAILED", "TIMED_OUT"]
    }
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-workflow-completed"
    Environment = var.environment
    Purpose     = "workflow-monitoring"
  })
}

# EventBridge Target: Workflow Completed -> Analytics Update - FIXED TO BE CONDITIONAL
resource "aws_cloudwatch_event_target" "workflow_completed_target" {
  count          = var.api_handler_function_arn != "" ? 1 : 0
  rule           = aws_cloudwatch_event_rule.workflow_completed.name
  target_id      = "WorkflowCompletedTarget"
  arn            = var.api_handler_function_arn
  event_bus_name = aws_cloudwatch_event_bus.deliverycommand.name

  input_transformer {
    input_paths = {
      workflowType  = "$.detail.workflowType"
      status        = "$.detail.status"
      executionArn  = "$.detail.executionArn"
      duration      = "$.detail.duration"
      requirementId = "$.detail.requirementId"
    }
    input_template = jsonencode({
      action        = "update-workflow-analytics"
      workflowType  = "<workflowType>"
      status        = "<status>"
      executionArn  = "<executionArn>"
      duration      = "<duration>"
      requirementId = "<requirementId>"
      timestamp     = "$$.Execution.StartTime"
      source        = "eventbridge"
    })
  }
}

# Dead Letter Queue for Failed Events
resource "aws_sqs_queue" "event_dlq" {
  name = "${var.project_name}-${var.environment}-event-dlq"

  message_retention_seconds  = 1209600 # 14 days
  visibility_timeout_seconds = 60

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-event-dlq"
    Environment = var.environment
    Purpose     = "event-failure-handling"
  })
}

# EventBridge Archive for Event Replay (Optional)
resource "aws_cloudwatch_event_archive" "deliverycommand_archive" {
  count            = var.enable_event_archive ? 1 : 0
  name             = "${var.project_name}-${var.environment}-event-archive"
  event_source_arn = aws_cloudwatch_event_bus.deliverycommand.arn
  retention_days   = var.event_archive_retention_days
  description      = "Archive for DeliveryCommand events for replay capability"

  event_pattern = jsonencode({
    source = ["deliverycommand.requirements", "deliverycommand.documents", "deliverycommand.workflows"]
  })
}