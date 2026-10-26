provider "aws" {
  region = "eu-central-1"
}

resource "aws_security_group" "web" {
  name = "web"
}

resource "aws_security_group" "db" {
  name = "db"
  # aws_security_group.ghost is only a comment
}

resource "aws_security_group_rule" "web_to_db" {
  type                     = "ingress"
  security_group_id        = aws_security_group.db.id
  source_security_group_id = aws_security_group.web.id
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.base.id
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  user_data              = <<EOT
#!/bin/sh
echo aws_fake_thing.inside_heredoc
EOT
  tags = {
    Owner = "arn:aws:iam::123456789012:user/ops"
  }
}

data "aws_ami" "base" {
  most_recent = true
}

module "vpc" {
  source = "./modules/vpc"
  cidr   = "10.0.0.0/16"
}

resource "aws_route53_record" "api" {
  name    = "api.client-internal.example.com"
  records = [module.vpc.nat_ip]
}
