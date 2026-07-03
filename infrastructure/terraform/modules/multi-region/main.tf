# ATTESTA — Multi-region Infrastructure Stub
# Phase 12: eu-west-1 (GDPR) + ap-south-1 (India DPDP Act)
#
# This file declares the reusable module structure.
# Individual region configs: ../regions/us-east-1, ../regions/eu-west-1, ../regions/ap-south-1

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ─────────────────────────────────────────
# Variables
# ─────────────────────────────────────────

variable "region" {
  description = "AWS region for this deployment"
  type        = string
}

variable "environment" {
  description = "Deployment environment (production / staging)"
  type        = string
  default     = "production"
}

variable "data_residency_mode" {
  description = "Data residency enforcement level (gdpr / dpdp / standard)"
  type        = string
  default     = "standard"
}

variable "eks_node_instance_type" {
  description = "EKS node instance type"
  type        = string
  default     = "t3.xlarge"
}

# ─────────────────────────────────────────
# VPC
# ─────────────────────────────────────────

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "attesta-${var.environment}-${var.region}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"

  tags = {
    Environment        = var.environment
    DataResidency      = var.data_residency_mode
    ManagedBy          = "terraform"
  }
}

# ─────────────────────────────────────────
# EKS Cluster
# ─────────────────────────────────────────

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "attesta-${var.environment}-${var.region}"
  cluster_version = "1.29"

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnet_ids
  control_plane_subnet_ids = module.vpc.private_subnet_ids

  # Zero-trust: all nodes in private subnets; Istio handles mTLS
  cluster_endpoint_public_access  = false
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    main = {
      instance_types = [var.eks_node_instance_type]
      min_size       = 2
      max_size       = 10
      desired_size   = 3
    }
    gpu = {
      # AI eval nodes (CodeLlama, Llama 3.1)
      instance_types = ["g5.2xlarge"]
      min_size       = 0
      max_size       = 5
      desired_size   = 0
      taints = [{
        key    = "nvidia.com/gpu"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  tags = {
    Environment   = var.environment
    Region        = var.region
    ManagedBy     = "terraform"
  }
}

# ─────────────────────────────────────────
# RDS (PostgreSQL 16)
# ─────────────────────────────────────────

resource "aws_db_instance" "postgres" {
  identifier              = "attesta-${var.environment}-${var.region}"
  engine                  = "postgres"
  engine_version          = "16.2"
  instance_class          = "db.r7g.xlarge"
  allocated_storage       = 100
  max_allocated_storage   = 1000
  storage_encrypted       = true

  # GDPR / DPDP: data stays in this region
  availability_zone = "${var.region}a"

  multi_az                = var.environment == "production"
  deletion_protection     = var.environment == "production"
  backup_retention_period = var.environment == "production" ? 30 : 7

  # RPO <15min
  backup_window      = "03:00-04:00"
  maintenance_window = "Mon:04:00-Mon:05:00"

  tags = {
    Environment     = var.environment
    DataResidency   = var.data_residency_mode
    Compliance      = var.data_residency_mode == "gdpr" ? "GDPR" : (var.data_residency_mode == "dpdp" ? "DPDP" : "Standard")
  }
}

# ─────────────────────────────────────────
# ElastiCache (Redis 7)
# ─────────────────────────────────────────

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "attesta-${var.environment}-${substr(var.region, 0, 8)}"
  description          = "ATTESTA Redis — ${var.region}"

  engine_version = "7.1"
  node_type      = "cache.r7g.large"
  num_cache_clusters = var.environment == "production" ? 3 : 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = { Environment = var.environment }
}

# ─────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────

output "eks_cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "rds_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}
