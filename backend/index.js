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
const path = require('path');
const multer = require('multer');

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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({storage: storage});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/auth/login', async (req, res) => {

    console.log("Login attempt received: ", req.body);
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'User not found' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            token: token, 
            userId: user.id, 
            username: user.username
        });

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

app.get('/users/nearby', async (req, res) => {
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
    try {
        const { conversationId } = req.params;

        const query = `
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC;
        `;
        const result = await pool.query(query, [conversationId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Database error fetching history:", err.message);
        res.status(500).json([]);
    }
});

app.get('/messages/inbox/:userId', async (req, res) => {
    try {
        const {userId } = req.params;
        const query = `
            WITH latest_messages AS (
                SELECT DISTINCT ON (conversation_id)
                    id,
                    conversation_id,
                    sender_id,
                    content,
                    created_at
                FROM messages
                WHERE 
                    split_part(conversation_id, '_', 1) = $1
                    OR
                    split_part(conversation_id, '_', 2) = $1
                ORDER BY conversation_id, created_at DESC
            )
                SELECT 
                    lm.conversation_id,
                    lm.content AS last_message,
                    lm.created_at AS last_message_time,
                    lm.sender_id AS last_sender_id,
                    u.id AS target_user_id,
                    u.username AS target_username,
                    u.profile_picture_url AS target_profile_picture
                FROM latest_messages lm
                -- Parse the conversation string (e.g. "1_2") to find the OTHER user's ID
                JOIN users u ON u.id = CASE 
                    WHEN split_part(lm.conversation_id, '_', 1) = $1 THEN split_part(lm.conversation_id, '_', 2)::integer
                    ELSE split_part(lm.conversation_id, '_', 1)::integer
                END
                ORDER BY lm.created_at DESC;
        `;

        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Error generating inbox:", err.message);
        res.status(500).json({ error: "Failed to load chat history inbox" });
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

app.post('/users/:userId/avatar', upload.single('avatar'), async (req, res) =>{
    try {
        const { userId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded'});
        }

        const profilePictureUrl = `/uploads/${req.file.filename}`;

        const query = `
            UPDATE users
            SET profile_picture_url = $1
            WHERE id = $2
            RETURNING id, username, profile_picture_url;
        `;
        const result = await pool.query(query, [profilePictureUrl, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'Profile picture updated successfully',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Error saving profile ppicture path:', err);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User joined conversation: ${conversationId}`);
    });

    socket.on('send_message', async (data) => {
        const { conversationId, senderId, content } = data;
        try {
            const parts = conversationId.split('_');
            const parsedSenderId = parseInt(senderId);
            const parsedRecipientId = parseInt(parts[0]) === parsedSenderId
                ? parseInt(parts[1])
                : parseInt(parts[0]);
            await pool.query(
                `
                INSERT INTO messages (conversation_id, sender_id, recipient_id, content, is_read) 
                VALUES ($1, $2, $3, $4, false);
                `,
                [conversationId, parsedSenderId, parsedRecipientId, content]
            );
            io.to(data.conversationId).emit('receive_message', {
                ...data,
                recipientId: parsedRecipientId,
                is_read: false
            });
        } catch (err){
            console.error("Error saving message:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        if (user.password !== password){
            return res.status(401).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email},
            process.env.JWT_SECRET, // changed this line
            { expiresIn: '24h'}
        );

        console.log(`User ${user.username} logged in successfully!`);
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

server.listen(port, '0.0.0.0', () =>{
    console.log(`Server is purring on port ${port}`);
})