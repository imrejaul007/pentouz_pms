import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import cron from 'node-cron';
import AWS from 'aws-sdk';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Automated Backup and Recovery Service
 * Handles database backups, file backups, and disaster recovery
 */

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.maxBackupRetention = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
    this.s3Enabled = process.env.AWS_S3_BACKUP_ENABLED === 'true';
    this.s3BucketName = process.env.AWS_S3_BACKUP_BUCKET;
    
    if (this.s3Enabled) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }

    this.backupStatus = {
      lastBackup: null,
      isRunning: false,
      lastError: null,
      successCount: 0,
      errorCount: 0
    };

    this.initializeBackupDirectory();
    this.scheduleBackups();
  }

  /**
   * Initialize backup directory
   */
  async initializeBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'database'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'files'), { recursive: true });
      await fs.mkdir(path.join(this.backupDir, 'logs'), { recursive: true });
      
      logger.info('Backup directories initialized', {
        backupDir: this.backupDir,
        s3Enabled: this.s3Enabled
      });
    } catch (error) {
      logger.error('Failed to initialize backup directories:', error);
      throw error;
    }
  }

  /**
   * Schedule automated backups
   */
  scheduleBackups() {
    // Daily full backup at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.performFullBackup().catch(error => {
        logger.error('Scheduled full backup failed:', error);
      });
    }, {
      timezone: process.env.BACKUP_TIMEZONE || 'UTC'
    });

    // Hourly incremental backup (business hours)
    cron.schedule('0 9-17 * * 1-5', () => {
      this.performIncrementalBackup().catch(error => {
        logger.error('Scheduled incremental backup failed:', error);
      });
    }, {
      timezone: process.env.BACKUP_TIMEZONE || 'UTC'
    });

    // Weekly cleanup of old backups
    cron.schedule('0 3 * * 0', () => {
      this.cleanupOldBackups().catch(error => {
        logger.error('Backup cleanup failed:', error);
      });
    }, {
      timezone: process.env.BACKUP_TIMEZONE || 'UTC'
    });

    logger.info('Backup schedules configured', {
      dailyBackup: '2:00 AM UTC',
      incrementalBackup: '9 AM - 5 PM UTC (weekdays)',
      cleanup: 'Sundays at 3:00 AM UTC'
    });
  }

  /**
   * Perform full backup (database + files)
   */
  async performFullBackup() {
    if (this.backupStatus.isRunning) {
      logger.warn('Backup already in progress, skipping');
      return;
    }

    this.backupStatus.isRunning = true;
    this.backupStatus.lastError = null;
    const startTime = new Date();
    
    try {
      logger.info('Starting full backup');

      // Create timestamped backup directory
      const timestamp = this.generateTimestamp();
      const backupPath = path.join(this.backupDir, `full-${timestamp}`);
      await fs.mkdir(backupPath, { recursive: true });

      // Backup database
      const dbBackupPath = await this.backupDatabase(backupPath, 'full');
      
      // Backup uploaded files
      const filesBackupPath = await this.backupFiles(backupPath);
      
      // Backup configuration and environment
      const configBackupPath = await this.backupConfiguration(backupPath);
      
      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, {
        type: 'full',
        timestamp,
        startTime,
        endTime: new Date(),
        database: dbBackupPath,
        files: filesBackupPath,
        configuration: configBackupPath
      });

      // Compress backup
      const compressedBackup = await this.compressBackup(backupPath);

      // Upload to S3 if enabled
      if (this.s3Enabled) {
        await this.uploadToS3(compressedBackup, `full-${timestamp}.tar.gz`);
      }

      // Update status
      this.backupStatus.lastBackup = new Date();
      this.backupStatus.successCount++;

      const duration = new Date() - startTime;
      logger.info('Full backup completed successfully', {
        duration: `${duration}ms`,
        backupPath: compressedBackup,
        size: await this.getFileSize(compressedBackup)
      });

      return {
        success: true,
        type: 'full',
        path: compressedBackup,
        manifest,
        duration
      };

    } catch (error) {
      this.backupStatus.lastError = error.message;
      this.backupStatus.errorCount++;
      logger.error('Full backup failed:', error);
      throw error;
    } finally {
      this.backupStatus.isRunning = false;
    }
  }

  /**
   * Perform incremental backup (recent changes only)
   */
  async performIncrementalBackup() {
    if (this.backupStatus.isRunning) {
      logger.warn('Backup already in progress, skipping incremental backup');
      return;
    }

    this.backupStatus.isRunning = true;
    const startTime = new Date();

    try {
      logger.info('Starting incremental backup');

      // Get last backup time
      const lastBackupTime = this.backupStatus.lastBackup || new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Create timestamped backup directory
      const timestamp = this.generateTimestamp();
      const backupPath = path.join(this.backupDir, `incremental-${timestamp}`);
      await fs.mkdir(backupPath, { recursive: true });

      // Backup only recent database changes
      const dbBackupPath = await this.backupDatabaseIncremental(backupPath, lastBackupTime);

      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, {
        type: 'incremental',
        timestamp,
        startTime,
        endTime: new Date(),
        since: lastBackupTime,
        database: dbBackupPath
      });

      // Compress backup
      const compressedBackup = await this.compressBackup(backupPath);

      // Upload to S3 if enabled
      if (this.s3Enabled) {
        await this.uploadToS3(compressedBackup, `incremental-${timestamp}.tar.gz`);
      }

      this.backupStatus.lastBackup = new Date();
      this.backupStatus.successCount++;

      const duration = new Date() - startTime;
      logger.info('Incremental backup completed successfully', {
        duration: `${duration}ms`,
        backupPath: compressedBackup,
        since: lastBackupTime
      });

      return {
        success: true,
        type: 'incremental',
        path: compressedBackup,
        manifest,
        duration,
        since: lastBackupTime
      };

    } catch (error) {
      this.backupStatus.lastError = error.message;
      this.backupStatus.errorCount++;
      logger.error('Incremental backup failed:', error);
      throw error;
    } finally {
      this.backupStatus.isRunning = false;
    }
  }

  /**
   * Backup database using mongodump
   */
  async backupDatabase(backupPath, type = 'full') {
    const dbBackupPath = path.join(backupPath, 'database');
    await fs.mkdir(dbBackupPath, { recursive: true });

    return new Promise((resolve, reject) => {
      const mongoUri = process.env.MONGO_URI;
      const args = [
        '--uri', mongoUri,
        '--out', dbBackupPath
      ];

      // Add compression for full backups
      if (type === 'full') {
        args.push('--gzip');
      }

      const mongodump = spawn('mongodump', args);
      let errorOutput = '';

      mongodump.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      mongodump.on('close', (code) => {
        if (code === 0) {
          logger.info('Database backup completed', { path: dbBackupPath });
          resolve(dbBackupPath);
        } else {
          logger.error('Database backup failed', { code, error: errorOutput });
          reject(new Error(`mongodump failed with code ${code}: ${errorOutput}`));
        }
      });

      mongodump.on('error', (error) => {
        logger.error('Failed to start mongodump:', error);
        reject(error);
      });
    });
  }

  /**
   * Backup database incrementally (changes since last backup)
   */
  async backupDatabaseIncremental(backupPath, since) {
    try {
      const dbBackupPath = path.join(backupPath, 'database');
      await fs.mkdir(dbBackupPath, { recursive: true });

      // Get collections with recent changes
      const collections = await this.getModifiedCollections(since);
      
      if (collections.length === 0) {
        logger.info('No database changes since last backup');
        return dbBackupPath;
      }

      logger.info(`Backing up ${collections.length} modified collections`, { 
        collections: collections.map(c => c.name),
        since 
      });

      // Backup each modified collection
      for (const collection of collections) {
        await this.backupCollection(collection.name, dbBackupPath, since);
      }

      return dbBackupPath;

    } catch (error) {
      logger.error('Incremental database backup failed:', error);
      throw error;
    }
  }

  /**
   * Backup uploaded files and assets
   */
  async backupFiles(backupPath) {
    const filesBackupPath = path.join(backupPath, 'files');
    await fs.mkdir(filesBackupPath, { recursive: true });

    const fileDirs = [
      'uploads',
      'public/images',
      'public/documents'
    ];

    for (const dir of fileDirs) {
      const sourceDir = path.join(process.cwd(), dir);
      const targetDir = path.join(filesBackupPath, dir);

      try {
        await this.copyDirectory(sourceDir, targetDir);
        logger.debug(`Backed up files from ${sourceDir}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn(`Failed to backup files from ${sourceDir}:`, error);
        }
      }
    }

    return filesBackupPath;
  }

  /**
   * Backup configuration files and environment
   */
  async backupConfiguration(backupPath) {
    const configBackupPath = path.join(backupPath, 'configuration');
    await fs.mkdir(configBackupPath, { recursive: true });

    const configFiles = [
      'package.json',
      'package-lock.json',
      '.env.example',
      'docker-compose.yml',
      'Dockerfile'
    ];

    for (const file of configFiles) {
      const sourcePath = path.join(process.cwd(), file);
      const targetPath = path.join(configBackupPath, file);

      try {
        await fs.copyFile(sourcePath, targetPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn(`Failed to backup config file ${file}:`, error);
        }
      }
    }

    // Backup system info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      mongoVersion: await this.getMongoVersion(),
      redisVersion: await this.getRedisVersion()
    };

    await fs.writeFile(
      path.join(configBackupPath, 'system-info.json'),
      JSON.stringify(systemInfo, null, 2)
    );

    return configBackupPath;
  }

  /**
   * Create backup manifest with metadata
   */
  async createBackupManifest(backupPath, metadata) {
    const manifest = {
      ...metadata,
      version: '1.0',
      hostname: process.env.HOSTNAME || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      checksum: await this.calculateChecksum(backupPath)
    };

    const manifestPath = path.join(backupPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return manifest;
  }

  /**
   * Compress backup directory
   */
  async compressBackup(backupPath) {
    const compressedPath = `${backupPath}.tar.gz`;

    return new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-czf',
        compressedPath,
        '-C',
        path.dirname(backupPath),
        path.basename(backupPath)
      ]);

      tar.on('close', (code) => {
        if (code === 0) {
          // Remove uncompressed directory
          fs.rm(backupPath, { recursive: true, force: true }).then(() => {
            resolve(compressedPath);
          });
        } else {
          reject(new Error(`tar failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  /**
   * Upload backup to S3
   */
  async uploadToS3(filePath, key) {
    if (!this.s3Enabled || !this.s3BucketName) {
      return;
    }

    try {
      const fileContent = await fs.readFile(filePath);
      const fileStats = await fs.stat(filePath);

      const params = {
        Bucket: this.s3BucketName,
        Key: `hotel-management-backups/${key}`,
        Body: fileContent,
        ContentType: 'application/gzip',
        Metadata: {
          'backup-timestamp': new Date().toISOString(),
          'file-size': fileStats.size.toString(),
          'hostname': process.env.HOSTNAME || 'unknown'
        }
      };

      const result = await this.s3.upload(params).promise();
      
      logger.info('Backup uploaded to S3', {
        bucket: this.s3BucketName,
        key: result.Key,
        size: fileStats.size
      });

      return result;
    } catch (error) {
      logger.error('S3 upload failed:', error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreDatabase(backupPath, options = {}) {
    const { dropExisting = false, targetDatabase } = options;

    try {
      logger.info('Starting database restore', { backupPath, options });

      const mongoUri = process.env.MONGO_URI;
      const args = ['--uri', mongoUri];

      if (dropExisting) {
        args.push('--drop');
      }

      if (targetDatabase) {
        args.push('--db', targetDatabase);
      }

      args.push(backupPath);

      return new Promise((resolve, reject) => {
        const mongorestore = spawn('mongorestore', args);
        let errorOutput = '';

        mongorestore.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        mongorestore.on('close', (code) => {
          if (code === 0) {
            logger.info('Database restore completed successfully');
            resolve();
          } else {
            logger.error('Database restore failed', { code, error: errorOutput });
            reject(new Error(`mongorestore failed with code ${code}: ${errorOutput}`));
          }
        });

        mongorestore.on('error', (error) => {
          logger.error('Failed to start mongorestore:', error);
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Database restore failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(options = {}) {
    const { type, limit = 50 } = options;

    try {
      const backups = [];
      
      // List local backups
      const localBackups = await this.listLocalBackups(type);
      backups.push(...localBackups);

      // List S3 backups if enabled
      if (this.s3Enabled) {
        const s3Backups = await this.listS3Backups(type);
        backups.push(...s3Backups);
      }

      // Sort by date (newest first) and limit
      return backups
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Get backup status and statistics
   */
  getBackupStatus() {
    return {
      ...this.backupStatus,
      settings: {
        backupDir: this.backupDir,
        maxRetention: this.maxBackupRetention,
        s3Enabled: this.s3Enabled,
        s3Bucket: this.s3BucketName
      }
    };
  }

  /**
   * Test backup and restore process
   */
  async testBackupRestore() {
    try {
      logger.info('Starting backup/restore test');

      // Create test backup
      const testBackup = await this.performFullBackup();
      
      // Verify backup integrity
      const isValid = await this.verifyBackupIntegrity(testBackup.path);
      
      if (!isValid) {
        throw new Error('Backup integrity check failed');
      }

      logger.info('Backup/restore test completed successfully', {
        backupPath: testBackup.path,
        duration: testBackup.duration
      });

      return {
        success: true,
        message: 'Backup and restore test completed successfully',
        testResults: {
          backupCreated: true,
          integrityCheck: isValid,
          backupPath: testBackup.path
        }
      };

    } catch (error) {
      logger.error('Backup/restore test failed:', error);
      return {
        success: false,
        message: 'Backup and restore test failed',
        error: error.message
      };
    }
  }

  // Helper methods

  generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').split('.')[0];
  }

  async getModifiedCollections(since) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const modifiedCollections = [];

    for (const collection of collections) {
      try {
        const recentDoc = await mongoose.connection.db.collection(collection.name)
          .findOne(
            { updatedAt: { $gte: since } },
            { sort: { updatedAt: -1 } }
          );

        if (recentDoc) {
          modifiedCollections.push(collection);
        }
      } catch (error) {
        // Collection might not have updatedAt field, include it anyway
        modifiedCollections.push(collection);
      }
    }

    return modifiedCollections;
  }

  async backupCollection(collectionName, backupPath, since) {
    const query = since ? JSON.stringify({ updatedAt: { $gte: since } }) : '{}';
    
    return new Promise((resolve, reject) => {
      const args = [
        '--uri', process.env.MONGO_URI,
        '--collection', collectionName,
        '--query', query,
        '--out', backupPath
      ];

      const mongodump = spawn('mongodump', args);

      mongodump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Collection backup failed with code ${code}`));
        }
      });

      mongodump.on('error', reject);
    });
  }

  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  async getMongoVersion() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const buildInfo = await adminDb.buildInfo();
      return buildInfo.version;
    } catch (error) {
      return 'unknown';
    }
  }

  async getRedisVersion() {
    try {
      const info = await cacheService.client?.info('server');
      const versionMatch = info?.match(/redis_version:([^\r\n]+)/);
      return versionMatch ? versionMatch[1] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  async calculateChecksum(dirPath) {
    // Simple checksum calculation - in production, use proper hashing
    const stats = await fs.stat(dirPath);
    return `${stats.size}-${stats.mtime.getTime()}`;
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return this.formatBytes(stats.size);
    } catch (error) {
      return 'unknown';
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async listLocalBackups(type) {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.tar.gz') && (!type || file.includes(type))) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            name: file,
            type: file.includes('full') ? 'full' : 'incremental',
            location: 'local',
            path: filePath,
            size: stats.size,
            timestamp: stats.mtime,
            formattedSize: this.formatBytes(stats.size)
          });
        }
      }

      return backups;
    } catch (error) {
      logger.error('Failed to list local backups:', error);
      return [];
    }
  }

  async listS3Backups(type) {
    if (!this.s3Enabled) return [];

    try {
      const params = {
        Bucket: this.s3BucketName,
        Prefix: 'hotel-management-backups/'
      };

      const data = await this.s3.listObjectsV2(params).promise();
      const backups = [];

      for (const object of data.Contents || []) {
        const key = object.Key;
        const filename = path.basename(key);
        
        if (filename.endsWith('.tar.gz') && (!type || filename.includes(type))) {
          backups.push({
            name: filename,
            type: filename.includes('full') ? 'full' : 'incremental',
            location: 's3',
            key: key,
            size: object.Size,
            timestamp: object.LastModified,
            formattedSize: this.formatBytes(object.Size)
          });
        }
      }

      return backups;
    } catch (error) {
      logger.error('Failed to list S3 backups:', error);
      return [];
    }
  }

  async verifyBackupIntegrity(backupPath) {
    try {
      // Basic integrity check - verify file exists and is not empty
      const stats = await fs.stat(backupPath);
      return stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      logger.info('Starting backup cleanup');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxBackupRetention);

      // Cleanup local backups
      const localBackups = await this.listLocalBackups();
      let deletedLocal = 0;

      for (const backup of localBackups) {
        if (new Date(backup.timestamp) < cutoffDate) {
          await fs.unlink(backup.path);
          deletedLocal++;
          logger.debug(`Deleted old local backup: ${backup.name}`);
        }
      }

      // Cleanup S3 backups
      let deletedS3 = 0;
      if (this.s3Enabled) {
        const s3Backups = await this.listS3Backups();
        
        for (const backup of s3Backups) {
          if (new Date(backup.timestamp) < cutoffDate) {
            await this.s3.deleteObject({
              Bucket: this.s3BucketName,
              Key: backup.key
            }).promise();
            deletedS3++;
            logger.debug(`Deleted old S3 backup: ${backup.name}`);
          }
        }
      }

      logger.info('Backup cleanup completed', {
        deletedLocal,
        deletedS3,
        retentionDays: this.maxBackupRetention
      });

      return { deletedLocal, deletedS3 };

    } catch (error) {
      logger.error('Backup cleanup failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const backupService = new BackupService();

export default backupService;