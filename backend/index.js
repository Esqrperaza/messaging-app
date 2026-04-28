const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const authToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided' });
    }
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
     } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Invalid token' });
     }
};

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'User not found' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login server error' });
    }
});

app.get('/', (req, res) =>{
    res.send('The Messenger API is running! 🚀');
});

app.get('/users', async (req, res) => {
    try{
        const results = await pool.query('SELECT * FROM users ORDER BY created_at DESC', []);
        res.json(results.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection error'});
    }
});

app.get('/users/nearby', authToken, async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Coordinates are required' });
  }

  try {
    const query = `
      SELECT *, (
        3959 * acos(
          cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + 
          sin(radians($1)) * sin(radians(lat))
        )
      ) AS distance
      FROM users
      WHERE (
        3959 * acos(
          cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + 
          sin(radians($1)) * sin(radians(lat))
        )
      ) < $3
      ORDER BY distance;
    `;

    const values = [lat, lng, radius || 25]; 
    const result = await pool.query(query, values);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Location search failed' });
  }
});

app.get('/messages/:conversationId', async (req, res) =>{
    const { conversationId } = req.params;

    try {
        const query = `
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC;
        `;
        const result = await pool.query(query, [conversationId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
app.post('/users', async (req, res) => {
    const { username, bio, age, gender, zip_code, lat, lng } =req.body;
    try {
        const query = `
            INSERT INTO users (username, bio, age, gender, zip_code, lat, lng)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const result = await pool.query(query, [username, bio, age, gender, zip_code, lat, lng]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.post('/conversations', async (req, res) => {
    const { user_one_id, user_two_id } =req.body;
    try {
        const query = `
            INSERT INTO conversations (user_one_id, user_two_id)
            VALUES ($1, $2)
            ON CONFLICT (user_one_id, user_two_id) DO UPDATE SET created_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(query, [user_one_id, user_two_id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not start conversation' });
    }
});

app.post('/auth/register', async (req, res) => {
    const { username, bio, age, zip_code, lat, lng, password} = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO users (username, bio, age, zip_code, lat, lng, password)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username;
        `;
        const result = await pool.query(query, [username, bio, age, zip_code, lat, lng, hashedPassword]);
        const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ user: result.rows[0], token});
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed'});
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User joined conversation: ${conversationId}`);
    });

    socket.on('send_message', (data) => {
        io.to(data.conversationId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});


server.listen(port, () =>{
    console.log(`Server is purring on port ${port}`);
})