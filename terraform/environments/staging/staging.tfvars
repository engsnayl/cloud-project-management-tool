# Staging environment overrides
project_name = "deliverycommand"
environment  = "staging"
aws_region   = "eu-west-1"

# VPC
enable_nat_gateway = false
enable_flow_logs   = true

# Database - staging gets protection
enable_point_in_time_recovery = true
deletion_protection           = true

# S3 CORS
allowed_origins = ["https://actions-staging.engsnayl.com"]

# Monitoring
log_retention_days = 30
enable_monitoring  = true

# Frontend
frontend_url = "https://actions-staging.engsnayl.com"
