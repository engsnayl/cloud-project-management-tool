# terraform/modules/step-functions/outputs.tf

output "step_functions_role_arn" {
  description = "ARN of the Step Functions execution role"
  value       = aws_iam_role.step_functions_role.arn
}

output "requirement_approval_state_machine_arn" {
  description = "ARN of the requirement approval state machine"
  value       = aws_sfn_state_machine.requirement_approval.arn
}

output "requirement_approval_state_machine_name" {
  description = "Name of the requirement approval state machine"
  value       = aws_sfn_state_machine.requirement_approval.name
}

output "document_processing_state_machine_arn" {
  description = "ARN of the document processing state machine"
  value       = aws_sfn_state_machine.document_processing.arn
}

output "document_processing_state_machine_name" {
  description = "Name of the document processing state machine"
  value       = aws_sfn_state_machine.document_processing.name
}

output "step_functions_log_group_name" {
  description = "Name of the Step Functions CloudWatch log group"
  value       = length(aws_cloudwatch_log_group.step_functions) > 0 ? aws_cloudwatch_log_group.step_functions[0].name : null
}

output "step_functions_log_group_arn" {
  description = "ARN of the Step Functions CloudWatch log group"
  value       = length(aws_cloudwatch_log_group.step_functions) > 0 ? aws_cloudwatch_log_group.step_functions[0].arn : null
}

output "workflow_urls" {
  description = "URLs to view workflows in AWS console"
  value = {
    requirement_approval = "https://console.aws.amazon.com/states/home?region=${data.aws_region.current.name}#/statemachines/view/${aws_sfn_state_machine.requirement_approval.arn}"
    document_processing  = "https://console.aws.amazon.com/states/home?region=${data.aws_region.current.name}#/statemachines/view/${aws_sfn_state_machine.document_processing.arn}"
  }
}
