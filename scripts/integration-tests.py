#!/usr/bin/env python3
# scripts/integration-tests.py

import os
import sys
import json
import time
import requests
import boto3
from datetime import datetime

def get_api_url():
    """Get API Gateway URL from Terraform output"""
    try:
        import subprocess
        result = subprocess.run(
            ['terraform', 'output', '-raw', 'api_gateway_url'],
            cwd='terraform/environments/dev',
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        print(f"Error getting API URL: {e}")
    return None

def test_api_endpoints():
    """Test API endpoints for basic functionality"""
    api_url = get_api_url()
    if not api_url:
        print("ERROR: Could not retrieve API Gateway URL")
        return False
    
    print(f"Testing API endpoints at: {api_url}")
    
    tests = [
        {
            'name': 'Health Check',
            'url': f"{api_url}/api/v1/health",
            'method': 'GET',
            'expected_status': 200
        },
        {
            'name': 'Projects List',
            'url': f"{api_url}/api/v1/projects", 
            'method': 'GET',
            'expected_status': [200, 401]  # 401 if auth required
        },
        {
            'name': 'Actions List',
            'url': f"{api_url}/api/v1/actions",
            'method': 'GET', 
            'expected_status': [200, 401]
        },
        {
            'name': 'Requirements List',
            'url': f"{api_url}/api/v1/requirements",
            'method': 'GET',
            'expected_status': [200, 401]
        }
    ]
    
    all_passed = True
    
    for test in tests:
        try:
            print(f"Testing {test['name']}...")
            response = requests.request(
                test['method'], 
                test['url'], 
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            expected = test['expected_status']
            if isinstance(expected, list):
                success = response.status_code in expected
            else:
                success = response.status_code == expected
                
            if success:
                print(f"✓ {test['name']} passed (HTTP {response.status_code})")
            else:
                print(f"✗ {test['name']} failed (HTTP {response.status_code})")
                all_passed = False
                
        except Exception as e:
            print(f"✗ {test['name']} failed with exception: {e}")
            all_passed = False
    
    return all_passed

def test_lambda_functions():
    """Test Lambda functions are deployed and working"""
    lambda_client = boto3.client('lambda', region_name='eu-west-1')
    
    expected_functions = [
        'deliverycommand-dev-api-handler',
        'deliverycommand-dev-document-processor', 
        'deliverycommand-dev-jwt-authorizer'
    ]
    
    print("Testing Lambda function deployment...")
    all_passed = True
    
    for function_name in expected_functions:
        try:
            response = lambda_client.get_function(FunctionName=function_name)
            print(f"✓ {function_name} deployed successfully")
            
            # Test function can be invoked
            test_event = json.dumps({
                "httpMethod": "GET",
                "path": "/health",
                "headers": {},
                "body": None
            })
            
            invoke_response = lambda_client.invoke(
                FunctionName=function_name,
                Payload=test_event
            )
            
            if invoke_response['StatusCode'] == 200:
                print(f"✓ {function_name} invocation successful")
            else:
                print(f"✗ {function_name} invocation failed")
                all_passed = False
                
        except Exception as e:
            print(f"✗ {function_name} test failed: {e}")
            all_passed = False
    
    return all_passed

def test_dynamodb_access():
    """Test DynamoDB table exists and is accessible"""
    dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
    
    try:
        table = dynamodb.Table('deliverycommand-dev-main')
        response = table.scan(Limit=1)
        print("✓ DynamoDB table accessible")
        return True
    except Exception as e:
        print(f"✗ DynamoDB access failed: {e}")
        return False

def test_s3_bucket():
    """Test S3 bucket exists and is accessible"""
    s3_client = boto3.client('s3', region_name='eu-west-1')
    
    try:
        buckets = s3_client.list_buckets()
        dev_buckets = [b['Name'] for b in buckets['Buckets'] if 'deliverycommand-dev' in b['Name']]
        
        if dev_buckets:
            print(f"✓ S3 bucket found: {dev_buckets[0]}")
            return True
        else:
            print("✗ No S3 bucket found")
            return False
    except Exception as e:
        print(f"✗ S3 bucket test failed: {e}")
        return False

def test_cloudwatch_monitoring():
    """Test CloudWatch resources are created"""
    cloudwatch = boto3.client('cloudwatch', region_name='eu-west-1')
    
    try:
        # Check dashboards
        dashboards = cloudwatch.list_dashboards()
        dev_dashboards = [d['DashboardName'] for d in dashboards['DashboardEntries'] 
                         if 'deliverycommand-dev' in d['DashboardName']]
        
        if len(dev_dashboards) >= 3:
            print(f"✓ CloudWatch dashboards created ({len(dev_dashboards)} found)")
        else:
            print(f"✗ Missing CloudWatch dashboards (only {len(dev_dashboards)} found)")
            return False
            
        # Check alarms
        alarms = cloudwatch.describe_alarms()
        dev_alarms = [a['AlarmName'] for a in alarms['MetricAlarms']
                     if 'deliverycommand-dev' in a['AlarmName']]
        
        if len(dev_alarms) >= 5:
            print(f"✓ CloudWatch alarms created ({len(dev_alarms)} found)")
        else:
            print(f"✗ Missing CloudWatch alarms (only {len(dev_alarms)} found)")
            return False
            
        return True
    except Exception as e:
        print(f"✗ CloudWatch monitoring test failed: {e}")
        return False

def main():
    """Run all integration tests"""
    print("Starting integration tests...")
    print("=" * 50)
    
    tests = [
        ("API Endpoints", test_api_endpoints),
        ("Lambda Functions", test_lambda_functions), 
        ("DynamoDB Access", test_dynamodb_access),
        ("S3 Bucket", test_s3_bucket),
        ("CloudWatch Monitoring", test_cloudwatch_monitoring)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{test_name} Tests:")
        result = test_func()
        results.append((test_name, result))
    
    print("\n" + "=" * 50)
    print("Integration Test Results:")
    
    all_passed = True
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n✓ All integration tests passed!")
        sys.exit(0)
    else:
        print("\n✗ Some integration tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()