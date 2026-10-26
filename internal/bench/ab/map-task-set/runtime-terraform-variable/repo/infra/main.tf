resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = var.instance_type
}
