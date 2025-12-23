# ------------------------------
# CONFIG
# ------------------------------
$BackupFolder = "C:\backups"
$ContainerBackup = "satellite_tickets_backup"
$ContainerDB = "satellite_tickets_db"
$PGUser = "postgres"
$PGPassword = "postgres"

# ------------------------------
# CREATE TIMESTAMP
# ------------------------------
$ts = Get-Date -Format yyyyMMdd_HHmmss
$BackupFile = "$BackupFolder\tickets_db_$ts.sql"

# ------------------------------
# RUN BACKUP
# ------------------------------
docker exec -e PGPASSWORD=$PGPassword $ContainerBackup `
  pg_dumpall -h $ContainerDB -p 5432 -U $PGUser --clean --if-exists `
  > $BackupFile

Write-Host "Backup completed: $BackupFile"
