#!/bin/bash
# Terraform validation script for infrastructure testing
# This script validates Terraform configuration across all environments

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

echo "=================================================="
echo "TERRAFORM VALIDATION"
echo "=================================================="
echo "Project Root: $PROJECT_ROOT"
echo "Terraform Dir: $TERRAFORM_DIR"
echo ""

# Function to validate environment
validate_environment() {
    local env_dir=$1
    local env_name=$(basename "$env_dir")
    
    echo "🔍 Validating $env_name environment..."
    
    cd "$env_dir"
    
    # Initialize Terraform
    echo "  - Initializing Terraform..."
    if ! terraform init -backend=false > /dev/null 2>&1; then
        echo "  ❌ Terraform init failed for $env_name"
        return 1
    fi
    
    # Validate configuration
    echo "  - Validating configuration..."
    if ! terraform validate > /dev/null 2>&1; then
        echo "  ❌ Terraform validate failed for $env_name"
        terraform validate
        return 1
    fi
    
    # Check formatting
    echo "  - Checking formatting..."
    if ! terraform fmt -check=true -recursive > /dev/null 2>&1; then
        echo "  ⚠️  Formatting issues found in $env_name"
        echo "  Run 'terraform fmt -recursive' to fix"
    else
        echo "  ✅ Formatting is correct"
    fi
    
    echo "  ✅ $env_name validation passed"
    echo ""
    
    return 0
}

# Function to validate modules
validate_modules() {
    echo "🔍 Validating Terraform modules..."
    
    local modules_dir="$TERRAFORM_DIR/modules"
    local failed_modules=()
    
    for module_dir in "$modules_dir"/*; do
        if [ -d "$module_dir" ]; then
            local module_name=$(basename "$module_dir")
            echo "  - Validating module: $module_name..."
            
            cd "$module_dir"
            
            # Check if module has required files
            if [ ! -f "main.tf" ]; then
                echo "    ❌ Missing main.tf in $module_name"
                failed_modules+=("$module_name")
                continue
            fi
            
            if [ ! -f "variables.tf" ]; then
                echo "    ⚠️  Missing variables.tf in $module_name"
            fi
            
            if [ ! -f "outputs.tf" ]; then
                echo "    ⚠️  Missing outputs.tf in $module_name"
            fi
            
            # Initialize and validate module
            if ! terraform init -backend=false > /dev/null 2>&1; then
                echo "    ❌ Module init failed for $module_name"
                failed_modules+=("$module_name")
                continue
            fi
            
            if ! terraform validate > /dev/null 2>&1; then
                echo "    ❌ Module validation failed for $module_name"
                failed_modules+=("$module_name")
                continue
            fi
            
            echo "    ✅ Module $module_name is valid"
        fi
    done
    
    if [ ${#failed_modules[@]} -eq 0 ]; then
        echo "  ✅ All modules validated successfully"
        echo ""
        return 0
    else
        echo "  ❌ Failed modules: ${failed_modules[*]}"
        echo ""
        return 1
    fi
}

# Function to check Terraform version
check_terraform_version() {
    echo "🔍 Checking Terraform version..."
    
    if ! command -v terraform &> /dev/null; then
        echo "  ❌ Terraform is not installed"
        return 1
    fi
    
    local version=$(terraform version -json | python3 -c "import sys, json; print(json.load(sys.stdin)['terraform_version'])")
    echo "  ✅ Terraform version: $version"
    echo ""
    
    return 0
}

# Function to validate terraform files syntax
validate_syntax() {
    echo "🔍 Validating Terraform syntax..."
    
    local syntax_errors=0
    
    # Find all .tf files and check syntax
    while IFS= read -r -d '' file; do
        if ! terraform fmt -check=true "$file" > /dev/null 2>&1; then
            echo "  ⚠️  Syntax/formatting issue in: $file"
            ((syntax_errors++))
        fi
    done < <(find "$TERRAFORM_DIR" -name "*.tf" -print0)
    
    if [ $syntax_errors -eq 0 ]; then
        echo "  ✅ All Terraform files have correct syntax"
    else
        echo "  ⚠️  $syntax_errors files have syntax/formatting issues"
        echo "    Run 'terraform fmt -recursive terraform/' to fix"
    fi
    
    echo ""
    return 0
}

# Main validation function
main() {
    local exit_code=0
    
    # Check prerequisites
    if ! check_terraform_version; then
        exit_code=1
    fi
    
    # Validate syntax
    validate_syntax
    
    # Validate modules
    if ! validate_modules; then
        exit_code=1
    fi
    
    # Validate each environment
    for env_dir in "$TERRAFORM_DIR/environments"/*; do
        if [ -d "$env_dir" ]; then
            if ! validate_environment "$env_dir"; then
                exit_code=1
            fi
        fi
    done
    
    echo "=================================================="
    if [ $exit_code -eq 0 ]; then
        echo "✅ ALL TERRAFORM VALIDATION PASSED"
        echo "Infrastructure configuration is valid and ready for deployment"
    else
        echo "❌ TERRAFORM VALIDATION FAILED"
        echo "Fix the issues above before deploying"
    fi
    echo "=================================================="
    
    return $exit_code
}

# Run main function
main "$@"