variable "enable_aws_jobs" {
  type        = bool
  default     = false
  description = "Activa P-04 explícitamente; no inicia experimentos."
}
data "aws_caller_identity" "jobs" {
  count = var.enable_aws_jobs ? 1 : 0
}
locals {
  job_functions = var.enable_aws_jobs ? {
    api       = { handler = "api.aws_jobs.handler", memory = 1024, timeout = 28 }
    prepare   = { handler = "simulation.aws_jobs.prepare_handler", memory = 256, timeout = 30 }
    worker    = { handler = "simulation.aws_jobs.worker_handler", memory = 3008, timeout = 120 }
    aggregate = { handler = "simulation.aws_jobs.aggregate_handler", memory = 3008, timeout = 300 }
    failure   = { handler = "simulation.aws_jobs.failure_handler", memory = 256, timeout = 30 }
  } : {}
  job_routes = var.enable_aws_jobs ? {
    create = "POST /v1/jobs"
    status = "GET /v1/jobs/{jobId}"
    cancel = "POST /v1/jobs/{jobId}/cancel"
    result = "GET /v1/jobs/{jobId}/result"
  } : {}
}
resource "aws_s3_bucket" "jobs" {
  count         = var.enable_aws_jobs ? 1 : 0
  bucket_prefix = "${local.name}-jobs-"
  force_destroy = true # Artefactos educativos efímeros; destroy incluye su contenido.
}
resource "aws_s3_bucket_public_access_block" "jobs" {
  count                   = var.enable_aws_jobs ? 1 : 0
  bucket                  = aws_s3_bucket.jobs[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "jobs" {
  count  = var.enable_aws_jobs ? 1 : 0
  bucket = aws_s3_bucket.jobs[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_policy" "jobs" {
  count  = var.enable_aws_jobs ? 1 : 0
  bucket = aws_s3_bucket.jobs[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.jobs[0].arn, "${aws_s3_bucket.jobs[0].arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }] })
}
resource "aws_s3_bucket_lifecycle_configuration" "jobs" {
  count  = var.enable_aws_jobs ? 1 : 0
  bucket = aws_s3_bucket.jobs[0].id
  rule {
    id     = "expire-artifacts"
    status = "Enabled"
    filter { prefix = "jobs/" }
    expiration { days = 1 }
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }
}
resource "aws_s3_bucket_cors_configuration" "jobs" {
  count  = var.enable_aws_jobs ? 1 : 0
  bucket = aws_s3_bucket.jobs[0].id
  cors_rule {
    allowed_origins = concat(["https://${var.frontend_branch}.${aws_amplify_app.frontend.default_domain}"], var.allowed_origins)
    allowed_methods = ["GET"]
    allowed_headers = ["accept"]
    expose_headers  = ["content-length", "content-encoding"]
    max_age_seconds = 300
  }
}
resource "aws_dynamodb_table" "jobs" {
  count        = var.enable_aws_jobs ? 1 : 0
  name         = "${local.name}-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  attribute {
    name = "pk"
    type = "S"
  }
  ttl {
    attribute_name = "expires"
    enabled        = true
  }
}
resource "aws_cloudwatch_log_group" "jobs" {
  for_each          = local.job_functions
  name              = "/aws/lambda/${local.name}-jobs-${each.key}"
  retention_in_days = 7
}
resource "aws_iam_role" "jobs" {
  for_each           = local.job_functions
  name               = "${local.name}-jobs-${each.key}"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "lambda.amazonaws.com" } }] })
}
resource "aws_iam_role_policy" "jobs" {
  for_each = local.job_functions
  role     = aws_iam_role.jobs[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = concat([
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.jobs[each.key].arn}:*" },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"], Resource = aws_dynamodb_table.jobs[0].arn },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${aws_s3_bucket.jobs[0].arn}/jobs/*" }
    ], each.key == "api" ? [
    { Effect = "Allow", Action = ["states:StartExecution"], Resource = aws_sfn_state_machine.jobs[0].arn },
    { Effect = "Allow", Action = ["states:DescribeExecution", "states:StopExecution"], Resource = "${replace(aws_sfn_state_machine.jobs[0].arn, ":stateMachine:", ":execution:")}:*" }
  ] : []) })
}
resource "aws_lambda_function" "jobs" {
  for_each         = local.job_functions
  function_name    = "${local.name}-jobs-${each.key}"
  role             = aws_iam_role.jobs[each.key].arn
  runtime          = "python3.12"
  architectures    = ["x86_64"]
  handler          = each.value.handler
  memory_size      = each.value.memory
  timeout          = each.value.timeout
  filename         = var.backend_zip_path
  source_code_hash = filebase64sha256(var.backend_zip_path)
  environment {
    variables = merge({ BUILD_COMMIT = var.build_commit, JOBS_TABLE = aws_dynamodb_table.jobs[0].name, JOBS_BUCKET = aws_s3_bucket.jobs[0].id }, each.key == "api" ? { JOBS_STATE_MACHINE = "arn:aws:states:${var.aws_region}:${data.aws_caller_identity.jobs[0].account_id}:stateMachine:${local.name}-jobs" } : {})
  }
  depends_on = [aws_cloudwatch_log_group.jobs]
}
resource "aws_iam_role" "orchestrator" {
  count              = var.enable_aws_jobs ? 1 : 0
  name               = "${local.name}-orchestrator"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "states.amazonaws.com" } }] })
}
resource "aws_sfn_state_machine" "jobs" {
  count    = var.enable_aws_jobs ? 1 : 0
  name     = "${local.name}-jobs"
  role_arn = aws_iam_role.orchestrator[0].arn
  type     = "STANDARD"
  definition = templatefile("${path.module}/jobs.asl.json.tftpl", {
    prepare   = aws_lambda_function.jobs["prepare"].arn,
    worker    = aws_lambda_function.jobs["worker"].arn,
    aggregate = aws_lambda_function.jobs["aggregate"].arn,
    failure   = aws_lambda_function.jobs["failure"].arn
  })
}
resource "aws_iam_role_policy" "orchestrator" {
  count = var.enable_aws_jobs ? 1 : 0
  role  = aws_iam_role.orchestrator[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["lambda:InvokeFunction"], Resource = [for key in ["prepare", "worker", "aggregate", "failure"] : aws_lambda_function.jobs[key].arn] },
    { Effect = "Allow", Action = ["states:StartExecution"], Resource = aws_sfn_state_machine.jobs[0].arn },
    { Effect = "Allow", Action = ["states:DescribeExecution", "states:StopExecution"], Resource = "${replace(aws_sfn_state_machine.jobs[0].arn, ":stateMachine:", ":execution:")}:*" }
  ] })
}
resource "aws_apigatewayv2_integration" "jobs" {
  count                  = var.enable_aws_jobs ? 1 : 0
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.jobs["api"].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "jobs" {
  for_each  = local.job_routes
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.jobs[0].id}"
}
resource "aws_lambda_permission" "jobs" {
  count         = var.enable_aws_jobs ? 1 : 0
  statement_id  = "AllowJobsHTTPAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.jobs["api"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/v1/jobs*"
}
output "jobs_state_machine_arn" { value = var.enable_aws_jobs ? aws_sfn_state_machine.jobs[0].arn : null }

# Recupera el bloqueo incluso si el flujo vence sin que ningún navegador sondee.
resource "aws_cloudwatch_event_rule" "job_terminal" {
  count         = var.enable_aws_jobs ? 1 : 0
  name          = "${local.name}-jobs-terminal"
  event_pattern = jsonencode({ source = ["aws.states"], "detail-type" = ["Step Functions Execution Status Change"], detail = { stateMachineArn = [aws_sfn_state_machine.jobs[0].arn], status = ["FAILED", "TIMED_OUT", "ABORTED", "SUCCEEDED"], name = [{ prefix = "job-" }] } })
}
resource "aws_cloudwatch_event_target" "job_terminal" {
  count = var.enable_aws_jobs ? 1 : 0
  rule  = aws_cloudwatch_event_rule.job_terminal[0].name
  arn   = aws_lambda_function.jobs["failure"].arn
  input_transformer {
    input_paths    = { jobId = "$.detail.name" }
    input_template = "{\"jobId\":<jobId>}"
  }
  retry_policy {
    maximum_event_age_in_seconds = 3600
    maximum_retry_attempts       = 2
  }
}
resource "aws_lambda_permission" "job_terminal" {
  count         = var.enable_aws_jobs ? 1 : 0
  statement_id  = "AllowExecutionStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.jobs["failure"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.job_terminal[0].arn
}
