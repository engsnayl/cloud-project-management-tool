# terraform/modules/lambda/patch.tf

# Create valid minimal Lambda zip files
resource "null_resource" "create_api_handler_zip" {
  # Create a unique ID for this resource each time the zip path changes
  triggers = {
    zip_path = var.api_handler_zip_path
  }

  # Create a valid Lambda zip file
  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p $(dirname ${var.api_handler_zip_path})
      cd $(dirname ${var.api_handler_zip_path})
      echo 'def lambda_handler(event, context):\n    return {"statusCode": 200, "body": "Hello from Lambda!"}' > lambda_function.py
      zip -r $(basename ${var.api_handler_zip_path}) lambda_function.py
      rm lambda_function.py
    EOT
    interpreter = ["bash", "-c"]
  }
}

resource "null_resource" "create_document_processor_zip" {
  # Create a unique ID for this resource each time the zip path changes
  triggers = {
    zip_path = var.document_processor_zip_path
  }

  # Create a valid Lambda zip file
  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p $(dirname ${var.document_processor_zip_path})
      cd $(dirname ${var.document_processor_zip_path})
      echo 'def lambda_handler(event, context):\n    return {"statusCode": 200, "body": "Document processed!"}' > lambda_function.py
      zip -r $(basename ${var.document_processor_zip_path}) lambda_function.py
      rm lambda_function.py
    EOT
    interpreter = ["bash", "-c"]
  }
}

# Update Lambda function variables to depend on the null resources
locals {
  api_handler_zip_path = var.api_handler_zip_path
  document_processor_zip_path = var.document_processor_zip_path
}