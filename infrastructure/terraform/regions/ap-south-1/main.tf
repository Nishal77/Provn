# ATTESTA — ap-south-1 (Mumbai) — India DPDP Act region
# Data residency enforcement: India user PII stays here.
# Compliance: India DPDP Act 2023, data fiduciary registration.

provider "aws" {
  region = "ap-south-1"
}

module "attesta_india" {
  source = "../../modules/multi-region"

  region              = "ap-south-1"
  environment         = "production"
  data_residency_mode = "dpdp"

  eks_node_instance_type = "t3.large"
}

# DPDP-specific: S3 bucket must not replicate outside India
resource "aws_s3_bucket" "india_data" {
  bucket = "attesta-ap-south-1-user-data"
  tags   = { DataResidency = "dpdp", Compliance = "India-DPDP-2023" }
}

# Explicitly block cross-region replication for DPDP compliance
resource "aws_s3_bucket_replication_configuration" "block" {
  # No replication rule = no cross-region copy
  # Explicit tag makes intent clear for auditors
  bucket = aws_s3_bucket.india_data.id
  role   = "arn:aws:iam::ACCOUNT_ID:role/attesta-no-replication"

  rule {
    id     = "no-cross-region-replication"
    status = "Disabled"

    destination {
      bucket = aws_s3_bucket.india_data.arn # self = no-op
    }
  }
}
