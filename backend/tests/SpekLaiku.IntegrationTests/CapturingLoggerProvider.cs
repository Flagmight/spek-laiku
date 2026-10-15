using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Records every log entry at every level, including its structured values and any exception,
/// so tests can check that nothing secret is ever logged.
/// </summary>
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<string> entries = new();

    public IReadOnlyCollection<string> Entries => entries;

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, entries);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(string category, ConcurrentQueue<string> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull
        {
            entries.Enqueue($"{category} scope: {Describe(state)}");
            return null;
        }

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            entries.Enqueue($"{category} {logLevel}: {formatter(state, exception)} {Describe(state)} {exception}");
        }

        private static string Describe<TState>(TState state) =>
            state is IEnumerable<KeyValuePair<string, object?>> values
                ? string.Join(", ", values.Select(value => $"{value.Key}={value.Value}"))
                : state?.ToString() ?? string.Empty;
    }
}
