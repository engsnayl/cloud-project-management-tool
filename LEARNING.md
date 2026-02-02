# Learning Guide: Cloud Project Management Tool

This guide walks you through the entire architecture of **DeliveryCommand**, a cloud-native project management platform built on AWS with Terraform. It's written for someone with basic IT knowledge who wants to understand *why* things are built this way, not just *what* they are.

---

## Table of Contents

1. [The Problem We're Solving](#1-the-problem-were-solving)
2. [The Big Picture](#2-the-big-picture)
3. [How Each AWS Service Fits Together](#3-how-each-aws-service-fits-together)
4. [The Terraform Module Structure](#4-the-terraform-module-structure)
5. [Tracing a Request End-to-End](#5-tracing-a-request-end-to-end)
6. [Security Decisions and Why They Matter](#6-security-decisions-and-why-they-matter)
7. [Common Mistakes and How We Avoided Them](#7-common-mistakes-and-how-we-avoided-them)
8. [How to Read and Navigate This Codebase](#8-how-to-read-and-navigate-this-codebase)
9. [CI/CD Pipeline (GitHub Actions)](#9-cicd-pipeline-github-actions)
10. [The Production Environment](#10-the-production-environment)
11. [DynamoDB Access Patterns: Query vs Scan](#11-dynamodb-access-patterns-query-vs-scan)
12. [Exercises and Next Steps](#12-exercises-and-next-steps)

---

## 1. The Problem We're Solving

Imagine a team that needs to track projects, assign actions to people, set deadlines, and get notified when things are overdue. They need a web application that:

- Lets users log in securely
- Shows a dashboard of projects, requirements, and action items
- Sends email reminders for overdue tasks
- Stores uploaded documents
- Handles multiple users concurrently without a server to maintain

We could run this on a traditional server (an EC2 instance with a database), but that means:

- Paying for a server 24/7, even when nobody is using the app at 3am
- Manually patching the operating system and scaling when traffic grows
- Managing database backups, failover, and replication ourselves

Instead, we use a **serverless architecture**. AWS manages the servers for us. We only pay when someone actually uses the application. The infrastructure scales automatically and most operational maintenance is handled by AWS.

---

## 2. The Big Picture

Here is how a user's request flows through the system:

```
                                 +------------------+
                                 |   Route53 (DNS)  |
                                 |  engsnayl.com    |
                                 +--------+---------+
                                          |
                          +---------------+---------------+
                          |                               |
                 +--------v--------+             +--------v--------+
                 |   CloudFront    |             |   API Gateway   |
                 | (CDN for React) |             |  (REST API)     |
                 +--------+--------+             +--------+--------+
                          |                               |
                 +--------v--------+             +--------v--------+
                 |    S3 Bucket    |             | JWT Authorizer  |
                 | (Frontend HTML/ |             |   (Lambda)      |
                 |  CSS/JS files)  |             +--------+--------+
                 +-----------------+                      |
                                                 +--------v--------+
                                                 |   API Handler   |
                                                 |   (Lambda)      |
                                                 +---+----+----+---+
                                                     |    |    |
                                          +----------+    |    +----------+
                                          |               |               |
                                 +--------v---+    +------v------+  +-----v------+
                                 |  DynamoDB   |   | S3 Documents|  | EventBridge|
                                 | (Database)  |   |  (Uploads)  |  |  (Events)  |
                                 +-------------+   +-------------+  +-----+------+
                                                                          |
                                                                   +------v------+
                                                                   |   SES       |
                                                                   | (Emails)    |
                                                                   +-------------+
```

**The two main paths:**

1. **Frontend path**: A user's browser asks DNS for `actions-dev.engsnayl.com`, gets pointed to CloudFront, which serves the React app from an S3 bucket. This is just static files -- HTML, CSS, and JavaScript.

2. **API path**: The React app makes API calls to API Gateway. Each request is checked by a JWT authorizer Lambda (is this user logged in?), then handled by the API handler Lambda, which reads/writes to DynamoDB, stores files in S3, and emits events to EventBridge.

---

## 3. How Each AWS Service Fits Together

### 3.1 Cognito -- "Who are you?"

**What it does**: Manages user sign-up, login, and tokens.

**Why we chose it**: Building your own authentication system is one of the most common sources of security vulnerabilities. Cognito handles password hashing, token expiry, brute-force protection, and MFA out of the box. We don't store passwords anywhere in our code.

**How it works here**:
1. User signs up with email and password
2. Cognito verifies their email with a code
3. On login, Cognito issues three tokens:
   - **Access token** (1 hour) -- proves who you are to the API
   - **ID token** (1 hour) -- contains user profile info
   - **Refresh token** (30 days) -- lets you get new access tokens without logging in again

**Key config** (`modules/cognito/main.tf`):
- Password policy requires 12+ characters, mixed case, numbers, and symbols
- Advanced security mode is `ENFORCED` (detects compromised credentials)
- Two user groups (`admin`, `user`) enable role-based access control

### 3.2 API Gateway -- "The front door"

**What it does**: Receives HTTP requests and routes them to Lambda functions.

**Why we chose it**: Instead of running a web server (like Nginx or Express), API Gateway gives us a managed HTTP endpoint that automatically scales, handles SSL/TLS, and integrates with AWS authentication.

**How it works here** (`modules/api-gateway/main.tf`):
```
API Gateway REST API
  └── /api
       └── /v1
            ├── /health          GET    (no auth -- health checks)
            ├── /requirements    GET, POST
            ├── /projects        GET, POST
            ├── /projects/{id}   GET, PUT, DELETE
            ├── /actions         GET, POST
            ├── /actions/{id}    GET, PUT, DELETE
            └── /analytics
                 ├── /dashboard  GET
                 └── /actions    GET
```

Every endpoint except `/health` requires a valid JWT token. The authorizer Lambda validates the token before the request reaches the API handler.

**Usage plan and throttling**: We limit requests to 100/second with a burst of 200. This prevents a single user (or attacker) from overwhelming the system and running up costs.

### 3.3 Lambda -- "The brains"

**What it does**: Runs our Python code without managing servers. AWS spins up a container, runs the function, then shuts it down.

**Why we chose it**: We only pay per request (first 1 million/month are free). No servers to patch. Automatic scaling from 0 to thousands of concurrent executions.

**Our functions** (`modules/lambda/main.tf`):

| Function | Runtime | Timeout | Purpose |
|----------|---------|---------|---------|
| `api-handler` | Python 3.12 | 30s | Processes all API requests |
| `jwt-authorizer` | Python 3.12 | 10s | Validates JWT tokens |
| `email-reminder` | Python 3.11 | 300s | Sends scheduled notifications |

**Why separate roles matter**: The api-handler needs access to DynamoDB, S3, and EventBridge. The jwt-authorizer only needs to read CloudWatch Logs. We give each function its own IAM role with the minimum permissions it needs. If the authorizer were compromised, the attacker couldn't read your database because that role simply doesn't have permission.

### 3.4 DynamoDB -- "The database"

**What it does**: A fully managed NoSQL database. No servers, no maintenance, no connection pooling.

**Why we chose it over RDS (SQL)**:
- Serverless Lambda functions create and destroy connections rapidly. Traditional SQL databases struggle with this "connection storm" pattern.
- DynamoDB scales to any size with single-digit millisecond latency.
- Pay-per-request pricing means zero cost when idle.

**Our table design** (`modules/dynamodb/main.tf`):

We use a **single-table design** with generic keys:

```
+--------+------------------+--------+------------------+
|   PK   |       SK         | GSI1PK |     GSI1SK       |
+--------+------------------+--------+------------------+
| USER#1 | PROFILE          | ORG#A  | USER#1           |
| PROJ#1 | METADATA         | ORG#A  | PROJ#1           |
| PROJ#1 | ACTION#1         | STATUS#OPEN | 2025-03-15  |
| PROJ#1 | ACTION#2         | STATUS#DONE | 2025-03-10  |
+--------+------------------+--------+------------------+
```

The primary key (`PK` + `SK`) handles the main access patterns. The Global Secondary Index (`GSI1PK` + `GSI1SK`) handles secondary queries like "give me all open actions." This is more complex than SQL tables but dramatically reduces cost and latency.

### 3.5 S3 -- "File storage"

**What it does**: Object storage for documents and the frontend website.

**We have two S3 buckets**:
1. **Documents bucket** (`modules/s3/main.tf`) -- stores uploaded files (PDFs, DOCX)
2. **Frontend bucket** (`modules/frontend-hosting/main.tf`) -- hosts the React build output

**Key features on the documents bucket**:
- **Versioning**: Every file change is kept. Accidentally overwrite a document? Retrieve the previous version.
- **Lifecycle policy**: After 30 days, files move to cheaper "Infrequent Access" storage. After 90 days, they archive to Glacier (very cheap, slow retrieval). This automates cost optimization.
- **Encryption**: All objects encrypted at rest with AES-256.
- **Public access block**: All four settings enabled. Nothing in this bucket is ever public.

### 3.6 CloudFront -- "The speed layer"

**What it does**: A Content Delivery Network (CDN) that caches the frontend files at edge locations worldwide.

**Why we need it**:
- A user in London gets the React app from a nearby edge server instead of crossing the Atlantic to eu-west-1.
- It provides HTTPS with a custom domain (`actions-dev.engsnayl.com`).
- It protects the S3 bucket -- users hit CloudFront, not S3 directly.

**Origin Access Control (OAC)**: The S3 bucket is private. Only CloudFront can read from it, authenticated via OAC. This is the modern replacement for Origin Access Identity (OAI).

### 3.7 EventBridge -- "The event bus"

**What it does**: Routes events between services without them knowing about each other.

**Why we chose it**: When a requirement is created, several things should happen -- start an approval workflow, update analytics, maybe send a notification. Instead of the API handler calling all these services directly (tight coupling), it publishes an event to EventBridge and walks away. EventBridge routes the event to the right targets.

```
API Handler publishes:             EventBridge routes to:
  "requirement.created"     --->     Step Functions (approval workflow)
  "document.uploaded"       --->     Step Functions (processing workflow)
  "requirement.status.changed" -->   Lambda (send notification)
  "workflow.completed"      --->     Lambda (update analytics)
```

This pattern is called **event-driven architecture**. It makes the system easier to extend -- adding a new reaction to an event means adding a new rule, not modifying existing code.

### 3.8 SES + EventBridge Scheduler -- "Email notifications"

**What it does**: Sends scheduled email reminders for overdue actions.

**How it works** (`modules/email-notifications/main.tf`):
- EventBridge Scheduler triggers the email-reminder Lambda at 9 AM Monday-Friday
- The Lambda queries DynamoDB for actions due today
- It uses SES (Simple Email Service) to send formatted HTML emails
- A separate schedule at 10 AM daily sends overdue alerts

### 3.9 CloudTrail -- "The audit log"

**What it does**: Records every API call made in your AWS account. Who did what, when, and from where.

**Why it matters**: If someone deletes a resource or accesses something they shouldn't, CloudTrail is how you investigate. It's also required for most compliance frameworks (SOC 2, ISO 27001, etc.).

**Our setup** (`modules/cloudtrail/main.tf`):
- Logs stored in a dedicated S3 bucket with encryption
- Security alarms for: root account usage, unauthorized API calls, console logins without MFA, IAM policy changes

### 3.10 VPC -- "The private network"

**What it does**: Creates an isolated virtual network for resources that need it.

**Our layout** (`modules/vpc/main.tf`):
```
VPC: 10.0.0.0/16 (65,536 IP addresses)
 |
 +-- Public Subnet 1:  10.0.0.0/24  (eu-west-1a)  -- Internet accessible
 +-- Public Subnet 2:  10.0.1.0/24  (eu-west-1b)  -- Internet accessible
 +-- Private Subnet 1: 10.0.2.0/24  (eu-west-1a)  -- No direct internet
 +-- Private Subnet 2: 10.0.3.0/24  (eu-west-1b)  -- No direct internet
```

**Why two of each?** High availability. If the `eu-west-1a` data center has issues, the `eu-west-1b` subnets keep running.

**NAT Gateway**: Disabled in dev (costs ~$32/month). When enabled in prod, it lets private subnet resources reach the internet (for downloading packages) without being reachable *from* the internet.

---

## 4. The Terraform Module Structure

### 4.1 What is Terraform?

Terraform is an "Infrastructure as Code" tool. Instead of clicking through the AWS console to create resources, you write configuration files that describe what you want. Terraform figures out what to create, update, or delete to match your description.

**The key idea**: Your infrastructure is version-controlled, reviewable, and repeatable. You can spin up an identical copy of your entire environment in minutes.

### 4.2 Project Layout

```
terraform/
 |
 +-- shared/                    <-- Run once: creates the S3 bucket and
 |    +-- main.tf                   DynamoDB table that store Terraform state
 |    +-- variables.tf
 |    +-- outputs.tf
 |
 +-- modules/                   <-- Reusable building blocks
 |    +-- api-gateway/          Each module is a self-contained unit
 |    +-- cloudtrail/           with its own variables, resources,
 |    +-- cloudwatch/           and outputs.
 |    +-- cognito/
 |    +-- dynamodb/
 |    +-- email-notifications/
 |    +-- eventbridge/
 |    +-- frontend-hosting/
 |    +-- lambda/
 |    +-- s3/
 |    +-- vpc/
 |
 +-- environments/              <-- Environment-specific configurations
      +-- dev/                  These call the modules above with
      |    +-- terraform.tf     different settings per environment.
      |    +-- main.tf
      |    +-- variables.tf
      |    +-- outputs.tf
      |    +-- dev.tfvars
      +-- staging/
      |    +-- (same structure)
      |    +-- staging.tfvars
      +-- prod/
           +-- (same structure)
           +-- prod.tfvars
```

### 4.3 How to Read a Terraform Module

Every module follows the same three-file pattern:

**`variables.tf`** -- The inputs. What does this module need to know?
```hcl
variable "project_name" {
  description = "Name of the project"    # Human-readable explanation
  type        = string                   # What kind of value
  default     = "deliverycommand"        # Optional default
}
```

**`main.tf`** -- The resources. What does this module create?
```hcl
resource "aws_dynamodb_table" "main" {   # resource TYPE and local NAME
  name         = "${var.project_name}-main"  # Uses the variable above
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  # ... more configuration
}
```

**`outputs.tf`** -- The exports. What does this module tell the outside world?
```hcl
output "table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.main.arn   # References the resource above
}
```

### 4.4 How Modules Connect

In `environments/dev/main.tf`, modules are wired together like building blocks:

```hcl
module "dynamodb" {
  source = "../../modules/dynamodb"
  project_name = var.project_name         # Pass a variable in
}

module "lambda" {
  source = "../../modules/lambda"
  dynamodb_table_arn = module.dynamodb.table_arn   # Use DynamoDB's output
  s3_bucket_arn      = module.s3.bucket_arn        # Use S3's output
}
```

This creates a **dependency graph**. Terraform knows it must create DynamoDB before Lambda because Lambda references DynamoDB's output. You never have to specify the order -- Terraform figures it out.

```
         VPC
          |
      DynamoDB    S3     Cognito    EventBridge
          \       |        /            |
           +------+-------+            |
                  |                    |
               Lambda  <--------------+
                  |
            API Gateway
                  |
          Frontend Hosting
```

### 4.5 State and Locking

When Terraform creates resources, it records what it created in a **state file**. This file is the source of truth for "what exists in AWS right now."

We store state in S3 (not locally) so the whole team shares it. The DynamoDB lock table prevents two people from running `terraform apply` simultaneously, which could corrupt the state.

```hcl
# In terraform.tf
backend "s3" {
  bucket         = "deliverycommand-terraform-state-py72t4of"
  key            = "environments/dev/terraform.tfstate"
  region         = "eu-west-1"
  dynamodb_table = "deliverycommand-terraform-locks"
  encrypt        = true
}
```

### 4.6 Environment Differences via .tfvars

The same modules are used for dev, staging, and prod. The differences are configuration values:

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| NAT Gateway | Off | Off | On |
| VPC Flow Logs | Off | On | On |
| DynamoDB PITR | Off | On | On |
| Deletion Protection | Off | On | On |
| Log Retention | 14 days | 30 days | 90 days |
| CORS Origins | localhost + dev domain | staging domain | prod domain |

You apply these with: `terraform apply -var-file=dev.tfvars`

---

## 5. Tracing a Request End-to-End

Let's follow what happens when a user creates a new action item.

### Step 1: User Clicks "Create Action"

The React frontend (served from S3 via CloudFront) makes a POST request:
```
POST https://abc123.execute-api.eu-west-1.amazonaws.com/dev/api/v1/actions
Headers:
  Authorization: Bearer eyJhbGciOiJSUzI1NiIs...  (JWT token from Cognito)
  Content-Type: application/json
Body:
  {"title": "Review proposal", "projectId": "PROJ#1", "dueDate": "2025-04-01"}
```

### Step 2: API Gateway Receives the Request

API Gateway matches the URL to the `/api/v1/actions` POST method. It sees `authorization = "CUSTOM"` and invokes the JWT authorizer Lambda *before* touching the API handler.

### Step 3: JWT Authorizer Validates the Token

The `jwt-authorizer` Lambda:
1. Extracts the Bearer token from the Authorization header
2. Downloads Cognito's public keys (JSON Web Key Set)
3. Verifies the token's signature (proves Cognito issued it)
4. Checks the token hasn't expired
5. Returns an IAM policy: `Allow execute-api:Invoke` or `Deny`

If denied, the user gets a `403 Forbidden` response. The api-handler Lambda is never invoked -- saving compute costs.

### Step 4: API Handler Processes the Request

The `api-handler` Lambda receives an event object from API Gateway containing the HTTP method, path, headers, body, and the authorized user info. It:

1. Parses the JSON body
2. Generates a unique action ID
3. Writes to DynamoDB:
   ```
   PK: "PROJ#1"
   SK: "ACTION#abc123"
   GSI1PK: "STATUS#OPEN"
   GSI1SK: "2025-04-01"
   title: "Review proposal"
   createdBy: "USER#xyz"
   createdAt: "2025-03-15T10:30:00Z"
   ```
4. Publishes an event to EventBridge:
   ```json
   {
     "source": "deliverycommand.requirements",
     "detail-type": "requirement-created",
     "detail": { "actionId": "abc123", "projectId": "PROJ#1" }
   }
   ```
5. Returns a response to API Gateway:
   ```json
   {"statusCode": 201, "body": {"id": "abc123", "message": "Action created"}}
   ```

### Step 5: API Gateway Returns the Response

API Gateway adds CORS headers and sends the HTTP response back to the user's browser.

### Step 6: Async Processing (Background)

Meanwhile, EventBridge picks up the event and routes it based on rules. If a Step Functions workflow ARN is configured, it starts the approval process. The user doesn't wait for this -- it happens asynchronously.

### Step 7: The Next Morning

At 9 AM, EventBridge Scheduler triggers the `email-reminder` Lambda. It queries DynamoDB for actions due today, finds "Review proposal", and sends an HTML email via SES to the assignee.

```
Complete Request Timeline:

Browser       CloudFront      API GW       Authorizer    API Handler    DynamoDB    EventBridge
   |              |              |              |              |            |            |
   |--GET page--->|              |              |              |            |            |
   |<--React app--|              |              |              |            |            |
   |              |              |              |              |            |            |
   |----------POST /actions----->|              |              |            |            |
   |              |              |--validate--->|              |            |            |
   |              |              |<---allow-----|              |            |            |
   |              |              |----------invoke------------>|            |            |
   |              |              |              |              |--PutItem-->|            |
   |              |              |              |              |<---ok------|            |
   |              |              |              |              |--------PutEvents------->|
   |              |              |              |              |<----------ok------------|
   |              |              |<---------201 Created--------|            |            |
   |<---------201 Created-------|              |              |            |            |
```

---

## 6. Security Decisions and Why They Matter

### 6.1 Principle of Least Privilege

Every component gets the *minimum* permissions it needs to function. Nothing more.

```
api-handler role CAN:              jwt-authorizer role CAN:
  - Read/write DynamoDB table        - Write to CloudWatch Logs
  - Read/write S3 documents          - (nothing else)
  - Publish EventBridge events
  - Write to CloudWatch Logs

api-handler role CANNOT:           jwt-authorizer role CANNOT:
  - Create/delete DynamoDB tables    - Read DynamoDB
  - Access other S3 buckets          - Access S3
  - Modify IAM policies              - Publish events
```

**Why this matters**: If an attacker exploits a vulnerability in the JWT authorizer, they can only write log messages. They can't read your database, steal documents, or escalate privileges. The blast radius of any compromise is contained.

### 6.2 Authentication at the API Gateway Level

We validate JWT tokens *before* the request reaches our code. This means:
- Invalid/expired tokens are rejected at the gateway level (cheaper than invoking a Lambda)
- The `/health` endpoint stays unauthenticated for monitoring tools
- CORS preflight (OPTIONS) requests are unauthenticated (browsers send these automatically)

### 6.3 Encryption Everywhere

| Data | Encryption |
|------|-----------|
| DynamoDB records | Server-side encryption (AWS managed keys) |
| S3 documents | AES-256 server-side encryption |
| Terraform state | S3 server-side encryption |
| CloudTrail logs | Server-side encryption |
| Data in transit | TLS 1.2+ enforced on CloudFront and API Gateway |

### 6.4 Network Isolation

The S3 documents bucket blocks all public access via four settings:
```hcl
block_public_acls       = true    # Can't add public ACLs
block_public_policy     = true    # Can't add public bucket policies
ignore_public_acls      = true    # Existing public ACLs are ignored
restrict_public_buckets = true    # Bucket can't be made public
```

The frontend S3 bucket is accessible *only* through CloudFront (via OAC), not directly.

### 6.5 Audit Trail

CloudTrail records every AWS API call. We set up automated alarms for:
- **Root account access**: The root account should almost never be used
- **Unauthorized API calls**: Someone trying actions they don't have permission for
- **Console logins without MFA**: A potential credential compromise
- **IAM policy changes**: Someone modifying permissions

### 6.6 CORS Restrictions

Cross-Origin Resource Sharing (CORS) controls which websites can call your API. We restrict it to our actual domains:
```
Dev:     ["http://localhost:3000", "https://actions-dev.engsnayl.com"]
Staging: ["https://actions-staging.engsnayl.com"]
Prod:    ["https://actions.engsnayl.com"]
```

A wildcard (`*`) would let any website make requests to your API on behalf of a logged-in user.

---

## 7. Common Mistakes and How We Avoided Them

### Mistake 1: Unauthenticated API endpoints

**The trap**: Setting `authorization = "NONE"` on API Gateway methods during development and forgetting to change it.

**What we did**: Every endpoint except `/health` and CORS OPTIONS uses `authorization = "CUSTOM"` with the JWT authorizer. We also added the authorizer to the deployment trigger hash, so any authorization change forces a redeployment.

### Mistake 2: Overly permissive IAM policies

**The trap**: Using `Resource = "*"` (access to everything) because it's easier than finding the specific ARN.

**What we did**:
- Lambda EventBridge permission scoped to our specific event bus ARN
- Cognito identity actions scoped to our specific identity pool
- Cognito execute-api permission scoped to our specific API Gateway
- Each Lambda function has its own role with only the permissions it needs

### Mistake 3: Shared IAM roles across functions

**The trap**: Creating one "lambda role" and using it for every function. The JWT authorizer ends up with DynamoDB and S3 access it doesn't need.

**What we did**: Separate `api_handler_role` and `jwt_authorizer_role`. The authorizer only gets `AWSLambdaBasicExecutionRole` (CloudWatch Logs access).

### Mistake 4: No API throttling

**The trap**: A misconfigured client or attacker sends thousands of requests per second. Lambda scales to handle them all, and you get a massive AWS bill.

**What we did**: API Gateway usage plan limits requests to 100/second with 200 burst. Method-level throttling is also configured.

### Mistake 5: Hardcoded environment differences

**The trap**: Copy-pasting the entire Terraform configuration for each environment, then they drift apart.

**What we did**: One set of modules, three sets of variables. The `.tfvars` files contain only the values that differ between environments. The module code is identical across dev, staging, and prod.

### Mistake 6: Unnecessary explicit dependencies

**The trap**: Adding `depends_on` everywhere "just to be safe." This actually slows down Terraform by preventing parallel resource creation.

**What we did**: Terraform automatically detects dependencies from variable references. When you write `dynamodb_table_arn = module.dynamodb.table_arn`, Terraform knows to create DynamoDB first. We only keep explicit `depends_on` where there's no variable reference but a real ordering requirement exists (like CloudTrail needing S3 to exist first).

### Mistake 7: No state locking

**The trap**: Two developers run `terraform apply` at the same time. Both read the same state, both try to create resources, state becomes corrupted.

**What we did**: DynamoDB-based state locking. When someone runs `terraform apply`, a lock is acquired. Anyone else trying to apply at the same time gets a clear error message.

### Mistake 8: Outdated runtimes

**The trap**: Deploying Lambda functions on Python 3.9 (or older) which no longer receives security patches.

**What we did**: All functions run on Python 3.12, which is actively maintained.

### Mistake 9: No deletion protection on databases

**The trap**: Someone runs `terraform destroy` or accidentally deletes the DynamoDB table. All data is gone.

**What we did**: `deletion_protection_enabled = true` for staging and prod. Terraform will refuse to delete the table until protection is explicitly removed. Dev keeps it off for easy teardown during development.

### Mistake 10: Frontend bucket publicly accessible

**The trap**: Disabling all S3 public access block settings because CloudFront "needs" it. This leaves the bucket exposed if someone adds a public bucket policy.

**What we did**: Enabled `block_public_acls` and `ignore_public_acls` while keeping `block_public_policy` and `restrict_public_buckets` off (CloudFront's bucket policy requires these). This blocks ACL-based public access while allowing only the CloudFront service principal policy.

---

## 8. How to Read and Navigate This Codebase

### Where to start

1. **Start with `environments/dev/main.tf`**. This is the "table of contents" -- it shows every module and how they connect.

2. **Pick a module** (e.g., `modules/lambda/`). Read `variables.tf` first (what goes in), then `main.tf` (what gets created), then `outputs.tf` (what comes out).

3. **Read `dev.tfvars`** to see what values differ from the defaults.

### Key commands

```bash
# Format all Terraform files (consistent style)
terraform fmt -recursive terraform/

# Initialize Terraform (downloads providers, configures backend)
cd terraform/environments/dev
terraform init

# Preview changes without applying them
terraform plan -var-file=dev.tfvars

# Apply changes (creates/updates/deletes resources)
terraform apply -var-file=dev.tfvars

# Show current state of all resources
terraform state list

# Show details of a specific resource
terraform state show module.lambda.aws_lambda_function.api_handler
```

### Reading the dependency graph

When you see this in `main.tf`:
```hcl
module "lambda" {
  s3_bucket_arn = module.s3.bucket_arn
}
```

It means: "Lambda depends on S3. Terraform will create S3 first, get its ARN, then pass that ARN to the Lambda module."

### Understanding resource naming

Resources follow the pattern: `{project}-{environment}-{purpose}`

Examples:
- `deliverycommand-dev-api-handler` (Lambda function)
- `deliverycommand-dev-main` (DynamoDB table)
- `deliverycommand-dev-documents-abc12345` (S3 bucket, with random suffix for uniqueness)

### Application code locations

```
src/lambdas/api-handler/lambda_function.py    # Main API logic
src/lambdas/jwt-authorizer/lambda_function.py # Token validation
src/lambdas/email-reminder/lambda_function.py # Scheduled emails
frontend/src/App.jsx                          # React application root
frontend/src/services/api.js                  # API client
scripts/build-lambdas.sh                      # Build deployment packages
```

### What to do next

If you're learning, try these exercises:

1. **Read the DynamoDB module** (`modules/dynamodb/main.tf`) -- it's the simplest module (one resource, a few config blocks).

2. **Trace the VPC module** (`modules/vpc/main.tf`) -- follow how subnets, route tables, and gateways connect. Draw the network diagram yourself.

3. **Compare dev.tfvars and staging.tfvars** -- understand why staging has stricter settings.

4. **Read the API Gateway module** (`modules/api-gateway/main.tf`) -- it's the largest module and shows how REST APIs, methods, integrations, and CORS all fit together.

5. **Run `terraform plan -var-file=dev.tfvars`** in the dev environment (after `terraform init`) -- read the output to see what Terraform would create. This is the best way to understand what the configuration actually produces.

---

## 9. CI/CD Pipeline (GitHub Actions)

### 9.1 What is CI/CD?

**CI** stands for **Continuous Integration**. Every time someone pushes code or opens a Pull Request, automated checks run to catch problems early. Think of it as a robot reviewer that checks your work before a human does.

**CD** stands for **Continuous Delivery** (or Deployment). After the checks pass and code is merged, the system automatically deploys the changes. In our case, we do CI but *not* automatic CD for Terraform -- you still run `terraform apply` manually. This is a safety choice because Terraform changes affect real infrastructure.

### 9.2 Our Pipeline

The pipeline lives in `.github/workflows/terraform.yml`. Here's what runs when you open a Pull Request:

```
PR Opened / Code Pushed
         |
    +----+----+
    |         |
    v         v
  Format    Lint          Security Scan
  Check     (TFLint)      (Checkov)
    |         |                |
    v         |                |
  Plan:       |                |
   Dev        |                |
    |         |                |
    v         v                v
  Comment plan              Report findings
  on the PR                 (soft fail)
```

**Job 1: Format Check** (`terraform fmt -check -recursive`)
Checks that all `.tf` files are consistently formatted. Terraform has an opinionated formatter (like Python's `black` or JavaScript's `prettier`). If files aren't formatted, the check fails. Fix it locally with:
```bash
terraform fmt -recursive terraform/
```

**Job 2: TFLint** (Terraform Linter)
A linter catches mistakes that `terraform validate` misses. For example:
- You reference an AWS instance type that doesn't exist (`t2.nonexistent`)
- You use a deprecated AWS feature
- Your variable naming isn't consistent
- You declare variables that are never used

TFLint uses a configuration file at `terraform/.tflint.hcl` that enables the AWS plugin and sets rules.

**Job 3: Checkov** (Security Scanner)
Checkov scans your Terraform code for security misconfigurations *before* you deploy them. For example:
- S3 bucket without encryption? Checkov flags it.
- DynamoDB table without point-in-time recovery? Checkov flags it.
- Security group open to `0.0.0.0/0`? Checkov flags it.

It runs in "soft fail" mode, meaning it reports findings but doesn't block the pipeline. You review the findings and fix what matters. Some findings don't apply to every project (like cross-region S3 replication for a dev environment).

**Job 4: Terraform Plan for Dev**
This is the most important job. It runs:
1. `terraform init` -- downloads providers and configures the backend
2. `terraform validate` -- checks syntax and configuration validity
3. `terraform plan -var-file=dev.tfvars` -- shows exactly what would change in AWS

The plan output is automatically posted as a comment on your Pull Request, so reviewers can see what infrastructure changes the code would cause.

**Job 5: Validate Prod**
Runs `terraform validate` against the prod configuration (without AWS credentials, since we're not deploying prod). This catches syntax errors in prod files.

### 9.3 Why Not Auto-Apply?

Many production teams do auto-apply on merge. We deliberately don't because:
1. This is a personal AWS account -- an accidental bad merge could create expensive resources
2. Terraform changes can be destructive (e.g., replacing a database loses all data)
3. It's safer to review the plan output and run `apply` manually

### 9.4 How the Pipeline Uses Secrets

The pipeline needs AWS credentials to run `terraform plan`. These are stored as **GitHub Secrets** (not in the code):
- `AWS_ACCESS_KEY_ID` -- identifies which AWS account to use
- `AWS_SECRET_ACCESS_KEY` -- authenticates the request

You set these in GitHub: Repository Settings > Secrets and variables > Actions.

### 9.5 The Concurrency Setting

```yaml
concurrency:
  group: terraform-${{ github.ref }}
  cancel-in-progress: true
```

This means: if you push new commits to a PR while a pipeline is still running, it cancels the old run and starts a new one. This saves GitHub Actions minutes and avoids confusing outdated plan output.

---

## 10. The Production Environment

### 10.1 Why Production is Different

The prod environment (`terraform/environments/prod/`) is a complete mirror of staging, but with stricter settings. Here's a comparison:

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| VPC CIDR | 10.0.0.0/16 | 10.1.0.0/16 | 10.2.0.0/16 |
| NAT Gateway | Off (saves $32/mo) | Off | On |
| VPC Flow Logs | Off | On | On |
| DynamoDB PITR | Off | On | On |
| Deletion Protection | Off | On | On |
| S3 Lifecycle Policy | Off | On | On |
| Document Retention | 365 days | 365 days | 730 days (2 years) |
| Log Retention | 14 days | 30 days | 90 days |
| CloudTrail Data Events | Off | Off | On |
| CloudTrail Retention | 90 days | 90 days | 365 days |
| CloudTrail Multi-Region | No | No | Yes |
| CloudTrail Insights | No | No | Yes |
| API Throttle Rate | 100/sec | 100/sec | 50/sec |
| API Throttle Burst | 200 | 200 | 100 |
| Unauthorized API Threshold | 20 | 20 | 10 |

### 10.2 Why Separate VPC CIDRs?

Each environment uses a different IP address range:
- Dev: `10.0.0.0/16`
- Staging: `10.1.0.0/16`
- Prod: `10.2.0.0/16`

This is important because if you ever need to connect environments together (VPC peering), their IP ranges can't overlap. Planning this upfront avoids painful IP address changes later.

### 10.3 Production Security Extras

**Multi-region CloudTrail**: Dev only logs API calls in eu-west-1. Prod logs calls in *all* AWS regions. If someone creates resources in us-east-1 (accidentally or maliciously), you'll see it.

**CloudTrail Insights**: Uses machine learning to detect unusual API activity patterns. For example, if someone suddenly makes 1000 IAM API calls when the baseline is 5, it triggers an alert.

**Data Events**: Logs individual S3 object reads and Lambda invocations. More expensive but gives a complete audit trail for compliance.

**Tighter API Throttling**: Prod limits to 50 requests/second (vs 100 in dev). This is more protective against abuse because prod is internet-facing.

### 10.4 The Terraform Backend

Prod currently uses a `local` backend (state stored on your machine). When you're ready to deploy prod:

1. Uncomment the S3 backend in `terraform/environments/prod/terraform.tf`
2. Comment out the local backend
3. Run `terraform init -migrate-state` to move the state to S3

This is documented in the file with clear instructions.

---

## 11. DynamoDB Access Patterns: Query vs Scan

### 11.1 The Problem with Scan

The original API handler used `table.scan()` to list actions and projects. A scan reads **every single item** in the table, then filters out what you don't want. Imagine a bookshelf analogy:

**Scan** = Read every book on every shelf to find the ones about cooking.
**Query** = Go directly to the "Cooking" section and read only those books.

For 100 items, scan is fine. For 100,000 items, scan is slow and expensive. DynamoDB charges per read capacity unit consumed, so scanning a large table costs real money.

### 11.2 How We Use the Global Secondary Index (GSI1)

Our DynamoDB table has a Global Secondary Index with keys `GSI1PK` and `GSI1SK`. We populate these when creating items to enable efficient queries:

```
Main Table:
+-------------------+----------+----------+---------------------------+
| PK                | SK       | GSI1PK   | GSI1SK                    |
+-------------------+----------+----------+---------------------------+
| ACTION#ACT-001    | METADATA | ACTIONS  | 2025-03-15T10:00:00#001   |
| ACTION#ACT-002    | METADATA | ACTIONS  | 2025-03-16T09:00:00#002   |
| PROJECT#PRJ-001   | METADATA | PROJECTS | 2025-03-10T08:00:00#001   |
| SUGGESTION#SUG-01 | METADATA | SUGGESTIONS#PENDING | 2025-03-15... |
| DOCUMENT#DOC-001  | METADATA | DOCUMENTS| 2025-03-15T10:30:00#001   |
+-------------------+----------+----------+---------------------------+
```

Now to get all actions, we query the GSI1 where `GSI1PK = "ACTIONS"`. DynamoDB jumps straight to matching items. The `GSI1SK` contains the timestamp, so results come back sorted by creation date.

### 11.3 Pagination

When you have many items, you don't want to return them all at once. Our API supports pagination:

```
GET /api/v1/actions?pageSize=10
  -> Returns first 10 actions + a nextToken

GET /api/v1/actions?pageSize=10&nextToken=abc123
  -> Returns the next 10 actions
```

The `nextToken` is a base64-encoded DynamoDB `LastEvaluatedKey`. The frontend passes it back to get the next page. This is DynamoDB's native pagination mechanism -- it tells you "I stopped here, pass this back to continue."

### 11.4 Backward Compatibility

Old items in DynamoDB (created before we added GSI keys) don't have `GSI1PK` and `GSI1SK` values, so they won't appear in GSI queries. The API handler handles this with a fallback:

1. First, try a Query on GSI1 (fast, indexed)
2. If that returns nothing, fall back to a Scan (slower, but finds old data)

This means existing data still works. New items created through the API will always have GSI keys and will be found via the fast Query path.

### 11.5 CORS Origin Handling

The original code returned `Access-Control-Allow-Origin: *` on every response. This tells browsers "any website can call this API", which is a security risk -- a malicious site could make API calls using a logged-in user's session.

The improved handler reads `ALLOWED_ORIGINS` from an environment variable (set by Terraform) and only allows requests from your actual domains:

```python
# Terraform sets this env var:
# ALLOWED_ORIGINS = "http://localhost:3000,https://actions-dev.engsnayl.com"

def get_cors_origin(event):
    request_origin = event['headers'].get('Origin', '')
    allowed = ALLOWED_ORIGINS.split(',')
    if request_origin in allowed:
        return request_origin  # "Yes, you're allowed"
    return allowed[0]          # Safe default
```

### 11.6 Input Validation

The API now validates incoming data before writing to DynamoDB:

- **Required fields**: Creating an action requires a `title`. Creating a project requires a `name`. Missing fields return `400 Bad Request` with a clear error message.
- **Status validation**: The status update endpoint only accepts valid values (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`). Invalid values return `400 Bad Request`.
- **Conditional writes**: The status update uses `ConditionExpression='attribute_exists(PK)'` to confirm the item exists before updating. If it doesn't exist, you get a `404 Not Found` instead of silently creating a phantom item.

---

## 12. Exercises and Next Steps

If you're learning, try these exercises in order:

### Beginner

1. **Read the DynamoDB module** (`modules/dynamodb/main.tf`) -- it's the simplest module (one resource, a few config blocks).

2. **Compare dev.tfvars, staging.tfvars, and prod.tfvars** -- understand why each environment has different settings and what trade-offs are being made (cost vs security).

3. **Read the CI/CD pipeline** (`.github/workflows/terraform.yml`) -- each job has comments explaining what it does.

### Intermediate

4. **Trace the VPC module** (`modules/vpc/main.tf`) -- follow how subnets, route tables, and gateways connect. Draw the network diagram yourself.

5. **Read the API handler** (`src/lambdas/api-handler/lambda_function.py`) -- trace how a `POST /api/v1/actions` request flows through the code, from the router to the DynamoDB write.

6. **Run `terraform plan -var-file=dev.tfvars`** in the dev environment -- read the output to understand what the configuration actually produces.

### Advanced

7. **Read the API Gateway module** (`modules/api-gateway/main.tf`) -- it's the largest module and shows how REST APIs, methods, integrations, authorizers, and CORS all fit together.

8. **Study the IAM role split** in `modules/lambda/main.tf` -- understand why `moved` blocks exist and what would happen without them (Terraform would destroy and recreate the roles, potentially causing downtime).

9. **Open a Pull Request** on the `claude-fixes` branch and watch the CI pipeline run. Read the plan output comment that gets posted on the PR.
