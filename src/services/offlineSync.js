// offlineSync.js

const sqlite3 = require('sqlite3').verbose();
const firebase = require('firebase/app');
require('firebase/database');

class OfflineSync {
    constructor() {
        this.db = new sqlite3.Database('offlineData.db');
        this.initDB();
        this.initFirebase();
    }

    // Initialize SQLite database
    initDB() {
        this.db.run(`CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY, value TEXT)`);
    }

    // Initialize Firebase
    initFirebase() {
        const firebaseConfig = {
            apiKey: 'YOUR_API_KEY',
            authDomain: 'YOUR_AUTH_DOMAIN',
            databaseURL: 'YOUR_DATABASE_URL',
            projectId: 'YOUR_PROJECT_ID',
            storageBucket: 'YOUR_STORAGE_BUCKET',
            messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
            appId: 'YOUR_APP_ID'
        };
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
    }

    // Save data to SQLite
    saveToLocal(id, value) {
        const stmt = this.db.prepare(`INSERT INTO data (value) VALUES (?)`);
        stmt.run(value);
        stmt.finalize();
    }

    // Sync data with Firebase
    syncWithFirebase() {
        const ref = firebase.database().ref('data');
        ref.once('value', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const childKey = childSnapshot.key;
                const childData = childSnapshot.val();
                this.saveToLocal(childKey, childData);
            });
        });
    }
}

module.exports = new OfflineSync();