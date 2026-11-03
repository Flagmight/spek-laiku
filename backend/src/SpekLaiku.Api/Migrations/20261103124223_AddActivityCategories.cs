using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using SpekLaiku.Api.Data;

#nullable disable

namespace SpekLaiku.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "varchar(60)", nullable: false),
                    NormalizedName = table.Column<string>(type: "varchar(60)", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    DefaultDurationHours = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: false),
                    RequiresDaylight = table.Column<bool>(type: "boolean", nullable: false),
                    MaxWindMs = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    MaxRainMmPerHour = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    MinTemperatureC = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    MaxTemperatureC = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    PlaceTags = table.Column<List<string>>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityCategories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityCategories_NormalizedName",
                table: "ActivityCategories",
                column: "NormalizedName",
                unique: true);

            // Inserted here instead of with HasData, because EF Core cannot compare text[] seed values
            // and HasData reported a model change on every build (research section 5 fallback).
            foreach (var category in StarterCategories.All)
            {
                migrationBuilder.InsertData(
                    table: "ActivityCategories",
                    columns: StarterCategoryColumns,
                    values: new object[]
                    {
                        category.Id, category.Name, category.NormalizedName, (int)category.Type,
                        category.DefaultDurationHours, category.RequiresDaylight, category.MaxWindMs,
                        category.MaxRainMmPerHour, category.MinTemperatureC, category.MaxTemperatureC,
                        category.PlaceTags
                    });
            }
        }

        private static readonly string[] StarterCategoryColumns =
        [
            "Id", "Name", "NormalizedName", "Type", "DefaultDurationHours", "RequiresDaylight", "MaxWindMs",
            "MaxRainMmPerHour", "MinTemperatureC", "MaxTemperatureC", "PlaceTags"
        ];

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var category in StarterCategories.All)
            {
                migrationBuilder.DeleteData(
                    table: "ActivityCategories",
                    keyColumn: "Id",
                    keyValue: category.Id);
            }

            migrationBuilder.DropTable(
                name: "ActivityCategories");
        }
    }
}
