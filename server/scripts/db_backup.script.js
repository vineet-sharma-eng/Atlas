const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../../backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTodayBackupPath() {
  const today = new Date().toISOString().split('T')[0];
  const fileName = `backup-${today}.sql`;

  return {
    fileName,
    filePath: path.join(BACKUP_DIR, fileName),
  };
}

function cleanupOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.startsWith('backup-'))
    .map((file) => ({
      name: file,
      time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
    }))
    .sort((left, right) => right.time - left.time);

  const filesToDelete = files.slice(3);

  filesToDelete.forEach((file) => {
    const fullPath = path.join(BACKUP_DIR, file.name);
    fs.unlinkSync(fullPath);
    console.log('Deleted old backup:', file.name);
  });
}

function runDbBackup() {
  ensureBackupDir();

  const { fileName, filePath } = getTodayBackupPath();

  if (fs.existsSync(filePath)) {
    console.log('Backup already exists for today. Skipping...');
    return Promise.resolve({ skipped: true, fileName, filePath });
  }

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    return Promise.reject(new Error('DATABASE_URL is required to run DB backup.'));
  }

  const command = `pg_dump ${dbUrl} > "${filePath}"`;

  console.log('Running backup...');

  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        console.error('Backup failed:', error);
        reject(error);
        return;
      }

      console.log('Backup created:', fileName);
      cleanupOldBackups();
      resolve({ skipped: false, fileName, filePath });
    });
  });
}

module.exports = runDbBackup;
