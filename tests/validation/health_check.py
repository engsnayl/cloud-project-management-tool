#!/usr/bin/env python3
"""
Simple health check script for deployed infrastructure
Tests basic connectivity and service availability
"""

import boto3
import requests
import json
import os
import sys
from datetime import datetime
from botocore.exceptions import ClientError


class HealthChecker:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS clients
        self.apigateway = boto3.client('apigateway', region_name=self.region)
        self.lambda_client = boto3.client('lambda', region_name=self.region)
        self.dynamodb = boto3.client('dynamodb', region_name=self.region)
        
        self.health_status = {
            'timestamp': datetime.now().isoformat(),
            'environment': self.environment,
            'region': self.region,
            'services': {}
        }
    
    def check_api_gateway(self):
        """Check API Gateway health"""
        try:
            # Find the API
            response = self.apigateway.get_rest_apis()
            apis = response.get('items', [])
            api_name = f"{self.project_name}-{self.environment}-api"
            
            api = next((api for api in apis if api['name'] == api_name), None)
            
            if not api:
                self.health_status['services']['api_gateway'] = {
                    'status': 'FAIL',
                    'message': f'API Gateway not found: {api_name}'
                }
                return False
            
            # Try to reach the health endpoint
            api_id = api['id']
            api_url = f"https://{api_id}.execute-api.{self.region}.amazonaws.com/{self.environment}/api/v1/health"
            
            try:
                response = requests.get(api_url, timeout=10)
                # Accept various status codes (might be 401/403 due to auth)
                if response.status_code in [200, 401, 403]:
                    self.health_status['services']['api_gateway'] = {
                        'status': 'PASS',
                        'message': f'API Gateway responding (HTTP {response.status_code})',
                        'url': api_url
                    }
                    return True
                else:
                    self.health_status['services']['api_gateway'] = {
                        'status': 'FAIL',
                        'message': f'API Gateway returned HTTP {response.status_code}',
                        'url': api_url
                    }
                    return False
                    
            except requests.exceptions.RequestException as e:
                self.health_status['services']['api_gateway'] = {
                    'status': 'FAIL',
                    'message': f'API Gateway not reachable: {str(e)}',
                    'url': api_url
                }
                return False
                
        except ClientError as e:
            self.health_status['services']['api_gateway'] = {
                'status': 'FAIL',
                'message': f'AWS API error: {str(e)}'
            }
            return False
    
    def check_lambda_functions(self):
        """Check Lambda functions health"""
        function_names = [
            f"{self.project_name}-{self.environment}-api-handler",
            f"{self.project_name}-{self.environment}-document-processor",
            f"{self.project_name}-{self.environment}-jwt-authorizer"
        ]
        
        healthy_functions = 0
        total_functions = len(function_names)
        
        for function_name in function_names:
            try:
                response = self.lambda_client.get_function(FunctionName=function_name)
                
                config = response.get('Configuration', {})
                state = config.get('State', 'Unknown')
                
                if state == 'Active':
                    healthy_functions += 1
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    continue
        
        if healthy_functions == total_functions:
            self.health_status['services']['lambda'] = {
                'status': 'PASS',
                'message': f'All {total_functions} Lambda functions are active'
            }
            return True
        else:
            self.health_status['services']['lambda'] = {
                'status': 'FAIL',
                'message': f'Only {healthy_functions}/{total_functions} Lambda functions are active'
            }
            return False
    
    def check_dynamodb(self):
        """Check DynamoDB health"""
        table_name = f"{self.project_name}-{self.environment}-main"
        
        try:
            response = self.dynamodb.describe_table(TableName=table_name)
            table = response['Table']
            
            status = table.get('TableStatus', 'Unknown')
            
            if status == 'ACTIVE':
                self.health_status['services']['dynamodb'] = {
                    'status': 'PASS',
                    'message': f'DynamoDB table {table_name} is active'
                }
                return True
            else:
                self.health_status['services']['dynamodb'] = {
                    'status': 'FAIL',
                    'message': f'DynamoDB table {table_name} status: {status}'
                }
                return False
                
        except ClientError as e:
            self.health_status['services']['dynamodb'] = {
                'status': 'FAIL',
                'message': f'DynamoDB error: {str(e)}'
            }
            return False
    
    def check_cloudtrail(self):
        """Check CloudTrail health"""
        trail_name = f"{self.project_name}-{self.environment}-trail"
        
        try:
            cloudtrail = boto3.client('cloudtrail', region_name=self.region)
            
            # Check if trail exists and is logging
            response = cloudtrail.get_trail_status(Name=trail_name)
            is_logging = response.get('IsLogging', False)
            
            if is_logging:
                self.health_status['services']['cloudtrail'] = {
                    'status': 'PASS',
                    'message': f'CloudTrail {trail_name} is actively logging'
                }
                return True
            else:
                self.health_status['services']['cloudtrail'] = {
                    'status': 'FAIL',
                    'message': f'CloudTrail {trail_name} is not logging'
                }
                return False
                
        except ClientError as e:
            self.health_status['services']['cloudtrail'] = {
                'status': 'FAIL',
                'message': f'CloudTrail error: {str(e)}'
            }
            return False
    
    def run_health_checks(self):
        """Run all health checks"""
        print("=" * 50)
        print("INFRASTRUCTURE HEALTH CHECK")
        print("=" * 50)
        print(f"Environment: {self.environment}")
        print(f"Region: {self.region}")
        print(f"Timestamp: {self.health_status['timestamp']}")
        print("")
        
        checks = [
            ("API Gateway", self.check_api_gateway),
            ("Lambda Functions", self.check_lambda_functions),
            ("DynamoDB", self.check_dynamodb),
            ("CloudTrail", self.check_cloudtrail)
        ]
        
        total_checks = len(checks)
        passed_checks = 0
        
        for service_name, check_function in checks:
            print(f"Checking {service_name}...")
            
            try:
                if check_function():
                    passed_checks += 1
                    status = self.health_status['services'][service_name.lower().replace(' ', '_')]
                    print(f"  ✅ {status['message']}")
                else:
                    status = self.health_status['services'][service_name.lower().replace(' ', '_')]
                    print(f"  ❌ {status['message']}")
                    
            except Exception as e:
                print(f"  ❌ Unexpected error: {str(e)}")
                self.health_status['services'][service_name.lower().replace(' ', '_')] = {
                    'status': 'ERROR',
                    'message': f'Unexpected error: {str(e)}'
                }
        
        print("")
        print("=" * 50)
        print("HEALTH CHECK SUMMARY")
        print("=" * 50)
        print(f"Total Checks: {total_checks}")
        print(f"Passed: {passed_checks}")
        print(f"Failed: {total_checks - passed_checks}")
        
        if passed_checks == total_checks:
            print("\n🎉 ALL SERVICES HEALTHY!")
            print("Your infrastructure is running properly.")
            self.health_status['overall_status'] = 'HEALTHY'
            return True
        else:
            print(f"\n⚠️  {total_checks - passed_checks} SERVICE(S) UNHEALTHY")
            print("Review the failed checks above.")
            self.health_status['overall_status'] = 'UNHEALTHY'
            return False
    
    def save_health_report(self, filename=None):
        """Save health check results to file"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"health_check_{self.environment}_{timestamp}.json"
        
        try:
            with open(filename, 'w') as f:
                json.dump(self.health_status, f, indent=2)
            print(f"\nHealth report saved to: {filename}")
        except Exception as e:
            print(f"\nFailed to save health report: {e}")


def main():
    """Main entry point"""
    # Set default environment variables if not set
    if not os.getenv('AWS_REGION'):
        os.environ['AWS_REGION'] = 'eu-west-1'
    
    if not os.getenv('ENVIRONMENT'):
        os.environ['ENVIRONMENT'] = 'dev'
    
    if not os.getenv('PROJECT_NAME'):
        os.environ['PROJECT_NAME'] = 'deliverycommand'
    
    # Run health checks
    health_checker = HealthChecker()
    
    try:
        success = health_checker.run_health_checks()
        
        # Save report if requested
        if '--save-report' in sys.argv:
            health_checker.save_health_report()
        
        # Return appropriate exit code
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\nHealth check interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nHealth check failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()