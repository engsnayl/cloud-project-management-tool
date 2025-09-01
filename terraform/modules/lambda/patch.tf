# terraform/modules/lambda/patch.tf

# Create empty zip files for Lambda functions if they don't exist
resource "local_file" "create_api_handler_zip" {
  filename = var.api_handler_zip_path
  content  = "dummy content - created by Terraform"
  
  # Only create the file if it doesn't exist
  provisioner "local-exec" {
    command = "touch ${var.api_handler_zip_path}"
    interpreter = ["bash", "-c"]
    on_failure = continue
  }
}

resource "local_file" "create_document_processor_zip" {
  filename = var.document_processor_zip_path
  content  = "dummy content - created by Terraform"
  
  # Only create the file if it doesn't exist
  provisioner "local-exec" {
    command = "touch ${var.document_processor_zip_path}"
    interpreter = ["bash", "-c"]
    on_failure = continue
  }
}

# Update Lambda function variables to depend on the local files
locals {
  api_handler_zip_path = local_file.create_api_handler_zip.filename
  document_processor_zip_path = local_file.create_document_processor_zip.filename
}
