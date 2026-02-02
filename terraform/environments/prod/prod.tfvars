# Production environment overrides
project_name = "deliverycommand"
environment  = "prod"
aws_region   = "eu-west-1"

# VPC - full networking in prod
enable_nat_gateway = true
enable_flow_logs   = true

# Database - production MUST have protection
enable_point_in_time_recovery = true
deletion_protection           = true

# S3 - versioning + lifecycle management
enable_versioning       = true
enable_lifecycle_policy = true
document_retention_days = 730

# S3 CORS
allowed_origins = ["https://actions.engsnayl.com"]

# Monitoring
log_retention_days = 90
enable_monitoring  = true

# Frontend
frontend_url           = "https://actions.engsnayl.com"
dashboard_url          = "https://actions.engsnayl.com"
dashboard_url_hostname = "actions.engsnayl.com"

# Security - stricter in prod
enable_cloudtrail_data_events        = true
cloudtrail_retention_days            = 365
cloudtrail_cloudwatch_retention_days = 90
unauthorized_api_calls_threshold     = 10
