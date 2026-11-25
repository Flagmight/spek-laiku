using System.Text.Json;
using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The administrator's view of an account maps to exactly the five values of feature 014
/// contracts/admin-accounts-api.md, and nothing else (spec FR-011, SC-004).
/// </summary>
public sealed class AdminAccountMappingTests : IDisposable
{
    private static readonly DateTime Registered = new(2026, 11, 21, 12, 5, 0, DateTimeKind.Utc);

    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public AdminAccountMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(AdminAccountMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void MapsTheFiveFields()
    {
        var summary = new AdminAccountSummary(
            "8d3f0c2e-6a1b-4f7e-9c55-1b2a3c4d5e6f", "ana@example.com", "Registered User", AccountStatus.Active, Registered);

        var response = mapper.Map<AdminAccountResponse>(summary);

        Assert.Equal(
            new AdminAccountResponse(
                "8d3f0c2e-6a1b-4f7e-9c55-1b2a3c4d5e6f", "ana@example.com", "Registered User", "Active", Registered),
            response);
    }

    [Fact]
    public void MapsSuspendedStatusAsItsName()
    {
        var summary = new AdminAccountSummary("id", "bob@example.com", "Registered User", AccountStatus.Suspended, Registered);

        Assert.Equal("Suspended", mapper.Map<AdminAccountResponse>(summary).AccountStatus);
    }

    [Fact]
    public void SerializedResponse_HasExactlyTheFiveProperties()
    {
        var summary = new AdminAccountSummary("id", "ana@example.com", "Administrator", AccountStatus.Active, Registered);

        var json = JsonSerializer.Serialize(
            mapper.Map<AdminAccountResponse>(summary), new JsonSerializerOptions(JsonSerializerDefaults.Web));

        using var document = JsonDocument.Parse(json);
        Assert.Equal(
            ["id", "email", "role", "accountStatus", "registrationDate"],
            document.RootElement.EnumerateObject().Select(property => property.Name));
    }

    public void Dispose() => provider.Dispose();
}
