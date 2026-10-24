from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    operations = [
        migrations.CreateModel(
            name="Author",
            fields=[("id", models.AutoField(primary_key=True))],
        ),
        migrations.CreateModel(
            name="Post",
            fields=[("id", models.AutoField(primary_key=True))],
            options={"db_table": "blog_posts"},
        ),
    ]
