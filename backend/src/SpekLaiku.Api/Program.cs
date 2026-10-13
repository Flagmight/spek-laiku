using AutoMapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SendGrid;
using SpekLaiku.Api.Authorization;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Errors;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.DataProtection;

namespace SpekLaiku.Api;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddControllers();
        builder.Services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = context =>
            {
                var errors = context.ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .ToDictionary(entry => entry.Key, _ => new[] { "Invalid value." });
                if (errors.Count == 0)
                {
                    errors.Add("request", ["The request is invalid."]);
                }

                return new BadRequestObjectResult(new ValidationProblemDetails(errors)
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "One or more request fields are invalid."
                });
            };
        });
        builder.Services.AddProblemDetails();
        builder.Services.AddExceptionHandler<ApiExceptionHandler>();
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
        {
            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "Set ConnectionStrings:DefaultConnection using environment-specific configuration.");
            }

            options.UseNpgsql(connectionString);
        });
        builder.Services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequiredUniqueChars = 1;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireUppercase = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();
        builder.Services.AddDataProtection();
        builder.Services.AddSingleton(provider =>
            provider.GetRequiredService<IDataProtectionProvider>()
                .CreateProtector("SpekLaiku.Verification"));
        builder.Services.AddAutoMapper(_ => { }, typeof(RegistrationMappingProfile).Assembly);
        builder.Services.AddScoped<RegistrationService>();
        builder.Services.AddScoped<VerificationService>();
        builder.Services.Configure<SendGridOptions>(
            builder.Configuration.GetSection(SendGridOptions.SectionName));
        builder.Services.Configure<EmailOptions>(
            builder.Configuration.GetSection(EmailOptions.SectionName));
        builder.Services.AddSingleton<ISendGridClient>(provider =>
        {
            var options = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<SendGridOptions>>().Value;
            return new SendGridClient(options.ApiKey);
        });
        builder.Services.AddScoped<IEmailSender, SendGridEmailSender>();
        builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();
        builder.Services.AddAuthorization(options =>
            options.AddPolicy("ActiveAccount", policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(new ActiveAccountRequirement());
            }));
        builder.Services.AddScoped<IAuthorizationHandler, ActiveAccountAuthorizationHandler>();

        var app = builder.Build();

        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        app.Run();
    }
}
