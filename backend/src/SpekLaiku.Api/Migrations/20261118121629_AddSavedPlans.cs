using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpekLaiku.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GeneratedSchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Snapshot = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeneratedSchedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SavedPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "varchar(80)", nullable: false),
                    SavedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LocationName = table.Column<string>(type: "varchar(200)", nullable: false),
                    Dates = table.Column<List<DateOnly>>(type: "date[]", nullable: false),
                    GeneratedScheduleId = table.Column<Guid>(type: "uuid", nullable: true),
                    Snapshot = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedPlans_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeneratedSchedules_ExpiresAtUtc",
                table: "GeneratedSchedules",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_SavedPlans_GeneratedScheduleId",
                table: "SavedPlans",
                column: "GeneratedScheduleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedPlans_OwnerId_SavedAtUtc",
                table: "SavedPlans",
                columns: new[] { "OwnerId", "SavedAtUtc" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GeneratedSchedules");

            migrationBuilder.DropTable(
                name: "SavedPlans");
        }
    }
}
