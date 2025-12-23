using Microsoft.AspNetCore.Identity;
using Domain.Entities;
using Domain.Enums;
using System.Threading.Tasks;
using Infrastructure.Data;

namespace Infrastructure.Data
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(AppDbContext context)
        {
            if (context.Users.Any())
            {
                return; // DB has been seeded
            }

            var hasher = new PasswordHasher<User>();

            // ===== STEP 1: Create Military Ranks =====
            var ranks = new List<MilitaryRank>
            {
                 new MilitaryRank { Code = "HV_ISTH_ASB_BCVS", DisplayName = "Hv.İsth.Asb.Bçvş", SortOrder = 1, IsActive = true },
                new MilitaryRank { Code = "HV_ISTH_ASB_KD_BCVS", DisplayName = "Hv.İsth.Asb.Kd.Bçvş", SortOrder = 2, IsActive = true },
                new MilitaryRank { Code = "HV_ISTH_ASB_KD_CVS", DisplayName = "Hv.İsth.Asb.Kd.Çvş", SortOrder = 4, IsActive = true },
                new MilitaryRank { Code = "HV_ISTH_ASB_KD_UCVS", DisplayName = "Hv.İsth.Asb.Kd.Üçvş", SortOrder = 5, IsActive = true },
                new MilitaryRank { Code = "HV_ISTH_ASB_CVS", DisplayName = "Hv.İsth.Asb.Çvş", SortOrder = 6, IsActive = true },
                new MilitaryRank { Code = "HV_ISTH_UTGM", DisplayName = "Hv.İsth.Ütğm", SortOrder = 7, IsActive = true },
                new MilitaryRank { Code = "HV_MU_ASB_BCVS", DisplayName = "Hv.Mu.Asb.Bçvş", SortOrder = 8, IsActive = true },
                new MilitaryRank { Code = "HV_MU_ASB_KD_BCVS", DisplayName = "Hv.Mu.Asb.Kd.Bçvş", SortOrder = 9, IsActive = true },
                new MilitaryRank { Code = "HV_MU_ASB_KD_CVS", DisplayName = "Hv.Mu.Asb.Kd.Çvş", SortOrder = 10, IsActive = true },
                new MilitaryRank { Code = "HV_MU_ASB_KD_UCVS", DisplayName = "Hv.Mu.Asb.Kd.Üçvş", SortOrder = 11, IsActive = true },
                new MilitaryRank { Code = "HV_MU_ASB_CVS", DisplayName = "Hv.Mu.Asb.Çvş", SortOrder = 12, IsActive = true },
                new MilitaryRank { Code = "HV_MUH_YZB", DisplayName = "Hv.Müh.Yzb", SortOrder = 13, IsActive = true },
                new MilitaryRank { Code = "HV_MUH_UTGM", DisplayName = "Hv.Müh.Ütğm", SortOrder = 14, IsActive = true },
                new MilitaryRank { Code = "HV_SVN_ASB_KD_UCVS", DisplayName = "Hv.Svn.Asb.Kd.Üçvş", SortOrder = 15, IsActive = true }
            };

            context.MilitaryRanks.AddRange(ranks);
            await context.SaveChangesAsync();

            // ===== STEP 2: Create All Users =====

            // Admin user
            var admin = new User
            {
                Email = "admin@example.com",
                DisplayName = "Administrator",
                Role = UserRole.Admin,
                IsActive = true,
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            admin.PasswordHash = hasher.HashPassword(admin, "adminpasswd");

            // Editor user
            var editor = new User
            {
                Email = "editor@example.com",
                DisplayName = "Editor User",
                Role = UserRole.Editor,
                IsActive = true,
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            editor.PasswordHash = hasher.HashPassword(editor, "editorpasswd");

            // Viewer user
            var viewer = new User
            {
                Email = "viewer@example.com",
                DisplayName = "Viewer User",
                Role = UserRole.Viewer,
                IsActive = true,
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            viewer.PasswordHash = hasher.HashPassword(viewer, "viewerpasswd");

            // Kenan BOLAT - Editor with affiliation and department
            var kenanBolat = new User
            {
                Email = "kenan23@gmail.com",
                DisplayName = "Kenan BOLAT",
                Role = UserRole.Editor,
                IsActive = true,
                PhoneNumber = "+90",
                Affiliation = Affiliation.Airforce,  // Assuming 9 = Military
                Department = "IPS",
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            kenanBolat.PasswordHash = hasher.HashPassword(kenanBolat, "kenan23passwd");

            // Personnel 1 - Ali Veli
            var personnel1 = new User
            {
                Email = "personnel1@example.com",
                DisplayName = "Ali Veli",
                Role = UserRole.Editor,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            personnel1.PasswordHash = hasher.HashPassword(personnel1, "personnel1passwd");

            // Personnel 2 - Ayşe Demir (Admin according to SQL)
            var personnel2 = new User
            {
                Email = "personnel2@example.com",
                DisplayName = "Ayşe Demir",
                Role = UserRole.Admin,  // Role 2 = Admin
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            personnel2.PasswordHash = hasher.HashPassword(personnel2, "personnel2passwd");

            // Personnel 3 - Mehmet Kaya
            var personnel3 = new User
            {
                Email = "personnel3@example.com",
                DisplayName = "Mehmet Kaya",
                Role = UserRole.Editor,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            personnel3.PasswordHash = hasher.HashPassword(personnel3, "personnel3passwd");

            // Ali (lowercase) - Viewer with military rank 9
            var aliUser = new User
            {
                Email = "Ali@example.com",
                DisplayName = "ali veli",
                Role = UserRole.Viewer,
                IsActive = true,
                PhoneNumber = "",
                Affiliation = Affiliation.Contractor,  // Assuming 1 = Contractor
                Department = "",
                MilitaryRankId = 9,  // Başastsubay
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            aliUser.PasswordHash = hasher.HashPassword(aliUser, "alipasswd");

            // Kenan (lowercase) - Editor with military rank 7
            var kenanUser = new User
            {
                Email = "kenan@example.com",
                DisplayName = "kenan",
                Role = UserRole.Editor,
                IsActive = true,
                PhoneNumber = "",
                Affiliation = Affiliation.Contractor,  // Assuming 1 = Contractor
                Department = "",
                MilitaryRankId = 7,  // Astsubay
                PreferredLanguage = "tr-TR",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            kenanUser.PasswordHash = hasher.HashPassword(kenanUser, "kenanpasswd");

            // Add all users
            context.Users.AddRange(
                admin, editor, viewer, kenanBolat,
                personnel1, personnel2, personnel3,
                aliUser, kenanUser
            );
            await context.SaveChangesAsync();

            // Update CreatedById for users created by admin
            kenanBolat.CreatedById = admin.Id;
            personnel1.CreatedById = admin.Id;
            personnel2.CreatedById = admin.Id;
            personnel3.CreatedById = admin.Id;
            aliUser.CreatedById = admin.Id;
            kenanUser.CreatedById = admin.Id;
            await context.SaveChangesAsync();

            // ===== STEP 3: Create Systems =====
            var systemGGS = new SystemEntity { Name = "GGS" };
            var systemMGS = new SystemEntity { Name = "MGS" };
            var systemMTZ = new SystemEntity { Name = "MTZ" };

            context.Systems.AddRange(systemGGS, systemMGS, systemMTZ);
            await context.SaveChangesAsync();

            // ===== STEP 4: Create Subsystems =====
            var subsystemPayload = new Subsystem { Name = "Payload", SystemId = systemGGS.Id };
            var subsystemMGS = new Subsystem { Name = "MGS", SystemId = systemMGS.Id };
            var subsystemCMS = new Subsystem { Name = "CMS", SystemId = systemGGS.Id };
            var subsystemGenel = new Subsystem { Name = "Genel", SystemId = systemGGS.Id };
            var subsystemPlatform = new Subsystem { Name = "Platform", SystemId = systemGGS.Id };
            var subsystemSAS = new Subsystem { Name = "SAS", SystemId = systemGGS.Id };
            var subsystemSASS = new Subsystem { Name = "SASS", SystemId = systemGGS.Id };
            var subsystemSUSS = new Subsystem { Name = "SUSS", SystemId = systemGGS.Id };
            var subsystemUSS = new Subsystem { Name = "USS", SystemId = systemGGS.Id };

            context.Subsystems.AddRange(
                subsystemPayload, subsystemMGS, subsystemCMS, subsystemGenel,
                subsystemPlatform, subsystemSAS, subsystemSASS, subsystemSUSS, subsystemUSS
            );
            await context.SaveChangesAsync();

            // ===== STEP 5: Create Components and Configuration Items =====
            var component1 = new Component { Name = "Yazılım", SubsystemId = subsystemPayload.Id };
            context.Components.Add(component1);

            var ci1 = new ConfigurationItem { Name = "SPC" };
            context.ConfigurationItems.Add(ci1);
            await context.SaveChangesAsync();

            // ===== STEP 6: Create Tickets =====
            var ticket1 = new Ticket
            {
                ExternalCode = "T003198",
                Title = "Sample Ticket 1",
                Description = "This is a sample ticket.",
                IsBlocking = false,
                Status = TicketStatus.OPEN,
                TechnicalReportRequired = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedById = admin.Id,
                CIId = ci1.Id,
                SystemId = systemGGS.Id,
                SubsystemId = subsystemPayload.Id,
                ComponentId = component1.Id,
                IsActive = true,
                IsDeleted = false
            };

            var ticket2 = new Ticket
            {
                ExternalCode = "TKT-2024-002",
                Title = "Network Connectivity Issue",
                Description = "Users in Building A cannot access the network",
                IsBlocking = false,
                Status = TicketStatus.OPEN,
                TechnicalReportRequired = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedById = personnel1.Id,
                IsActive = true,
                IsDeleted = false
            };

            var ticket3 = new Ticket
            {
                ExternalCode = "TKT-2024-003",
                Title = "Server Hardware Failure",
                Description = "Production server showing hardware errors",
                IsBlocking = true,
                Status = TicketStatus.OPEN,
                TechnicalReportRequired = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedById = personnel1.Id,
                CIId = ci1.Id,
                ComponentId = component1.Id,
                SubsystemId = subsystemPayload.Id,
                SystemId = systemGGS.Id,
                IsActive = true,
                IsDeleted = false
            };

            context.Tickets.AddRange(ticket1, ticket2, ticket3);
            await context.SaveChangesAsync();

            // ===== STEP 7: Assign Response Personnel to Tickets =====
            // Personnel 1 (Ali Veli) assigned to tickets 2 and 3
            context.TicketResponsePersonnel.AddRange(
                new TicketResponsePersonnel { TicketId = ticket2.Id, UserId = personnel1.Id },
                new TicketResponsePersonnel { TicketId = ticket3.Id, UserId = personnel1.Id }
            );

            // All three personnel assigned to ticket 1
            context.TicketResponsePersonnel.AddRange(
                new TicketResponsePersonnel { TicketId = ticket1.Id, UserId = personnel1.Id },
                new TicketResponsePersonnel { TicketId = ticket1.Id, UserId = personnel2.Id },
                new TicketResponsePersonnel { TicketId = ticket1.Id, UserId = personnel3.Id }
            );

            await context.SaveChangesAsync();

            // ===== STEP 8: Create Ticket Actions (Audit Trail) =====
            context.TicketActions.AddRange(
                new TicketAction
                {
                    TicketId = ticket1.Id,
                    ActionType = ActionType.Create,
                    FromStatus = null,
                    ToStatus = TicketStatus.OPEN,
                    PerformedById = admin.Id,
                    PerformedAt = ticket1.CreatedAt
                },
                new TicketAction
                {
                    TicketId = ticket2.Id,
                    ActionType = ActionType.Create,
                    FromStatus = null,
                    ToStatus = TicketStatus.OPEN,
                    PerformedById = personnel1.Id,
                    PerformedAt = ticket2.CreatedAt
                },
                new TicketAction
                {
                    TicketId = ticket3.Id,
                    ActionType = ActionType.Create,
                    FromStatus = null,
                    ToStatus = TicketStatus.OPEN,
                    PerformedById = personnel1.Id,
                    PerformedAt = ticket3.CreatedAt
                }
            );

            await context.SaveChangesAsync();
            // ===== STEP X: Seed Components =====
            var componentNames = new[]
            {
    "Yazılım",
    "Donanım",
    "Prosedür",
};

            foreach (var name in componentNames)
            {
                if (!context.Components.Any(c => c.Name == name))
                    context.Components.Add(new Component { Name = name });
            }

            await context.SaveChangesAsync();

            // ===== STEP X: Seed Configuration Items =====
            var configurationNames = new[]
            {
    "ANT", "CAD", "CDE", "CQS", "DHF", "DSS", "FDS", "Genel", "GIS",
    "IES", "IPS", "MFS", "MP", "MTZ-PLF", "NET-EQUIP", "PROCEDIT", "SAP",
    "SAW", "SHL", "SPC", "SSPA", "SSS", "T&F", "TU-EXT-I/F", "X-BBB"
};

            foreach (var name in configurationNames)
            {
                if (!context.ConfigurationItems.Any(ci => ci.Name == name))
                    context.ConfigurationItems.Add(new ConfigurationItem { Name = name });
            }

            await context.SaveChangesAsync();


        }

    }
}