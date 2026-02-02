# terraform/.tflint.hcl
#
# TFLint configuration file.
# TFLint is a linter for Terraform - it catches common mistakes
# that terraform validate misses, like using deprecated AWS features
# or referencing instance types that don't exist.

plugin "aws" {
  enabled = true
  version = "0.31.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

# Enforce consistent naming
rule "terraform_naming_convention" {
  enabled = true
}

# Warn about unused declarations
rule "terraform_unused_declarations" {
  enabled = true
}

# Ensure all modules have descriptions for variables
rule "terraform_documented_variables" {
  enabled = true
}

# Ensure standard module structure
rule "terraform_standard_module_structure" {
  enabled = true
}
