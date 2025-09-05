#!/bin/bash
# terraform/environments/staging/blue-green-deploy.sh

set -e

ENVIRONMENT=$(basename $(pwd))
echo "Starting Blue/Green deployment for $ENVIRONMENT environment..."

# Get current deployment color
CURRENT_COLOR=$(terraform output -raw current_deployment_color 2>/dev/null || echo "blue")
if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
else
    NEW_COLOR="blue"
fi

echo "Current deployment: $CURRENT_COLOR"
echo "Deploying to: $NEW_COLOR"

# Deploy to new color
echo "Deploying infrastructure to $NEW_COLOR environment..."
terraform init
terraform plan -var="deployment_color=$NEW_COLOR" -out=tfplan
terraform apply tfplan

# Health check new deployment
echo "Running health checks on $NEW_COLOR deployment..."
NEW_API_URL=$(terraform output -raw "${NEW_COLOR}_api_gateway_url")

if [ -z "$NEW_API_URL" ]; then
    echo "ERROR: Could not get API URL for $NEW_COLOR deployment"
    exit 1
fi

echo "Testing $NEW_COLOR deployment at: $NEW_API_URL"

# Wait for deployment to be ready
sleep 30

# Health check
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$NEW_API_URL/api/v1/health" || echo "000")
if [ "$HEALTH_CHECK" != "200" ]; then
    echo "ERROR: Health check failed for $NEW_COLOR deployment (HTTP $HEALTH_CHECK)"
    echo "Rolling back..."
    
    # Rollback by keeping current color active
    terraform plan -var="deployment_color=$CURRENT_COLOR" -out=rollback-plan
    terraform apply rollback-plan
    exit 1
fi

echo "Health check passed for $NEW_COLOR deployment"

# Switch traffic to new deployment
echo "Switching traffic to $NEW_COLOR deployment..."
terraform plan -var="deployment_color=$NEW_COLOR" -var="active_color=$NEW_COLOR" -out=switch-plan
terraform apply switch-plan

# Final verification
echo "Running final verification..."
sleep 10

FINAL_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$NEW_API_URL/api/v1/health" || echo "000")
if [ "$FINAL_CHECK" != "200" ]; then
    echo "ERROR: Final verification failed"
    exit 1
fi

echo "Blue/Green deployment completed successfully!"
echo "Active deployment: $NEW_COLOR"

# Store deployment metadata
cat > deployment-metadata.json << EOF
{
    "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "active_color": "$NEW_COLOR",
    "previous_color": "$CURRENT_COLOR",
    "environment": "$ENVIRONMENT",
    "api_url": "$NEW_API_URL"
}
EOF

echo "Deployment metadata saved to deployment-metadata.json"