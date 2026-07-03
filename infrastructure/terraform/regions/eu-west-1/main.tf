# ATTESTA — eu-west-1 (Ireland) — GDPR region
# Data residency enforcement: all EU user PII stays here.
# Compliance: GDPR, EU AI Act (2024), eIDAS 2.0

provider "aws" {
  region = "eu-west-1"
}

module "attesta_eu" {
  source = "../../modules/multi-region"

  region              = "eu-west-1"
  environment         = "production"
  data_residency_mode = "gdpr"

  # Larger instances for EU traffic
  eks_node_instance_type = "t3.xlarge"
}

# GDPR-specific: S3 bucket with data residency lock
resource "aws_s3_bucket" "eu_data" {
  bucket = "attesta-eu-west-1-user-data"
  tags   = { DataResidency = "gdpr", Compliance = "GDPR" }
}

resource "aws_s3_bucket_versioning" "eu_data" {
  bucket = aws_s3_bucket.eu_data.id
  versioning_configuration { status = "Enabled" }
}

# Cloudwatch log group with 365-day retention (GDPR audit)
resource "aws_cloudwatch_log_group" "attesta_eu" {
  name              = "/attesta/production/eu-west-1"
  retention_in_days = 365
  tags              = { Compliance = "GDPR" }
}
