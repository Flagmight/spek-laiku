using SpekLaiku.Api.Errors;

namespace SpekLaiku.UnitTests;

/// <summary>The one shape of a 400 answer built from a service's field errors.</summary>
public sealed class FieldErrorsTests
{
    [Fact]
    public void Errors_AreGroupedByFieldInOrder()
    {
        var problem = new[]
        {
            new KeyValuePair<string, string>("name", "Enter a plan name."),
            new KeyValuePair<string, string>("generatedScheduleId", "Generate the schedule again to save it."),
            new KeyValuePair<string, string>("name", "Second message.")
        }.ToValidationProblem();

        Assert.Equal(400, problem.Status);
        Assert.Equal("One or more request fields are invalid.", problem.Title);
        Assert.Equal(["Enter a plan name.", "Second message."], problem.Errors["name"]);
        Assert.Equal(["Generate the schedule again to save it."], problem.Errors["generatedScheduleId"]);
    }
}
