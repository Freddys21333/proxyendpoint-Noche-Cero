variable "project_name" {
  type    = string
  default = "zombie-management"
}
variable "environment" {
  type    = string
  default = "staging"
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Usa staging o prod."
  }
}
variable "aws_region" {
  type    = string
  default = "us-east-2"
}
variable "backend_zip_path" { type = string }
variable "build_commit" { type = string }
variable "allowed_origins" {
  type    = list(string)
  default = []
}
variable "frontend_branch" {
  type    = string
  default = "staging"
}
variable "compare_reserved_concurrency" {
  type    = number
  default = 2
  validation {
    condition     = contains([-1, 1, 2], var.compare_reserved_concurrency)
    error_message = "Usa 1 o 2; -1 solo cuando la cuota impida reservar concurrencia."
  }
}
