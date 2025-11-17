# AWS Deployment Guide

This comprehensive guide walks you through deploying the Audio Branding Next.js application on AWS using S3, RDS, and EC2 in a scalable, production-ready architecture.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [S3 Bucket Configuration](#s3-bucket-configuration)
4. [RDS PostgreSQL Database Setup](#rds-postgresql-database-setup)
5. [ElastiCache Redis Setup](#elasticache-redis-setup)
6. [EC2 Instance Setup](#ec2-instance-setup)
7. [Security Groups Configuration](#security-groups-configuration)
8. [Application Deployment](#application-deployment)
9. [Worker Process Deployment](#worker-process-deployment)
10. [Application Load Balancer Setup](#application-load-balancer-setup)
11. [Auto Scaling Configuration](#auto-scaling-configuration)
12. [SSL/HTTPS with ACM](#sslhttps-with-acm)
13. [Domain Configuration](#domain-configuration)
14. [Monitoring and Logging](#monitoring-and-logging)
15. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
16. [Cost Optimization](#cost-optimization)
17. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **AWS Account** with appropriate permissions (AdministratorAccess recommended for initial setup)
- **AWS CLI** installed and configured (`aws configure`)
- **Domain name** registered (optional but recommended for production)
- **SSH key pair** for EC2 access
- **Node.js 20+** knowledge for application deployment
- **Basic understanding** of AWS services (EC2, RDS, S3, VPC, IAM)

---

## AWS Account Setup

### Step 1: Create IAM User for Application

1. **Navigate to IAM Console**
   - Go to https://console.aws.amazon.com/iam/
   - Click "Users" → "Create user"

2. **Create User**
   - Username: `audiobranding-app-user`
   - Select "Provide user access to the AWS Management Console" (optional)
   - Or select "Programmatic access" for API access

3. **Attach Policies**
   - Attach the following policies:
     - `AmazonS3FullAccess` (or create custom policy for specific bucket)
     - `AmazonEC2ReadOnlyAccess` (for monitoring)
     - `CloudWatchLogsFullAccess` (for logging)

4. **Create Custom S3 Policy** (Recommended for security)
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```

5. **Save Credentials**
   - Note the `Access Key ID` and `Secret Access Key`
   - Store securely (you'll use these in environment variables)

### Step 2: Create SSH Key Pair

1. **Navigate to EC2 Console**
   - Go to https://console.aws.amazon.com/ec2/
   - Click "Key Pairs" → "Create key pair"

2. **Create Key Pair**
   - Name: `audiobranding-ec2-key`
   - Key pair type: `RSA`
   - Private key file format: `.pem` (for Linux/Mac) or `.ppk` (for Windows/PuTTY)

3. **Download and Secure**
   - Download the key file
   - Set permissions: `chmod 400 audiobranding-ec2-key.pem`
   - Store securely (you'll need this to SSH into EC2 instances)

---

## S3 Bucket Configuration

### Step 1: Create S3 Bucket

1. **Navigate to S3 Console**
   - Go to https://console.aws.amazon.com/s3/
   - Click "Create bucket"

2. **Configure Bucket**
   - **Bucket name**: `audiobranding-files-prod` (must be globally unique)
   - **AWS Region**: Choose your preferred region (e.g., `us-east-1`)
   - **Object Ownership**: ACLs disabled (recommended)
   - **Block Public Access**: Keep all settings enabled (we'll use presigned URLs)

3. **Versioning** (Optional but recommended)
   - Enable versioning for backup/recovery

4. **Encryption**
   - Enable "Server-side encryption"
   - Choose "AWS managed keys (SSE-S3)" or "AWS KMS" for better security

5. **Create Bucket**

### Step 2: Configure CORS (if needed for direct uploads)

1. **Go to Bucket → Permissions → CORS**
2. **Add CORS Configuration**:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedOrigins": ["https://yourdomain.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

### Step 3: Configure Lifecycle Policies (Optional)

1. **Go to Bucket → Management → Lifecycle rules**
2. **Create Rule**:
   - Name: `archive-old-files`
   - Apply to: All objects
   - Actions:
     - Transition to Glacier after 90 days
     - Delete after 365 days

---

## RDS PostgreSQL Database Setup

### Step 1: Create DB Subnet Group

1. **Navigate to RDS Console**
   - Go to https://console.aws.amazon.com/rds/
   - Click "Subnet groups" → "Create DB subnet group"

2. **Configure Subnet Group**
   - Name: `audiobranding-db-subnet-group`
   - Description: "Subnet group for Audio Branding database"
   - VPC: Select your VPC (or create default VPC)
   - Availability Zones: Select at least 2 zones
   - Subnets: Select subnets in different AZs

### Step 2: Create RDS PostgreSQL Instance

1. **Navigate to RDS → Databases → Create database**

2. **Choose Configuration**
   - **Engine**: PostgreSQL
   - **Version**: 16.x (or latest stable)
   - **Templates**: Production (for production) or Dev/Test (for staging)

3. **Settings**
   - **DB instance identifier**: `audiobranding-db`
   - **Master username**: `audiobranding_admin` (or your choice)
   - **Master password**: Generate strong password (save securely)
   - **DB instance class**: 
     - Development: `db.t3.micro` (free tier eligible)
     - Production: `db.t3.medium` or `db.t3.large` (start small, scale up)

4. **Storage**
   - **Storage type**: General Purpose SSD (gp3)
   - **Allocated storage**: 20 GB (minimum, can auto-scale)
   - **Storage autoscaling**: Enable (recommended)
   - **Maximum storage threshold**: 100 GB

5. **Connectivity**
   - **VPC**: Select your VPC
   - **Subnet group**: `audiobranding-db-subnet-group` (created above)
   - **Public access**: No (recommended for security)
   - **VPC security group**: Create new → `audiobranding-db-sg`
   - **Availability Zone**: No preference (let AWS choose)

6. **Database Authentication**
   - **Password authentication**: Selected

7. **Additional Configuration**
   - **Initial database name**: `audiobranding`
   - **Backup retention period**: 7 days (production) or 1 day (dev)
   - **Backup window**: Choose low-traffic time
   - **Enable encryption**: Yes (recommended)
   - **Performance Insights**: Enable (for monitoring)
   - **Enhanced monitoring**: Optional

8. **Create Database**
   - Note the endpoint (e.g., `audiobranding-db.xxxxx.us-east-1.rds.amazonaws.com`)
   - Note the port (default: 5432)

### Step 3: Configure Database Security Group

1. **Go to EC2 → Security Groups**
2. **Find `audiobranding-db-sg`**
3. **Edit Inbound Rules**:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Select the security group for your EC2 instances (we'll create this next)
   - Description: "Allow PostgreSQL from EC2 instances"

---

## ElastiCache Redis Setup

### Step 1: Create ElastiCache Subnet Group

1. **Navigate to ElastiCache Console**
   - Go to https://console.aws.amazon.com/elasticache/
   - Click "Subnet groups" → "Create subnet group"

2. **Configure Subnet Group**
   - Name: `audiobranding-redis-subnet-group`
   - Description: "Subnet group for Audio Branding Redis"
   - VPC: Same VPC as RDS
   - Subnets: Select subnets in different AZs

### Step 2: Create ElastiCache Redis Cluster

1. **Navigate to ElastiCache → Redis clusters → Create**

2. **Configure Cluster**
   - **Cluster name**: `audiobranding-redis`
   - **Description**: "Redis for Audio Branding job queue"
   - **Engine**: Redis
   - **Version**: 7.x (latest stable)

3. **Node Configuration**
   - **Node type**: 
     - Development: `cache.t3.micro` (free tier eligible)
     - Production: `cache.t3.small` or `cache.t3.medium`
   - **Number of replicas**: 0 (for single node) or 1-2 (for high availability)

4. **Network Settings**
   - **VPC**: Same VPC as RDS
   - **Subnet group**: `audiobranding-redis-subnet-group`
   - **Availability zones**: No preference
   - **Security groups**: Create new → `audiobranding-redis-sg`

5. **Additional Settings**
   - **Parameter group**: default.redis7
   - **Backup**: Enable (recommended)
   - **Encryption**: Enable in-transit encryption (recommended)
   - **Encryption at rest**: Optional but recommended

6. **Create Cluster**
   - Note the endpoint (e.g., `audiobranding-redis.xxxxx.cache.amazonaws.com:6379`)

### Step 3: Configure Redis Security Group

1. **Go to EC2 → Security Groups**
2. **Find `audiobranding-redis-sg`**
3. **Edit Inbound Rules**:
   - Type: Custom TCP
   - Port: 6379
   - Source: Select the security group for your EC2 instances
   - Description: "Allow Redis from EC2 instances"

---

## EC2 Instance Setup

### Step 1: Create Launch Template (Recommended for Auto Scaling)

1. **Navigate to EC2 → Launch Templates → Create launch template**

2. **Template Details**
   - **Name**: `audiobranding-app-template`
   - **Description**: "Launch template for Audio Branding application"

3. **AMI**
   - **AMI**: Amazon Linux 2023 (or Ubuntu 22.04 LTS)
   - Choose latest stable version

4. **Instance Type**
   - **Instance type**: `t3.medium` (2 vCPU, 4 GB RAM) for production
   - For development: `t3.micro` or `t3.small`

5. **Key Pair**
   - Select: `audiobranding-ec2-key` (created earlier)

6. **Network Settings**
   - **VPC**: Same VPC as RDS/Redis
   - **Subnet**: Select public subnet (for initial setup) or private (for production)
   - **Auto-assign public IP**: Enable (for public subnet) or Disable (for private with NAT)
   - **Security group**: Create new → `audiobranding-app-sg`

7. **Storage**
   - **Volume 1**: 20 GB gp3 (root volume)
   - Add additional volumes if needed

8. **Advanced Details** (User Data Script)
   ```bash
   #!/bin/bash
   # Update system
   yum update -y
   
   # Install Node.js 20
   curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
   yum install -y nodejs
   
   # Install Git
   yum install -y git
   
   # Install PM2 for process management
   npm install -g pm2
   
   # Create application directory
   mkdir -p /opt/audiobranding
   chown ec2-user:ec2-user /opt/audiobranding
   ```

9. **Create Launch Template**

### Step 2: Create EC2 Instance (Initial Setup)

1. **Navigate to EC2 → Instances → Launch instance**

2. **Use Launch Template** (or configure manually)
   - Select: `audiobranding-app-template`
   - Or configure manually using the same settings

3. **Launch Instance**
   - Name: `audiobranding-app-1`
   - Launch

4. **Wait for Instance to be Running**
   - Note the Public IP or Private IP

### Step 3: Configure Application Security Group

1. **Go to EC2 → Security Groups → `audiobranding-app-sg`**

2. **Edit Inbound Rules**:
   ```
   Type: SSH
   Port: 22
   Source: Your IP address (for initial setup)
   
   Type: HTTP
   Port: 80
   Source: 0.0.0.0/0 (or ALB security group)
   
   Type: HTTPS
   Port: 443
   Source: 0.0.0.0/0 (or ALB security group)
   ```

3. **Edit Outbound Rules**:
   - Allow all outbound traffic (default)

---

## Security Groups Configuration

### Summary of Security Groups

Create and configure the following security groups:

1. **`audiobranding-app-sg`** (Application)
   - Inbound: SSH (22) from your IP, HTTP (80), HTTPS (443)
   - Outbound: All traffic

2. **`audiobranding-db-sg`** (Database)
   - Inbound: PostgreSQL (5432) from `audiobranding-app-sg`
   - Outbound: None needed

3. **`audiobranding-redis-sg`** (Redis)
   - Inbound: Redis (6379) from `audiobranding-app-sg`
   - Outbound: None needed

4. **`audiobranding-alb-sg`** (Load Balancer - created later)
   - Inbound: HTTP (80), HTTPS (443) from 0.0.0.0/0
   - Outbound: All traffic

---

## Application Deployment

### Step 1: SSH into EC2 Instance

```bash
ssh -i audiobranding-ec2-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### Step 2: Install Dependencies and Setup

```bash
# Navigate to application directory
cd /opt/audiobranding

# Clone your repository (or upload code)
git clone <your-repository-url> .
# OR use SCP to upload files:
# scp -i audiobranding-ec2-key.pem -r . ec2-user@<EC2_IP>:/opt/audiobranding

# Install dependencies
npm ci --production

# Generate Prisma Client
npm run db:generate
```

### Step 3: Configure Environment Variables

Create `/opt/audiobranding/.env`:

```bash
# Database
DATABASE_URL="postgresql://audiobranding_admin:YOUR_PASSWORD@audiobranding-db.xxxxx.us-east-1.rds.amazonaws.com:5432/audiobranding"

# Redis
REDIS_URL="redis://audiobranding-redis.xxxxx.cache.amazonaws.com:6379"

# AWS S3
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
S3_BUCKET_NAME="audiobranding-files-prod"
# Remove S3_ENDPOINT and S3_FORCE_PATH_STYLE for production

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/callback"

# Session & JWT
SESSION_SECRET="generate-strong-random-secret-min-32-chars"
JWT_SECRET="generate-strong-random-secret-min-32-chars"

# External APIs
PERPLEXITY_API_KEY="your-perplexity-api-key"
ELEVENLABS_API_KEY="your-elevenlabs-api-key"
REPLICATE_API_TOKEN="your-replicate-api-token"

# Application
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
PORT=3000
```

**Security Note**: For production, use AWS Systems Manager Parameter Store or Secrets Manager:

```bash
# Install AWS CLI if not already installed
aws ssm put-parameter --name "/audiobranding/DATABASE_URL" --value "postgresql://..." --type "SecureString"
aws ssm put-parameter --name "/audiobranding/SESSION_SECRET" --value "..." --type "SecureString"
# ... etc
```

Then load in your application using AWS SDK.

### Step 4: Run Database Migrations

```bash
# Run migrations
npm run db:migrate:deploy

# Verify connection
npm run db:studio  # Optional: for database inspection
```

### Step 5: Build Application

```bash
# Build Next.js application
npm run build
```

### Step 6: Create PM2 Ecosystem File

Create `/opt/audiobranding/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'audiobranding-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/opt/audiobranding',
      instances: 1, // Scale horizontally with load balancer
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/audiobranding/app-error.log',
      out_file: '/var/log/audiobranding/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
    {
      name: 'audiobranding-worker',
      script: 'npm',
      args: 'run worker',
      cwd: '/opt/audiobranding',
      instances: 2, // Run 2 worker processes
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/audiobranding/worker-error.log',
      out_file: '/var/log/audiobranding/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
```

### Step 7: Create Log Directory

```bash
sudo mkdir -p /var/log/audiobranding
sudo chown ec2-user:ec2-user /var/log/audiobranding
```

### Step 8: Start Application with PM2

```bash
# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown (usually involves running a sudo command)
```

### Step 9: Verify Application is Running

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs audiobranding-app
pm2 logs audiobranding-worker

# Test application
curl http://localhost:3000/api/health
```

---

## Worker Process Deployment

The worker is already configured in the PM2 ecosystem file above. If you need to deploy workers separately:

### Option 1: Separate EC2 Instance for Workers

1. **Create Worker Launch Template**
   - Similar to app template but:
     - Instance type: `t3.small` or `t3.medium` (can be smaller than app)
     - User data: Same as app template

2. **Deploy Worker on Separate Instance**
   - Follow same deployment steps
   - Only run worker process: `pm2 start ecosystem.config.js --only audiobranding-worker`

### Option 2: Auto Scaling Group for Workers

1. **Create Auto Scaling Group**
   - Use worker launch template
   - Desired capacity: 2
   - Min: 1, Max: 5
   - Target tracking: CPU utilization at 70%

---

## Application Load Balancer Setup

### Step 1: Create Application Load Balancer

1. **Navigate to EC2 → Load Balancers → Create Load Balancer**

2. **Choose Load Balancer Type**
   - **Application Load Balancer** (recommended)

3. **Configure Load Balancer**
   - **Name**: `audiobranding-alb`
   - **Scheme**: Internet-facing
   - **IP address type**: IPv4

4. **Network Mapping**
   - **VPC**: Same VPC as EC2 instances
   - **Mappings**: Select at least 2 availability zones
   - **Subnets**: Select public subnets in each AZ

5. **Security Groups**
   - **Security group**: `audiobranding-alb-sg` (create new)
   - Inbound: HTTP (80), HTTPS (443) from 0.0.0.0/0

6. **Listeners and Routing**
   - **Listener 1**: HTTP (80) → Redirect to HTTPS (443)
   - **Listener 2**: HTTPS (443) → Forward to target group

7. **Create Target Group** (if not exists)
   - **Name**: `audiobranding-targets`
   - **Target type**: Instances
   - **Protocol**: HTTP
   - **Port**: 3000
   - **Health check path**: `/api/health`
   - **Health check protocol**: HTTP
   - **Advanced health check settings**:
     - Healthy threshold: 2
     - Unhealthy threshold: 3
     - Timeout: 5 seconds
     - Interval: 30 seconds

8. **Register Targets**
   - Select your EC2 instances
   - Register

9. **Create Load Balancer**

### Step 2: Configure Target Group

1. **Go to Target Groups → `audiobranding-targets`**

2. **Health Checks**
   - Path: `/api/health`
   - Protocol: HTTP
   - Port: 3000
   - Healthy threshold: 2
   - Unhealthy threshold: 3

3. **Attributes**
   - **Deregistration delay**: 30 seconds
   - **Stickiness**: Enable (optional, for session affinity)

---

## Auto Scaling Configuration

### Step 1: Create Auto Scaling Group

1. **Navigate to EC2 → Auto Scaling Groups → Create Auto Scaling Group**

2. **Choose Launch Template**
   - **Launch template**: `audiobranding-app-template`
   - **Version**: Latest

3. **Configure Group**
   - **Name**: `audiobranding-asg`
   - **VPC**: Same VPC as instances
   - **Subnets**: Select private subnets in multiple AZs

4. **Configure Load Balancer**
   - **Attach to load balancer**: Yes
   - **Target group**: `audiobranding-targets`
   - **Health check type**: ELB

5. **Configure Group Size**
   - **Desired capacity**: 2
   - **Minimum capacity**: 2
   - **Maximum capacity**: 10

6. **Scaling Policies**
   - **Target tracking scaling policy**:
     - Metric: Average CPU utilization
     - Target value: 70%
   - **Add another policy**:
     - Metric: ALB RequestCountPerTarget
     - Target value: 1000 requests per target

7. **Create Auto Scaling Group**

### Step 2: Configure Health Checks

- **Health check grace period**: 300 seconds
- **Health check type**: ELB (uses load balancer health checks)

---

## SSL/HTTPS with ACM

### Step 1: Request SSL Certificate

1. **Navigate to ACM Console**
   - Go to https://console.aws.amazon.com/acm/
   - Click "Request certificate"

2. **Request Public Certificate**
   - **Domain name**: `yourdomain.com`
   - **Additional names**: `*.yourdomain.com` (for subdomains)

3. **Validation Method**
   - **DNS validation** (recommended) or Email validation
   - Follow instructions to add DNS records

4. **Request Certificate**
   - Wait for validation (can take a few minutes to hours)

### Step 2: Attach Certificate to Load Balancer

1. **Go to Load Balancer → Listeners → Edit HTTPS Listener**

2. **Select Certificate**
   - Choose your ACM certificate
   - Security policy: ELBSecurityPolicy-TLS-1-2-2017-01

3. **Save**

---

## Domain Configuration

### Step 1: Configure Route 53 (if using AWS DNS)

1. **Navigate to Route 53 → Hosted Zones**

2. **Create Hosted Zone** (if not exists)
   - Domain name: `yourdomain.com`

3. **Create A Record (Alias)**
   - **Name**: `@` (root domain) or `app` (subdomain)
   - **Type**: A - IPv4 address
   - **Alias**: Yes
   - **Alias target**: Your Application Load Balancer
   - **Routing policy**: Simple routing

4. **Update Nameservers**
   - Copy nameservers from Route 53
   - Update at your domain registrar

### Step 2: Update Google OAuth Redirect URI

1. **Go to Google Cloud Console → APIs & Services → Credentials**

2. **Edit OAuth 2.0 Client**
   - Add authorized redirect URI: `https://yourdomain.com/api/auth/callback`

3. **Update Environment Variable**
   - Update `GOOGLE_REDIRECT_URI` in EC2 instance `.env`

4. **Restart Application**
   ```bash
   pm2 restart all
   ```

---

## Monitoring and Logging

### Step 1: CloudWatch Logs

1. **Create Log Groups**
   ```bash
   aws logs create-log-group --log-group-name /audiobranding/app
   aws logs create-log-group --log-group-name /audiobranding/worker
   ```

2. **Install CloudWatch Agent** (on EC2)
   ```bash
   wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
   sudo rpm -U ./amazon-cloudwatch-agent.rpm
   ```

3. **Configure CloudWatch Agent**
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
   ```
   - Select: "On-premises"
   - Log files: `/var/log/audiobranding/*.log`
   - Log group: `/audiobranding/app` and `/audiobranding/worker`

### Step 2: CloudWatch Alarms

Create alarms for:

1. **High CPU Utilization**
   - Metric: CPUUtilization
   - Threshold: > 80%
   - Action: Send SNS notification

2. **High Memory Usage**
   - Metric: MemoryUtilization
   - Threshold: > 85%

3. **Database Connection Errors**
   - Metric: DatabaseConnections
   - Threshold: > 80% of max connections

4. **Application Errors**
   - Metric: Custom (from application logs)
   - Threshold: Error rate > 5%

### Step 3: Application Monitoring

1. **Enable Application Insights** (if using AWS X-Ray)
2. **Set up custom metrics** for:
   - API response times
   - Job queue length
   - Active users
   - Error rates

---

## Backup and Disaster Recovery

### Step 1: Database Backups

1. **RDS Automated Backups**
   - Already enabled (configured during RDS setup)
   - Retention: 7 days (production)
   - Backup window: Low-traffic hours

2. **Manual Snapshots**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier audiobranding-db \
     --db-snapshot-identifier audiobranding-db-manual-$(date +%Y%m%d)
   ```

3. **Cross-Region Snapshots** (for disaster recovery)
   - Copy snapshots to another region periodically

### Step 2: S3 Backups

1. **Enable Versioning** (already configured)
2. **Lifecycle Policies** (already configured)
3. **Cross-Region Replication** (optional)
   - Enable replication to another region

### Step 3: Application Code Backups

1. **Use Git Repository** (already in use)
2. **Tag Releases**
   ```bash
   git tag -a v1.0.0 -m "Production release"
   git push origin v1.0.0
   ```

### Step 4: Disaster Recovery Plan

1. **Document Recovery Procedures**
   - Database restore from snapshot
   - Application redeployment
   - DNS failover procedures

2. **Test Recovery** (quarterly)
   - Restore database in test environment
   - Verify application functionality

---

## Cost Optimization

### Step 1: Right-Sizing

1. **Monitor Resource Usage**
   - Use CloudWatch to identify underutilized resources
   - Downsize if consistently below 30% utilization

2. **Reserved Instances**
   - Purchase RIs for predictable workloads (1-3 year terms)
   - Can save up to 75% vs on-demand

### Step 2: Auto Scaling

1. **Scale Down During Off-Hours**
   - Use scheduled scaling actions
   - Reduce capacity during nights/weekends

2. **Spot Instances** (for non-critical workloads)
   - Use Spot Instances for worker processes
   - Can save up to 90% vs on-demand

### Step 3: Storage Optimization

1. **S3 Lifecycle Policies**
   - Move old files to Glacier
   - Delete files after retention period

2. **Database Storage**
   - Enable storage autoscaling
   - Monitor and optimize unused space

### Step 4: Cost Monitoring

1. **AWS Cost Explorer**
   - Set up cost budgets
   - Create alerts for unexpected charges

2. **Tag Resources**
   - Tag all resources for cost allocation
   - Use tags: Environment, Project, Owner

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check PM2 logs
pm2 logs audiobranding-app --lines 100

# Check environment variables
pm2 env 0

# Verify database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis connection
redis-cli -h <redis-endpoint> ping
```

#### 2. Database Connection Errors

- **Check Security Groups**: Ensure EC2 security group can access RDS security group
- **Check VPC**: Ensure EC2 and RDS are in same VPC
- **Check Endpoint**: Verify DATABASE_URL is correct
- **Check Credentials**: Verify username/password

#### 3. Redis Connection Errors

- **Check Security Groups**: Ensure EC2 security group can access Redis security group
- **Check Endpoint**: Verify REDIS_URL is correct
- **Check Encryption**: If using encryption, ensure TLS is configured

#### 4. S3 Upload Failures

- **Check IAM Permissions**: Verify IAM user has S3 permissions
- **Check Bucket Policy**: Verify bucket allows access
- **Check Credentials**: Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

#### 5. High CPU/Memory Usage

```bash
# Check system resources
htop

# Check PM2 processes
pm2 monit

# Scale horizontally
# Increase Auto Scaling Group desired capacity
```

#### 6. Worker Jobs Not Processing

```bash
# Check worker logs
pm2 logs audiobranding-worker --lines 100

# Check Redis connection
redis-cli -h <redis-endpoint> ping

# Check queue status (if using BullMQ dashboard)
# Access BullMQ dashboard if configured
```

### Debugging Commands

```bash
# View application logs
pm2 logs audiobranding-app --lines 50

# View worker logs
pm2 logs audiobranding-worker --lines 50

# Restart application
pm2 restart audiobranding-app

# Restart all
pm2 restart all

# Check system resources
free -h
df -h
top

# Check network connectivity
curl http://localhost:3000/api/health
telnet <rds-endpoint> 5432
telnet <redis-endpoint> 6379
```

---

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review CloudWatch alarms
   - Check application logs for errors
   - Monitor costs

2. **Monthly**
   - Review and update dependencies
   - Check security patches
   - Review and optimize database queries
   - Review auto-scaling metrics

3. **Quarterly**
   - Test disaster recovery procedures
   - Review and update documentation
   - Security audit
   - Cost optimization review

### Updates and Deployments

1. **Deploy New Version**
   ```bash
   # SSH into instance
   ssh -i key.pem ec2-user@<instance-ip>
   
   # Pull latest code
   cd /opt/audiobranding
   git pull origin main
   
   # Install dependencies
   npm ci --production
   
   # Run migrations (if any)
   npm run db:migrate:deploy
   
   # Generate Prisma client
   npm run db:generate
   
   # Build application
   npm run build
   
   # Restart with PM2
   pm2 restart all
   ```

2. **Rollback Procedure**
   ```bash
   # Revert to previous version
   git checkout <previous-tag>
   npm ci --production
   npm run db:generate
   npm run build
   pm2 restart all
   ```

---

## Security Best Practices

1. **Use IAM Roles** instead of access keys when possible
2. **Enable MFA** for AWS console access
3. **Use Secrets Manager** for sensitive data
4. **Enable VPC Flow Logs** for network monitoring
5. **Regular Security Audits** using AWS Security Hub
6. **Keep Dependencies Updated** (npm audit, npm update)
7. **Use WAF** (Web Application Firewall) on ALB
8. **Enable CloudTrail** for API logging
9. **Use Private Subnets** for EC2 instances (with NAT Gateway)
10. **Regular Backups** and test restore procedures

---

## Next Steps

After completing this deployment:

1. **Set up CI/CD Pipeline** (GitHub Actions, AWS CodePipeline)
2. **Implement Blue/Green Deployments** for zero-downtime updates
3. **Set up Multi-Region Deployment** for high availability
4. **Implement Caching Layer** (CloudFront, ElastiCache)
5. **Add Monitoring Dashboards** (CloudWatch Dashboards, Grafana)
6. **Set up Alerting** (SNS, PagerDuty integration)

---

## Support and Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Documentation**: https://www.prisma.io/docs
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/

---

**Last Updated**: 2024
**Version**: 1.0

