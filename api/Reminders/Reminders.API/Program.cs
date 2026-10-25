using Mapster;
using Microsoft.EntityFrameworkCore;
using Reminders.API.Extensions;
using Scalar.AspNetCore;
using Reminders.Infrastructure.Contexts;

using Reminders.Application.Repositories.Interfaces;
using Reminders.Infrastructure.Repositories;

using Reminders.Application.Services.Interfaces;
using Reminders.Application.Services;

using Reminders.Application.Common.Interfaces;
using Reminders.Application.Common;
using Reminders.Infrastructure.Messaging;
using StackExchange.Redis;

using Reminders.Application.Configurations;


var builder = WebApplication.CreateBuilder(args);

var postgresConnectionString = builder.Configuration.GetConnectionString("PostgresConnection");
var redisConnectionString = builder.Configuration.GetConnectionString("RedisConnection");

// Add services to the container.
builder.Services.AddControllers();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<RemindersContext>(options =>
    options.UseNpgsql(postgresConnectionString));

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var options = ConfigurationOptions.Parse(redisConnectionString!);
    options.AbortOnConnectFail = false;

    return ConnectionMultiplexer.Connect(options);
});

builder.Services.Configure<SmtpYandexOptions>(builder.Configuration.GetSection("SmtpYandex"));

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<RemindersContext>();
builder.Services.AddScoped<IHasher, BCryptHasherService>();

builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<ICategoryService, CategoryService>();

builder.Services.AddScoped<IReminderRepository, ReminderRepository>();
builder.Services.AddScoped<IReminderService, ReminderService>();

builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<INotificationService, NotificationService>();

builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IAdminService, AdminService>();

builder.Services.AddMapster();

builder.Services.AddJWTAuthentication(builder.Configuration);

builder.Services.AddSingleton<IRedisNotification, RedisNotificationClient>();

builder.Services.AddScoped<IEmailSender, EmailSender>();

builder.Services.AddHostedService<Reminders.DbScannerWorker.Worker>();

builder.Services.AddHostedService<Reminders.NotificationSenderWorker.Worker>();


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.UseExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
