const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRouter = require('./routes/api');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();