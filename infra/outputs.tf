output "api_base_url" { value = "${aws_apigatewayv2_api.api.api_endpoint}/v1" }
output "health_url" { value = "${aws_apigatewayv2_api.api.api_endpoint}/v1/health" }
output "frontend_url" { value = "https://${var.frontend_branch}.${aws_amplify_app.frontend.default_domain}" }
output "amplify_app_id" { value = aws_amplify_app.frontend.id }
output "aws_region" { value = var.aws_region }
output "build_commit" { value = var.build_commit }
