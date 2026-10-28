locals {
  name = "${var.project_name}-${var.environment}"
  functions = {
    health  = { handler = "api.health.handler", memory = 256, timeout = 5, route = "GET /v1/health" }
    config  = { handler = "api.config.handler", memory = 256, timeout = 5, route = "GET /v1/config" }
    preview = { handler = "api.preview.handler", memory = 1024, timeout = 28, route = "POST /v1/scenarios/preview" }
    compare = { handler = "api.compare.handler", memory = 3008, timeout = 28, route = "POST /v1/simulations/compare" }
    report  = { handler = "api.report.handler", memory = 2048, timeout = 28, route = "POST /v1/reports/mayor" }
  }
}

resource "aws_amplify_app" "frontend" {
  name                     = local.name
  platform                 = "WEB"
  enable_branch_auto_build = false
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|json|map)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}
resource "aws_amplify_branch" "frontend" {
  app_id            = aws_amplify_app.frontend.id
  branch_name       = var.frontend_branch
  stage             = "BETA"
  enable_auto_build = false
}
resource "aws_apigatewayv2_api" "api" {
  name          = local.name
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins  = concat(["https://${var.frontend_branch}.${aws_amplify_app.frontend.default_domain}"], var.allowed_origins)
    allow_methods  = ["GET", "POST", "OPTIONS"]
    allow_headers  = ["content-type", "content-encoding", "accept"]
    expose_headers = ["content-disposition"]
    max_age        = 300
  }
}
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 4
    throttling_rate_limit  = 2
  }
}
resource "aws_cloudwatch_log_group" "function" {
  for_each          = local.functions
  name              = "/aws/lambda/${local.name}-${each.key}"
  retention_in_days = 7
}
resource "aws_iam_role" "function" {
  for_each           = local.functions
  name               = "${local.name}-${each.key}"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "logs" {
  for_each = local.functions
  role     = aws_iam_role.function[each.key].id
  policy   = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.function[each.key].arn}:*" }] })
}
resource "aws_lambda_function" "function" {
  for_each                       = local.functions
  function_name                  = "${local.name}-${each.key}"
  role                           = aws_iam_role.function[each.key].arn
  runtime                        = "python3.12"
  architectures                  = ["x86_64"]
  handler                        = each.value.handler
  memory_size                    = each.value.memory
  timeout                        = each.value.timeout
  filename                       = var.backend_zip_path
  source_code_hash               = filebase64sha256(var.backend_zip_path)
  reserved_concurrent_executions = each.key == "compare" ? var.compare_reserved_concurrency : -1
  environment {
    variables = {
      ENGINE_VERSION               = "0.1.0"
      SCHEMA_VERSION               = "1.0"
      BUILD_COMMIT                 = var.build_commit
      LOCAL_JOBS_ENABLED           = "0"
      DEPLOYMENT_PROFILE           = "staging-bounded-v1"
      MAX_SYNC_EDGE_DAY_REPLICATES = "3000000"
      MAX_REQUEST_BYTES            = "65536"
      MAX_RESPONSE_BYTES           = "5242880"
      MAX_DECODED_RESPONSE_BYTES   = "33554432"
      MAX_EDGES                    = "100000"
      MAX_FRAME_STATES             = "400000"
    }
  }
  depends_on = [aws_iam_role_policy.logs]
}
resource "aws_apigatewayv2_integration" "function" {
  for_each               = local.functions
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.function[each.key].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000
}
resource "aws_apigatewayv2_route" "function" {
  for_each  = local.functions
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value.route
  target    = "integrations/${aws_apigatewayv2_integration.function[each.key].id}"
}
resource "aws_lambda_permission" "api" {
  for_each      = local.functions
  statement_id  = "AllowHTTPAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/${replace(each.value.route, " /", "/")}"
}
resource "aws_cloudwatch_metric_alarm" "errors" {
  for_each            = local.functions
  alarm_name          = "${local.name}-${each.key}-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.function[each.key].function_name }
}
