using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpekLaiku.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedPlanCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "SavedPlans",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Plans saved before this migration were created when they were saved (feature 011 data-model.md).
            migrationBuilder.Sql("UPDATE \"SavedPlans\" SET \"CreatedAtUtc\" = \"SavedAtUtc\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "SavedPlans");
        }
    }
}
