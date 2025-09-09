#!/usr/bin/env python3
"""
Main test runner for infrastructure validation
Runs all infrastructure tests and provides summary report
"""

import os
import sys
import time
from datetime import datetime

# Add the infrastructure tests directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'infrastructure'))

# Import test modules
from test_api_gateway import run_tests as test_api_gateway
from test_lambda_functions import run_tests as test_lambda_functions
from test_dynamodb import run_tests as test_dynamodb
from test_cloudtrail import run_tests as test_cloudtrail
from test_monitoring import run_tests as test_monitoring


def run_infrastructure_tests():
    """Run all infrastructure tests and report results"""
    
    print("=" * 70)
    print("INFRASTRUCTURE VALIDATION TEST SUITE")
    print("=" * 70)
    print(f"Environment: {os.getenv('ENVIRONMENT', 'dev')}")
    print(f"Project: {os.getenv('PROJECT_NAME', 'deliverycommand')}")
    print(f"Region: {os.getenv('AWS_REGION', 'eu-west-1')}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 70)
    
    # Test configurations
    tests = [
        ("API Gateway", test_api_gateway),
        ("Lambda Functions", test_lambda_functions),
        ("DynamoDB", test_dynamodb),
        ("CloudTrail", test_cloudtrail),
        ("Monitoring", test_monitoring)
    ]
    
    results = {}
    start_time = time.time()
    
    for test_name, test_function in tests:
        print(f"\n Running {test_name} tests...")
        
        try:
            test_start = time.time()
            success = test_function()
            test_duration = time.time() - test_start
            
            results[test_name] = {
                'success': success,
                'duration': test_duration,
                'error': None
            }
            
        except Exception as e:
            test_duration = time.time() - test_start
            results[test_name] = {
                'success': False,
                'duration': test_duration,
                'error': str(e)
            }
            print(f"ERROR: {test_name} tests failed with error: {e}")
    
    total_duration = time.time() - start_time
    
    # Print summary report
    print("\n" + "=" * 70)
    print("TEST SUMMARY REPORT")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "PASS" if result['success'] else "FAIL"
        duration = f"{result['duration']:.2f}s"
        print(f"{test_name:<20} {status:<10} ({duration})")
        
        if result['success']:
            passed += 1
        else:
            failed += 1
            if result['error']:
                print(f"  Error: {result['error']}")
    
    print("=" * 70)
    print(f"Total Tests: {len(tests)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total Duration: {total_duration:.2f}s")
    
    if failed == 0:
        print("\nALL INFRASTRUCTURE TESTS PASSED!")
        print("Your infrastructure is properly configured and operational.")
        return True
    else:
        print(f"\n{failed} TEST SUITE(S) FAILED")
        print("Review the errors above and fix the infrastructure issues.")
        return False


def validate_environment():
    """Validate that required environment variables are set"""
    required_env = ['AWS_REGION']
    optional_env = {
        'ENVIRONMENT': 'dev',
        'PROJECT_NAME': 'deliverycommand'
    }
    
    # Set defaults for optional environment variables
    for env_var, default_value in optional_env.items():
        if not os.getenv(env_var):
            os.environ[env_var] = default_value
    
    # Check required environment variables
    missing_env = []
    for env_var in required_env:
        if not os.getenv(env_var):
            missing_env.append(env_var)
    
    if missing_env:
        print(f"Missing required environment variables: {', '.join(missing_env)}")
        print("Set these variables before running tests:")
        for env_var in missing_env:
            print(f"  export {env_var}=<value>")
        return False
    
    return True


def main():
    """Main entry point"""
    if not validate_environment():
        sys.exit(1)
    
    success = run_infrastructure_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()