using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Reminders.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, comment: "Id"),
                    Username = table.Column<string>(type: "text", nullable: false, comment: "имя пользователя"),
                    Email = table.Column<string>(type: "text", nullable: false, comment: "email"),
                    PasswordHash = table.Column<string>(type: "text", nullable: false, comment: "хэшированный пароль"),
                    CreatedTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, comment: "время создания")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                },
                comment: "Пользователи");

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, comment: "Id"),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false, comment: "id создателя"),
                    Title = table.Column<string>(type: "text", nullable: false, comment: "Название"),
                    Description = table.Column<string>(type: "text", nullable: true, comment: "Описание"),
                    CreatedTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, comment: "время создания")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_Users_CreatorId",
                        column: x => x.CreatorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Категории");

            migrationBuilder.CreateTable(
                name: "Reminders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, comment: "Id"),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false, comment: "id создателя"),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false, comment: "id категории"),
                    Title = table.Column<string>(type: "text", nullable: false, comment: "Название"),
                    Description = table.Column<string>(type: "text", nullable: true, comment: "Описание"),
                    CreatedTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, comment: "время создания"),
                    Priority = table.Column<int>(type: "integer", nullable: false, comment: "Приоритет"),
                    IsCompleted = table.Column<int>(type: "integer", nullable: false, comment: "Статус завершения"),
                    CompletedTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, comment: "Время завершения"),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, comment: "Дедлайн")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reminders_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reminders_Users_CreatorId",
                        column: x => x.CreatorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Напоминания");

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, comment: "Id"),
                    ReminderId = table.Column<Guid>(type: "uuid", nullable: false, comment: "id напоминания"),
                    ReceiverId = table.Column<Guid>(type: "uuid", nullable: false, comment: "id получателя"),
                    IsProcessed = table.Column<int>(type: "integer", nullable: false, comment: "статус обработки"),
                    NotificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, comment: "время напоминания"),
                    Recurrency = table.Column<int>(type: "integer", nullable: false, comment: "Повтор напоминания")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Reminders_ReminderId",
                        column: x => x.ReminderId,
                        principalTable: "Reminders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_ReceiverId",
                        column: x => x.ReceiverId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Уведомления");

            migrationBuilder.CreateTable(
                name: "ReminderMembers",
                columns: table => new
                {
                    MembersId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReminderId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReminderMembers", x => new { x.MembersId, x.ReminderId });
                    table.ForeignKey(
                        name: "FK_ReminderMembers_Reminders_ReminderId",
                        column: x => x.ReminderId,
                        principalTable: "Reminders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReminderMembers_Users_MembersId",
                        column: x => x.MembersId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CreatorId",
                table: "Categories",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IsProcessed_NotificationTime",
                table: "Notifications",
                columns: new[] { "IsProcessed", "NotificationTime" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ReceiverId",
                table: "Notifications",
                column: "ReceiverId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ReminderId",
                table: "Notifications",
                column: "ReminderId");

            migrationBuilder.CreateIndex(
                name: "IX_ReminderMembers_ReminderId",
                table: "ReminderMembers",
                column: "ReminderId");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_CategoryId",
                table: "Reminders",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_CreatorId",
                table: "Reminders",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "ReminderMembers");

            migrationBuilder.DropTable(
                name: "Reminders");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
