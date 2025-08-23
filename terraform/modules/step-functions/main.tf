# terraform/modules/step-functions/main.tf

# IAM role for Step Functions execution
resource "aws_iam_role" "step_functions_role" {
  name = "${var.project_name}-${var.environment}-step-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-step-functions-role"
    Environment = var.environment
  })
}

# IAM policy for Step Functions to invoke Lambda and access DynamoDB
resource "aws_iam_role_policy" "step_functions_policy" {
  name = "${var.project_name}-${var.environment}-step-functions-policy"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.api_handler_function_arn,
          var.document_processor_function_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
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
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Step Functions (only created if logging enabled)
resource "aws_cloudwatch_log_group" "step_functions" {
  count             = var.enable_logging ? 1 : 0
  name              = "/aws/stepfunctions/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-stepfunctions-logs"
    Environment = var.environment
  })
}

# Requirement Approval Workflow State Machine
resource "aws_sfn_state_machine" "requirement_approval" {
  name     = "${var.project_name}-${var.environment}-requirement-approval"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "DeliveryCommand Requirement Approval Workflow"
    StartAt = "ValidateRequirement"
    States = {
      ValidateRequirement = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "validate-requirement"
          "requirementId.$" = "$.requirementId"
        }
        Next = "CheckValidation"
        Retry = [
          {
            ErrorEquals = ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "ValidationFailed"
          }
        ]
      }

      CheckValidation = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.validation.isValid"
            BooleanEquals = true
            Next = "UpdateStatusToReview"
          }
        ]
        Default = "ValidationFailed"
      }

      ValidationFailed = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "update-requirement-status"
          "requirementId.$" = "$.requirementId"
          "status" = "VALIDATION_FAILED"
          "reason.$" = "$.validation.reason"
        }
        Next = "NotifyValidationFailed"
      }

      NotifyValidationFailed = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "validation-failed"
          "requirementId.$" = "$.requirementId"
        }
        End = true
      }

      UpdateStatusToReview = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "update-requirement-status"
          "requirementId.$" = "$.requirementId"
          "status" = "PENDING_REVIEW"
        }
        Next = "NotifyReviewersNeeded"
      }

      NotifyReviewersNeeded = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "review-needed"
          "requirementId.$" = "$.requirementId"
        }
        Next = "WaitForReview"
      }

      WaitForReview = {
        Type = "Wait"
        Seconds = var.review_timeout_seconds
        Next = "CheckReviewStatus"
      }

      CheckReviewStatus = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "get-requirement-status"
          "requirementId.$" = "$.requirementId"
        }
        Next = "EvaluateReview"
      }

      EvaluateReview = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.requirement.status"
            StringEquals = "APPROVED"
            Next = "HandleApproval"
          },
          {
            Variable = "$.requirement.status"
            StringEquals = "REJECTED"
            Next = "HandleRejection"
          },
          {
            Variable = "$.requirement.status"
            StringEquals = "PENDING_REVIEW"
            Next = "HandleTimeout"
          }
        ]
        Default = "HandleTimeout"
      }

      HandleApproval = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "update-requirement-status"
          "requirementId.$" = "$.requirementId"
          "status" = "APPROVED"
          "approvedAt.$" = "$$.State.EnteredTime"
        }
        Next = "NotifyApproval"
      }

      NotifyApproval = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "approved"
          "requirementId.$" = "$.requirementId"
        }
        Next = "TriggerImplementation"
      }

      TriggerImplementation = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "trigger-implementation"
          "requirementId.$" = "$.requirementId"
        }
        End = true
      }

      HandleRejection = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "update-requirement-status"
          "requirementId.$" = "$.requirementId"
          "status" = "REJECTED"
          "rejectedAt.$" = "$$.State.EnteredTime"
        }
        Next = "NotifyRejection"
      }

      NotifyRejection = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "rejected"
          "requirementId.$" = "$.requirementId"
        }
        End = true
      }

      HandleTimeout = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "update-requirement-status"
          "requirementId.$" = "$.requirementId"
          "status" = "REVIEW_TIMEOUT"
        }
        Next = "NotifyTimeout"
      }

      NotifyTimeout = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "review-timeout"
          "requirementId.$" = "$.requirementId"
        }
        End = true
      }
    }
  })

  # Optional logging configuration
  dynamic "logging_configuration" {
    for_each = var.enable_logging ? [1] : []
    content {
      log_destination        = "${aws_cloudwatch_log_group.step_functions[0].arn}:*"
      include_execution_data = true
      level                 = "ERROR"
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-requirement-approval"
    Environment = var.environment
    Purpose     = "workflow-orchestration"
  })
}

# Document Processing Workflow State Machine
resource "aws_sfn_state_machine" "document_processing" {
  name     = "${var.project_name}-${var.environment}-document-processing"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "DeliveryCommand Document Processing Workflow"
    StartAt = "ProcessDocument"
    States = {
      ProcessDocument = {
        Type = "Task"
        Resource = var.document_processor_function_arn
        Parameters = {
          "Records.$" = "$.Records"
        }
        Next = "CheckProcessingResult"
        Retry = [
          {
            ErrorEquals = ["Lambda.ServiceException", "Lambda.AWSLambdaException"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "ProcessingFailed"
          }
        ]
      }

      CheckProcessingResult = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.statusCode"
            NumericEquals = 200
            Next = "ExtractRequirements"
          }
        ]
        Default = "ProcessingFailed"
      }

      ExtractRequirements = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "extract-requirements-from-text"
          "extractedText.$" = "$.extractedText"
          "documentId.$" = "$.documentId"
        }
        Next = "CreateRequirements"
      }

      CreateRequirements = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "create-requirements-from-extraction"
          "requirements.$" = "$.requirements"
          "sourceDocument.$" = "$.documentId"
        }
        Next = "NotifyProcessingComplete"
      }

      NotifyProcessingComplete = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "document-processed"
          "documentId.$" = "$.documentId"
          "requirementCount.$" = "$.createdRequirements.length"
        }
        End = true
      }

      ProcessingFailed = {
        Type = "Task"
        Resource = var.api_handler_function_arn
        Parameters = {
          "action" = "send-notification"
          "type" = "document-processing-failed"
          "error.$" = "$.error"
        }
        End = true
      }
    }
  })

  # Optional logging configuration
  dynamic "logging_configuration" {
    for_each = var.enable_logging ? [1] : []
    content {
      log_destination        = "${aws_cloudwatch_log_group.step_functions[0].arn}:*"
      include_execution_data = true
      level                 = "ERROR"
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}-document-processing"
    Environment = var.environment
    Purpose     = "document-workflow"
  })
}

# Data source for current AWS region
data "aws_region" "current" {}