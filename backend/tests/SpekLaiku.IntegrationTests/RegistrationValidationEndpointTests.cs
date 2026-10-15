using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace SpekLaiku.IntegrationTests;

[Collection(PostgreSqlCollection.Name)]
public class RegistrationValidationEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/registration";

    public static TheoryData<string, string, string, string, string> SingleInvalidField => new()
    {
        { "user@example", "Password123!", "Password123!", "email", "Enter a valid email address." },
        { "user@example.com", "short", "short", "password", "Password must be at least 8 characters." },
        { "user@example.com", "Password123!", "Different123!", "passwordConfirmation", "Passwords do not match." },
        { "user@example.com", "Password123!", "", "passwordConfirmation", "Confirm your password." }
    };

    [Theory]
    [MemberData(nameof(SingleInvalidField))]
    public async Task Register_OneInvalidField_Returns400WithOnlyThatFieldsMessage(
        string email, string password, string confirmation, string field, string message)
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(
            Path, new { email, password, passwordConfirmation = confirmation });

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(new Dictionary<string, string[]> { [field] = [message] }, errors);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Register_SeveralInvalidFields_ReturnsEveryMessageInOneResponse()
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsJsonAsync(
            Path, new { email = "not-an-email", password = "short", passwordConfirmation = "other" });

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(
            new Dictionary<string, string[]>
            {
                ["email"] = ["Enter a valid email address."],
                ["password"] = ["Password must be at least 8 characters."],
                ["passwordConfirmation"] = ["Passwords do not match."]
            },
            errors);
    }

    [Theory]
    [InlineData("""{"email":"","password":"","passwordConfirmation":""}""")]
    [InlineData("""{"email":null,"password":null,"passwordConfirmation":null}""")]
    [InlineData("{}")]
    public async Task Register_EmptyOrMissingFields_ReturnsTheEmptyMessages(string body)
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, Json(body));

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(
            new Dictionary<string, string[]>
            {
                ["email"] = ["Enter your email address."],
                ["password"] = ["Enter a password."],
                ["passwordConfirmation"] = ["Confirm your password."]
            },
            errors);
    }

    [Theory]
    [InlineData("""{"email":"user@example.com","password":""")]
    [InlineData("not json")]
    public async Task Register_BodyIsNotValidJson_ReturnsRequestError(string body)
    {
        using var client = factory.CreateHttpsClient();

        var response = await client.PostAsync(Path, Json(body));

        var errors = await AssertValidationProblemAsync(response);
        Assert.Equal(new Dictionary<string, string[]> { ["request"] = ["The request is invalid."] }, errors);
    }

    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    private static async Task<Dictionary<string, string[]>> AssertValidationProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
        Assert.Equal("One or more request fields are invalid.", problem.GetProperty("title").GetString());
        return problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }
}
