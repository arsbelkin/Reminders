using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Reminders.API.Extensions;

public static class DependencyInjection
{
    public static IServiceCollection AddJWTAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwtSecretKey = configuration["Jwt:Secret"] ?? throw new ArgumentNullException("Jwt:Secret");
        var issuer = configuration["Jwt:Issuer"] ?? "Reminders:issue";
        var audience = configuration["Jwt:Audience"] ?? "Reminders:audience";
        var key = Encoding.ASCII.GetBytes(jwtSecretKey);
        
        services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    
                    ValidateAudience = true,
                    ValidAudience = audience,
                    
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                    
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var authHeader = context.Request.Headers["Authorization"].ToString();

                        if (!string.IsNullOrEmpty(authHeader) &&
                            authHeader.StartsWith("Bearer", StringComparison.OrdinalIgnoreCase))
                        {
                            return Task.CompletedTask;
                        }

                        if (context.Request.Cookies.TryGetValue("X-Access-Token", out var token))
                        {
                            context.Token = token;
                        }

                        return Task.CompletedTask;
                    }
                };
            });
        
        return services;
    }
}