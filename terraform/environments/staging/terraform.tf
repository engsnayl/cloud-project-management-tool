# terraform/environments/staging/terraform.tf

terraform {
  backend "s3" {
    bucket         = "deliverycommand-terraform-state-py72t4of"
    key            = "environments/staging/terraform.tfstate"  # Different key for staging
    region         = "eu-west-1"
    dynamodb_table = "deliverycommand-terraform-locks"
    encrypt        = true
  }
}