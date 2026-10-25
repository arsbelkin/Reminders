using Microsoft.EntityFrameworkCore;

using Reminders.Domain.Models;

namespace Reminders.Infrastructure.Contexts;

public class RemindersContext : DbContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Reminder> Reminders { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    
    public RemindersContext(DbContextOptions<RemindersContext> options) :
        base(options)
    {}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        SetupIdentityModel(modelBuilder);
        base.OnModelCreating(modelBuilder);
    }

    public static void SetupIdentityModel(ModelBuilder modelBuilder)
    {
        SetupUser(modelBuilder);
        SetupCategories(modelBuilder);
        SetupReminders(modelBuilder);
        SetupNotifications(modelBuilder);
    }
    
    private static void SetupUser(ModelBuilder modelBuilder)
    {
        var userEntity = modelBuilder.Entity<User>();

        userEntity.ToTable("Users", u => u.HasComment("Пользователи"));

        userEntity.HasIndex(u => u.Username).IsUnique();
        userEntity.HasIndex(u => u.Email).IsUnique();

        userEntity.Property(u => u.Id).HasComment("Id").IsRequired();
        userEntity.Property(u => u.Email).HasComment("email").IsRequired();
        userEntity.Property(u => u.Username).HasComment("имя пользователя").IsRequired();
        userEntity.Property(u => u.PasswordHash).HasComment("хэшированный пароль").IsRequired();
        userEntity.Property(u => u.CreatedTime).HasComment("время создания").IsRequired();
        userEntity.Property(u => u.IsAdmin).HasComment("является ли пользователь админом").IsRequired();
    }
    
    private static void SetupCategories(ModelBuilder modelBuilder)
    {
        var categoryEntity = modelBuilder.Entity<Category>();

        categoryEntity.ToTable("Categories", c => c.HasComment("Категории"));

        categoryEntity.Property(c => c.Id).HasComment("Id").IsRequired();
        categoryEntity.Property(c => c.CreatorId).HasComment("id создателя").IsRequired();
        categoryEntity.Property(c => c.Title).HasComment("Название").IsRequired();
        categoryEntity.Property(c => c.Description).HasComment("Описание");
        categoryEntity.Property(c => c.CreatedTime).HasComment("время создания").IsRequired();

        categoryEntity.HasOne(c => c.Creator)
            .WithMany()
            .HasForeignKey(c => c.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);
        
        categoryEntity.HasMany(c => c.Members)
            .WithMany()
            .UsingEntity(j => j.ToTable("CategoryMembers"));
    }
    
    private static void SetupReminders(ModelBuilder modelBuilder)
    {
        var reminderEntity = modelBuilder.Entity<Reminder>();

        reminderEntity.ToTable("Reminders", r => r.HasComment("Напоминания"));

        reminderEntity.Property(r => r.Id).HasComment("Id").IsRequired();
        reminderEntity.Property(r => r.CreatorId).HasComment("id создателя").IsRequired();
        reminderEntity.Property(r => r.CategoryId).HasComment("id категории").IsRequired();
        reminderEntity.Property(r => r.Title).HasComment("Название").IsRequired();
        reminderEntity.Property(r => r.Description).HasComment("Описание");
        reminderEntity.Property(r => r.CreatedTime).HasComment("время создания").IsRequired();
        reminderEntity.Property(r => r.Priority).HasComment("Приоритет").IsRequired();
        reminderEntity.Property(r => r.IsCompleted).HasComment("Статус завершения").IsRequired();
        reminderEntity.Property(r => r.CompletedTime).HasComment("Время завершения");
        reminderEntity.Property(r => r.DueDate).HasComment("Дедлайн");
        

        reminderEntity.HasOne(r => r.Creator)
            .WithMany()
            .HasForeignKey(r => r.CreatorId)
            .OnDelete(DeleteBehavior.Restrict);
        
        reminderEntity.HasOne(r => r.Category)
            .WithMany()
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
        
        reminderEntity.HasMany(r => r.Members)
            .WithMany()
            .UsingEntity(j => j.ToTable("ReminderMembers"));
    }
    
    private static void SetupNotifications(ModelBuilder modelBuilder)
    {
        var notificationEntity = modelBuilder.Entity<Notification>();

        notificationEntity.ToTable("Notifications", u => u.HasComment("Уведомления"));
        
        notificationEntity.HasIndex(n => new { n.IsProcessed, n.NotificationTime });

        notificationEntity.Property(n => n.Id).HasComment("Id").IsRequired();
        notificationEntity.Property(n => n.ReminderId).HasComment("id напоминания").IsRequired();
        notificationEntity.Property(n => n.ReceiverId).HasComment("id получателя").IsRequired();
        notificationEntity.Property(n => n.IsProcessed).HasComment("статус обработки").IsRequired();
        notificationEntity.Property(n => n.NotificationTime).HasComment("время напоминания").IsRequired();
        notificationEntity.Property(n => n.Recurrency).HasComment("Повтор напоминания").IsRequired();
        
        notificationEntity.HasOne(n => n.Receiver)
            .WithMany()
            .HasForeignKey(n => n.ReceiverId)
            .OnDelete(DeleteBehavior.Cascade);

        notificationEntity.HasOne(n => n.Reminder)
            .WithMany()
            .HasForeignKey(n => n.ReminderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}