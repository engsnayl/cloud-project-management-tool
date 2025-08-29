# scripts/health-check.py
import requests
import sys
import argparse

def check_api_health(base_url):
    """Basic health check for the API"""
    try:
        # Try the health endpoint
        health_url = f"{base_url}/health"
        print(f"Checking health endpoint: {health_url}")
        
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            print("Health check passed!")
            return True
        else:
            print(f"Health check failed with status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Health check failed with error: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Run health check')
    parser.add_argument('--environment', '-e', default='dev',
                       choices=['dev', 'staging', 'prod'],
                       help='Environment to check')
    
    args = parser.parse_args()
    
    # Environment-specific URLs
    urls = {
        'dev': 'https://x8dd7fpwf3.execute-api.eu-west-1.amazonaws.com/dev',
        'staging': 'https://api-staging.actiontracker.com',
        'prod': 'https://api.actiontracker.com'
    }
    
    base_url = urls.get(args.environment, urls['dev'])
    
    print(f"Running health check for {args.environment.upper()} environment")
    success = check_api_health(base_url)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()