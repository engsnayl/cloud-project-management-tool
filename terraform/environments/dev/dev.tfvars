# Dev environment overrides
project_name = "deliverycommand"
environment  = "dev"
aws_region   = "eu-west-1"

# VPC
enable_nat_gateway = false
enable_flow_logs   = false

# Database - no protection in dev
enable_point_in_time_recovery = false
deletion_protection           = false

# S3 CORS
allowed_origins = ["http://localhost:3000", "https://actions-dev.engsnayl.com"]

# Monitoring
log_retention_days = 14
enable_monitoring  = true

# Frontend
frontend_url = "http://localhost:3000"
