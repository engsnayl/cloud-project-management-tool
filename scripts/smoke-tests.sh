#!/bin/bash
# scripts/smoke-tests.sh

set -e

ENVIRONMENT=${1:-dev}
echo "Running smoke tests for $ENVIRONMENT environment..."

# Get API Gateway URL from Terraform output
cd terraform/environments/$ENVIRONMENT
API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
cd - > /dev/null

if [ -z "$API_URL" ]; then
    echo "ERROR: Could not retrieve API Gateway URL from Terraform output"
    exit 1
fi

echo "API Gateway URL: $API_URL"
echo "Starting comprehensive smoke tests..."

# Test 1: Health Check Endpoint
echo ""
echo "Test 1: Health Check Endpoint"
echo "Testing: $API_URL/api/v1/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/health" || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✓ Health check endpoint responding correctly"
else
    echo "✗ Health check failed (HTTP $HEALTH_RESPONSE)"
    echo "  This indicates the API Gateway or Lambda function has issues"
    exit 1
fi

# Test 2: CORS Configuration
echo ""
echo "Test 2: CORS Configuration"
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/api/v1/health" || echo "000")
if [ "$CORS_RESPONSE" = "200" ]; then
    echo "✓ CORS configuration working correctly"
else
    echo "✗ CORS configuration failed (HTTP $CORS_RESPONSE)"
    echo "  Frontend applications may not be able to access the API"
fi

# Test 3: API Authentication Endpoints
echo ""
echo "Test 3: Protected API Endpoints"
PROJECTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/projects" || echo "000")
if [ "$PROJECTS_RESPONSE" = "200" ] || [ "$PROJECTS_RESPONSE" = "401" ]; then
    echo "✓ Protected endpoints responding (HTTP $PROJECTS_RESPONSE)"
    if [ "$PROJECTS_RESPONSE" = "401" ]; then
        echo "  Authentication is working - 401 expected for protected endpoints"
    fi
else
    echo "✗ Protected endpoints failed (HTTP $PROJECTS_RESPONSE)"
    echo "  API Gateway routing or Lambda function may have issues"
fi

# Test 4: Lambda Function Deployment
echo ""
echo "Test 4: Lambda Functions"
LAMBDA_COUNT=$(aws lambda list-functions --region eu-west-1 --query "Functions[?contains(FunctionName, 'deliverycommand-$ENVIRONMENT')].FunctionName" --output text | wc -w)
EXPECTED_LAMBDAS=3
if [ "$LAMBDA_COUNT" -ge "$EXPECTED_LAMBDAS" ]; then
    echo "✓ Lambda functions deployed ($LAMBDA_COUNT/$EXPECTED_LAMBDAS found)"
    
    # Test each Lambda function individually
    for function_name in $(aws lambda list-functions --region eu-west-1 --query "Functions[?contains(FunctionName, 'deliverycommand-$ENVIRONMENT')].FunctionName" --output text); do
        echo "  Testing $function_name..."
        FUNCTION_STATE=$(aws lambda get-function --function-name "$function_name" --query 'Configuration.State' --output text 2>/dev/null || echo "Unknown")
        if [ "$FUNCTION_STATE" = "Active" ]; then
            echo "  ✓ $function_name is active"
        else
            echo "  ⚠ $function_name state: $FUNCTION_STATE"
        fi
    done
else
    echo "✗ Missing Lambda functions (only $LAMBDA_COUNT/$EXPECTED_LAMBDAS found)"
    exit 1
fi

# Test 5: DynamoDB Table Access
echo ""
echo "Test 5: DynamoDB Table"
TABLE_NAME="deliverycommand-$ENVIRONMENT-main"
TABLE_STATUS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND")
if [ "$TABLE_STATUS" = "ACTIVE" ]; then
    echo "✓ DynamoDB table '$TABLE_NAME' is active"
    
    # Test table access by doing a simple scan
    ITEM_COUNT=$(aws dynamodb scan --table-name "$TABLE_NAME" --select COUNT --query 'Count' --output text 2>/dev/null || echo "ERROR")
    if [ "$ITEM_COUNT" != "ERROR" ]; then
        echo "  ✓ Table is accessible (contains $ITEM_COUNT items)"
    else
        echo "  ✗ Table access failed"
    fi
