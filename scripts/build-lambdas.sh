#!/bin/bash
# scripts/build-lambdas.sh

set -e

echo "Building Lambda deployment packages..."

# Function to build a Lambda package with proper dependency handling
build_lambda() {
    local lambda_dir=$1
    local lambda_name=$(basename "$lambda_dir")
    
    echo "Building $lambda_name..."
    
    if [ ! -f "$lambda_dir/lambda_function.py" ]; then
        echo "Skipping $lambda_name - no lambda_function.py found"
        return
    fi
    
    cd "$lambda_dir"
    
    # Clean up any existing package
    rm -f lambda-deployment.zip
    
    # Create temporary build directory
    BUILD_DIR=$(mktemp -d)
    
    # Copy Python source files
    cp *.py "$BUILD_DIR/"
    
    # Install dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo "Installing dependencies for $lambda_name..."
        pip install -r requirements.txt -t "$BUILD_DIR/" --quiet
        
        # Remove unnecessary files to reduce package size
        find "$BUILD_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$BUILD_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
        find "$BUILD_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true
    fi
    
    # Create deployment package
    cd "$BUILD_DIR"
    zip -r9q "$OLDPWD/lambda-deployment.zip" .
    cd "$OLDPWD"
    
    # Get package size
    PACKAGE_SIZE=$(du -h lambda-deployment.zip | cut -f1)
    
    # Cleanup
    rm -rf "$BUILD_DIR"
    
    echo "✓ Built $lambda_name package: lambda-deployment.zip ($PACKAGE_SIZE)"
}

# Build all Lambda functions
LAMBDA_COUNT=0
for lambda_dir in src/lambdas/*/; do
    if [ -d "$lambda_dir" ]; then
        build_lambda "$lambda_dir"
        ((LAMBDA_COUNT++))
    fi
done

echo ""
echo "Lambda build summary:"
echo "- Total functions processed: $LAMBDA_COUNT"
echo "- All packages ready for deployment"

# Verify all packages were created
echo ""
echo "Package verification:"
for lambda_dir in src/lambdas/*/; do
    if [ -d "$lambda_dir" ]; then
        lambda_name=$(basename "$lambda_dir")
        if [ -f "$lambda_dir/lambda-deployment.zip" ]; then
            echo "✓ $lambda_name: lambda-deployment.zip ready"
        else
            echo "✗ $lambda_name: package missing"
        fi
    fi
done

echo ""
echo "Lambda build completed successfully!"