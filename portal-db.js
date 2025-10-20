const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database('portal.db');
db.pragma('journal_mode = WAL');

function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS login_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            size INTEGER NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
        CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
    `);
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createLoginCode(email) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    db.prepare('DELETE FROM login_codes WHERE email = ? AND used = 0').run(email);
    
    db.prepare(`
        INSERT INTO login_codes (email, code, expires_at)
        VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());
    
    return code;
}

function verifyLoginCode(email, code) {
    const result = db.prepare(`
        SELECT id FROM login_codes 
        WHERE email = ? AND code = ? AND used = 0 
        AND expires_at > datetime('now')
    `).get(email, code);
    
    if (result) {
        db.prepare('UPDATE login_codes SET used = 1 WHERE id = ?').run(result.id);
        return true;
    }
    return false;
}

function getOrCreateUser(email) {
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    if (!user) {
        const result = db.prepare('INSERT INTO users (email) VALUES (?)').run(email);
        user = { id: result.lastInsertRowid };
    }
    
    return user;
}

function createSession(userId) {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    db.prepare(`
        INSERT INTO sessions (user_id, session_token, expires_at)
        VALUES (?, ?, ?)
    `).run(userId, token, expiresAt.toISOString());
    
    return token;
}

function getSessionUser(sessionToken) {
    const result = db.prepare(`
        SELECT u.id, u.email 
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.expires_at > datetime('now')
    `).get(sessionToken);
    
    return result;
}

function deleteSession(sessionToken) {
    db.prepare('DELETE FROM sessions WHERE session_token = ?').run(sessionToken);
}

function addFile(userId, filename, filepath, size) {
    const result = db.prepare(`
        INSERT INTO files (user_id, filename, filepath, size)
        VALUES (?, ?, ?, ?)
    `).run(userId, filename, filepath, size);
    
    return result.lastInsertRowid;
}

function getUserFiles(userId) {
    return db.prepare(`
        SELECT id, filename, size, uploaded_at
        FROM files
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
    `).all(userId);
}

function getFile(fileId, userId) {
    return db.prepare(`
        SELECT id, filename, filepath, size
        FROM files
        WHERE id = ? AND user_id = ?
    `).get(fileId, userId);
}

function deleteFile(fileId, userId) {
    const file = getFile(fileId, userId);
    if (file) {
        db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
        return file;
    }
    return null;
}

function getUserStats(userId) {
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files WHERE user_id = ?').get(userId).count;
    const totalSize = db.prepare('SELECT SUM(size) as total FROM files WHERE user_id = ?').get(userId).total || 0;
    const lastUpload = db.prepare('SELECT MAX(uploaded_at) as last FROM files WHERE user_id = ?').get(userId).last;
    
    return {
        fileCount,
        totalSize,
        lastUpload
    };
}

initDatabase();

module.exports = {
    createLoginCode,
    verifyLoginCode,
    getOrCreateUser,
    createSession,
    getSessionUser,
    deleteSession,
    addFile,
    getUserFiles,
    getFile,
    deleteFile,
    getUserStats
};
