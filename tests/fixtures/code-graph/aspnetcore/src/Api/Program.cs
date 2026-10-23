using Api.Handlers;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", HealthHandlers.Ping);
app.MapPost("/echo", (string body) => body);
app.MapControllers();
app.Run();
