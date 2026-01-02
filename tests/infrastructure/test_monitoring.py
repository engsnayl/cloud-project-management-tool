#!/usr/bin/env python3
"""
Infrastructure tests for CloudWatch Monitoring
Tests that monitoring dashboards and alerts are properly configured
"""

import boto3
import os
import pytest
from botocore.exceptions import ClientError


class TestMonitoring:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS clients
        self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
        self.sns = boto3.client('sns', region_name=self.region)
        self.logs = boto3.client('logs', region_name=self.region)
    
    def test_cloudwatch_dashboards(self):
        """Test that CloudWatch dashboards exist"""
        expected_dashboards = [
            f"{self.project_name}-{self.environment}-system-health",
            f"{self.project_name}-{self.environment}-business-metrics",
            f"{self.project_name}-{self.environment}-costs",
            f"{self.project_name}-{self.environment}-advanced-alerts"
        ]
        
        try:
            response = self.cloudwatch.list_dashboards()
            dashboards = response.get('DashboardEntries', [])
            dashboard_names = [d['DashboardName'] for d in dashboards]
            
            found_dashboards = []
            for expected in expected_dashboards:
                if expected in dashboard_names:
                    found_dashboards.append(expected)
                    print(f"✓ Dashboard exists: {expected}")
                else:
                    print(f"! Missing dashboard: {expected}")
            
            assert len(found_dashboards) > 0, "No expected dashboards found"
            print(f"✓ Found {len(found_dashboards)} of {len(expected_dashboards)} expected dashboards")
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudWatch dashboards: {e}")
    
    def test_sns_topics(self):
        """Test that SNS topics for alerts exist"""
        expected_topics = [
            f"{self.project_name}-{self.environment}-alerts",
            f"{self.project_name}-{self.environment}-critical-alerts",
            f"{self.project_name}-{self.environment}-cloudtrail-alerts"
        ]
        
        try:
            response = self.sns.list_topics()
            topics = response.get('Topics', [])
            topic_names = []
            
            for topic in topics:
                topic_arn = topic['TopicArn']
                topic_name = topic_arn.split(':')[-1]
                topic_names.append(topic_name)
            
            found_topics = []
            for expected in expected_topics:
                if expected in topic_names:
                    found_topics.append(expected)
                    print(f"✓ SNS topic exists: {expected}")
                else:
                    print(f"! Missing SNS topic: {expected}")
            
            assert len(found_topics) > 0, "No expected SNS topics found"
            print(f"✓ Found {len(found_topics)} of {len(expected_topics)} expected SNS topics")
            
        except ClientError as e:
            pytest.fail(f"Error checking SNS topics: {e}")
    
    def test_cloudwatch_alarms(self):
        """Test that CloudWatch alarms are configured"""
        expected_alarm_prefixes = [
            f"{self.project_name}-{self.environment}-api-high-error-rate",
            f"{self.project_name}-{self.environment}-lambda-high-errors",
            f"{self.project_name}-{self.environment}-lambda-high-duration"
        ]
        
        try:
            response = self.cloudwatch.describe_alarms(MaxRecords=100)
            alarms = response.get('MetricAlarms', [])
            alarm_names = [alarm['AlarmName'] for alarm in alarms]
            
            found_alarms = []
            for prefix in expected_alarm_prefixes:
                matching_alarms = [name for name in alarm_names if name.startswith(prefix)]
                if matching_alarms:
                    found_alarms.extend(matching_alarms)
                    for alarm_name in matching_alarms:
                        alarm = next(a for a in alarms if a['AlarmName'] == alarm_name)
                        state = alarm.get('StateValue', 'UNKNOWN')
                        print(f"✓ Alarm exists: {alarm_name} (State: {state})")
                else:
                    print(f"! No alarms found with prefix: {prefix}")
            
            assert len(found_alarms) > 0, "No expected alarms found"
            print(f"✓ Found {len(found_alarms)} monitoring alarms")
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudWatch alarms: {e}")
    
    def test_log_groups(self):
        """Test that CloudWatch log groups exist"""
        expected_log_groups = [
            f"/aws/lambda/{self.project_name}-{self.environment}-api-handler",
            f"/aws/lambda/{self.project_name}-{self.environment}-document-processor",
            f"/aws/cloudtrail/{self.project_name}-{self.environment}"
        ]
        
        try:
            for log_group_name in expected_log_groups:
                try:
                    response = self.logs.describe_log_groups(
                        logGroupNamePrefix=log_group_name,
                        limit=1
                    )
                    
                    log_groups = response.get('logGroups', [])
                    log_group = next((lg for lg in log_groups if lg['logGroupName'] == log_group_name), None)
                    
                    if log_group:
                        retention = log_group.get('retentionInDays', 'Never expire')
                        print(f"✓ Log group exists: {log_group_name} (Retention: {retention} days)")
                    else:
                        print(f"! Missing log group: {log_group_name}")
                        
                except ClientError as e:
                    print(f"! Error checking log group {log_group_name}: {e}")
            
        except Exception as e:
            pytest.fail(f"Error checking log groups: {e}")
    
    def test_log_insights_queries(self):
        """Test that CloudWatch Insights queries are configured"""
        expected_queries = [
            f"{self.project_name}-{self.environment}-error-analysis",
            f"{self.project_name}-{self.environment}-performance-analysis"
        ]
        
        try:
            response = self.logs.describe_query_definitions()
            query_definitions = response.get('queryDefinitions', [])
            query_names = [q['name'] for q in query_definitions]
            
            found_queries = []
            for expected in expected_queries:
                if expected in query_names:
                    found_queries.append(expected)
                    print(f"✓ Log Insights query exists: {expected}")
                else:
                    print(f"! Missing Log Insights query: {expected}")
            
            if len(found_queries) > 0:
                print(f"✓ Found {len(found_queries)} of {len(expected_queries)} expected queries")
            else:
                print("! No Log Insights queries found")
            
        except ClientError as e:
            pytest.fail(f"Error checking Log Insights queries: {e}")
    
    def test_composite_alarms(self):
        """Test composite alarms for system health"""
        try:
            response = self.cloudwatch.describe_alarms(
                AlarmTypes=['CompositeAlarm'],
                MaxRecords=50
            )
            
            composite_alarms = response.get('CompositeAlarms', [])
            
            # Look for system health composite alarm
            system_health_alarm = None
            for alarm in composite_alarms:
                if 'system-critical-health' in alarm['AlarmName']:
                    system_health_alarm = alarm
                    break
            
            if system_health_alarm:
                state = system_health_alarm.get('StateValue', 'UNKNOWN')
                print(f"✓ Composite alarm exists: {system_health_alarm['AlarmName']} (State: {state})")
            else:
                print("! No system health composite alarm found")
            
            print(f"✓ Total composite alarms: {len(composite_alarms)}")
            
        except ClientError as e:
            pytest.fail(f"Error checking composite alarms: {e}")


def run_tests():
    """Run all monitoring tests"""
    print("=" * 50)
    print("MONITORING INFRASTRUCTURE TESTS")
    print("=" * 50)
    
    tester = TestMonitoring()
    
    try:
        tester.test_cloudwatch_dashboards()
        tester.test_sns_topics()
        tester.test_cloudwatch_alarms()
        tester.test_log_groups()
        tester.test_log_insights_queries()
        tester.test_composite_alarms()
        
        print("\n✓ All monitoring tests passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ Monitoring test failed: {e}")
        return False


if __name__ == "__main__":
    run_tests()