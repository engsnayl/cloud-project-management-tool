#!/bin/bash
# scripts/build-lambdas.sh

set -e

echo "Building Lambda deployment packages..."

# Function to build a Lambda package with proper dependency handling
build_lambda() {
    local lambda_dir=$1
    local lambda_name=$(basename "$lambda_dir")
    
    echo "Building $lambda_name..."
    
    if [ ! -d "$lambda_dir" ]; then
        echo "Warning: Lambda directory $lambda_dir does not exist, skipping..."
        return 0
    fi
    
    cd "$lambda_dir"
    
    # Install dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "Installing dependencies for $lambda_name..."
        pip install --quiet --target . -r requirements.txt
    fi
    
    # Create deployment package
    echo "Creating deployment package for $lambda_name..."
    zip -r lambda-deployment.zip . -x "*.pyc" "__pycache__/*" "tests/*" "*.md" ".git/*" > /dev/null
    
    # Check if zip was created successfully
    if [ -f "lambda-deployment.zip" ]; then
        size=$(du -h lambda-deployment.zip | cut -f1)
        echo "✓ Built $lambda_name package: lambda-deployment.zip ($size)"
    else
        echo "✗ Failed to create package for $lambda_name"
        exit 1
    fi
    
    cd - > /dev/null
}

# Build all Lambda functions that exist
LAMBDA_BASE_DIR="src/lambdas"

if [ ! -d "$LAMBDA_BASE_DIR" ]; then
    echo "Error: Lambda base directory $LAMBDA_BASE_DIR does not exist"
    exit 1
fi

# List of Lambda functions to build (only build if directory exists)
LAMBDA_FUNCTIONS=(
    "api-handler"
    "document-processor"
    "jwt-authorizer"
)

# Build each Lambda function
for lambda_func in "${LAMBDA_FUNCTIONS[@]}"; do
    lambda_path="$LAMBDA_BASE_DIR/$lambda_func"
    if [ -d "$lambda_path" ]; then
        build_lambda "$lambda_path"
    else
        echo "Skipping $lambda_func (directory not found: $lambda_path)"
    fi
done

echo "Lambda package building completed successfully!"