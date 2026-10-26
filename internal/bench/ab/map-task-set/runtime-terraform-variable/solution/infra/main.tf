resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = var.app_instance_type
}