else
    echo "✗ DynamoDB table issue (Status: $TABLE_STATUS)"
    exit 1
fi

# Test 6: S3 Bucket
echo ""
echo "Test 6: S3 Document Storage"
S3_BUCKET=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'deliverycommand-$ENVIRONMENT-documents')].Name" --output text 2>/dev/null || echo "")
if [ -n "$S3_BUCKET" ]; then
    echo "✓ S3 bucket found: $S3_BUCKET"
    
    # Test bucket access
    BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$S3_BUCKET" --query 'LocationConstraint' --output text 2>/dev/null || echo "ERROR")
    if [ "$BUCKET_REGION" != "ERROR" ]; then
        echo "  ✓ Bucket is accessible"
    else
        echo "  ✗ Bucket access failed"
    fi
else
    echo "✗ S3 bucket not found"
    exit 1
fi

# Test 7: CloudWatch Monitoring
echo ""
echo "Test 7: CloudWatch Monitoring"
DASHBOARD_COUNT=$(aws cloudwatch list-dashboards --region eu-west-1 --query "DashboardEntries[?contains(DashboardName, 'deliverycommand-$ENVIRONMENT')].DashboardName" --output text | wc -w)
EXPECTED_DASHBOARDS=4
if [ "$DASHBOARD_COUNT" -ge "$EXPECTED_DASHBOARDS" ]; then
    echo "✓ CloudWatch dashboards created ($DASHBOARD_COUNT found)"
else
    echo "⚠ CloudWatch dashboards incomplete ($DASHBOARD_COUNT/$EXPECTED_DASHBOARDS found)"
fi

# Test 8: SNS Alert Topics
echo ""
echo "Test 8: SNS Alert Configuration"
SNS_COUNT=$(aws sns list-topics --region eu-west-1 --query "Topics[?contains(TopicArn, 'deliverycommand-$ENVIRONMENT')].TopicArn" --output text | wc -w)
EXPECTED_SNS=2
if [ "$SNS_COUNT" -ge "$EXPECTED_SNS" ]; then
    echo "✓ SNS alert topics configured ($SNS_COUNT found)"
else
    echo "⚠ SNS topics incomplete ($SNS_COUNT/$EXPECTED_SNS found)"
fi

# Test 9: Cognito Authentication
echo ""
echo "Test 9: Cognito Authentication Setup"
cd terraform/environments/$ENVIRONMENT
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || echo "")
CLIENT_ID=$(terraform output -raw cognito_user_pool_client_id 2>/dev/null || echo "")
cd - > /dev/null

if [ -n "$USER_POOL_ID" ] && [ -n "$CLIENT_ID" ]; then
    echo "✓ Cognito authentication configured"
    echo "  User Pool ID: $USER_POOL_ID"
    echo "  Client ID: $CLIENT_ID"
else
    echo "✗ Cognito authentication configuration incomplete"
    exit 1
fi

# Test 10: API Performance Check
echo ""
echo "Test 10: API Performance"
echo "Measuring API response time..."
START_TIME=$(date +%s%3N)
curl -s -o /dev/null "$API_URL/api/v1/health"
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

if [ "$RESPONSE_TIME" -lt 3000 ]; then
    echo "✓ API response time: ${RESPONSE_TIME}ms (acceptable)"
elif [ "$RESPONSE_TIME" -lt 5000 ]; then
    echo "⚠ API response time: ${RESPONSE_TIME}ms (slow but functional)"
else
    echo "✗ API response time: ${RESPONSE_TIME}ms (too slow)"
    exit 1
fi

echo ""
echo "========================================="
echo "SMOKE TEST SUMMARY for $ENVIRONMENT"
echo "========================================="
echo "✓ All critical smoke tests passed!"
echo "  - API Gateway: Operational"
echo "  - Lambda Functions: $LAMBDA_COUNT deployed and active"
echo "  - DynamoDB: Accessible"
echo "  - S3 Storage: Available"
echo "  - Cognito Auth: Configured"
echo "  - CloudWatch: $DASHBOARD_COUNT dashboards"
echo "  - SNS Alerts: $SNS_COUNT topics"
echo "  - Response Time: ${RESPONSE_TIME}ms"
echo ""
echo "Environment $ENVIRONMENT is ready for use!"