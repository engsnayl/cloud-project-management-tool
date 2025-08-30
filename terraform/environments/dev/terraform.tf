# terraform/environments/dev/terraform.tf

terraform {
  backend "s3" {
    bucket         = "deliverycommand-terraform-state-py72t4of"
    key            = "environments/dev/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "deliverycommand-terraform-locks"
    encrypt        = true
  }
}
