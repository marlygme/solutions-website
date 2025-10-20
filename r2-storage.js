
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class R2Storage {
    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
        this.bucketName = process.env.R2_BUCKET_NAME || 'marlyg-portal-files';
    }

    // Generate file path based on your structure
    getFilePath(clientId, type, subPath = '') {
        const basePaths = {
            'projects': `clients/${clientId}/projects/${subPath}`,
            'documents': `clients/${clientId}/documents/${subPath}`,
            'contracts': `clients/${clientId}/documents/contracts/${subPath}`,
            'deliverables': `clients/${clientId}/documents/deliverables/${subPath}`,
            'reports': `clients/${clientId}/documents/reports/${subPath}`,
            'admin_templates': `admin/templates/${subPath}`,
            'admin_shared': `admin/shared/${subPath}`
        };
        
        return basePaths[type] || `clients/${clientId}/${subPath}`;
    }

    // Upload file for client
    async uploadClientFile(clientId, type, filename, fileBuffer, contentType, subPath = '') {
        const key = this.getFilePath(clientId, type, subPath ? `${subPath}/${filename}` : filename);
        
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType
        });

        try {
            await this.client.send(command);
            return {
                success: true,
                path: key,
                url: `https://${process.env.R2_CUSTOM_DOMAIN}/${key}` // If you have a custom domain
            };
        } catch (error) {
            console.error('Upload failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Download file
    async downloadFile(key) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        try {
            const response = await this.client.send(command);
            const chunks = [];
            
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            
            return { 
                success: true, 
                data: Buffer.concat(chunks),
                contentType: response.ContentType
            };
        } catch (error) {
            console.error('Download failed:', error);
            return { success: false, error: error.message };
        }
    }

    // List files for a client
    async listClientFiles(clientId, type = '') {
        const prefix = type ? this.getFilePath(clientId, type) : `clients/${clientId}/`;
        
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix
        });

        try {
            const response = await this.client.send(command);
            return {
                success: true,
                files: (response.Contents || []).map(file => ({
                    key: file.Key,
                    size: file.Size,
                    lastModified: file.LastModified,
                    url: `https://${process.env.R2_CUSTOM_DOMAIN}/${file.Key}`
                }))
            };
        } catch (error) {
            console.error('List files failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete file
    async deleteFile(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        try {
            await this.client.send(command);
            return { success: true };
        } catch (error) {
            console.error('Delete failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Create project folder structure (creates placeholder files)
    async createProjectStructure(clientId, projectId) {
        const folders = [
            `clients/${clientId}/projects/${projectId}/`,
            `clients/${clientId}/documents/contracts/`,
            `clients/${clientId}/documents/deliverables/`,
            `clients/${clientId}/documents/reports/`
        ];

        try {
            const uploadPromises = folders.map(folder => {
                const command = new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: `${folder}.placeholder`,
                    Body: '',
                    ContentType: 'text/plain'
                });
                return this.client.send(command);
            });

            await Promise.all(uploadPromises);
            return { success: true, message: 'Project structure created' };
        } catch (error) {
            console.error('Structure creation failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = R2Storage;
