import express from 'express';
import bodyParser from 'body-parser';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import webRoutes from './routes/web.js';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import dotenv from 'dotenv';
dotenv.config();
import { Server } from 'socket.io'

const app  = express();
const PORT = process.env.PORT || 3333;
// const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin : [
        'http://192.168.1.87:3000',
        'http://192.168.1.30:3000',
        'http://192.168.1.30:8000',
        'http://192.168.1.7:3333',
        'http://192.168.1.53:3000',
        'http://192.168.1.25:3000',
        'http://192.168.1.53:3333',
        'http://192.168.1.38:1112',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://192.168.1.21:1112',
        'http://192.168.1.87:3434',
        'http://192.168.1.19:3000',
        'http://192.168.1.38:3434/',
        'http://localhost:1112',
        'http://localhost:8000/',
        'https://plusx.shunyaekai.com/',
        'https://plusxmail.shunyaekai.com/',
        'http://localhost:1113',
        'https://plusx.shunyaekai.com/'
    ],
    // origin : "*",
    methods: 'GET, POST, PUT, DELETE',
    credentials: true
};

app.use(cors(corsOptions));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());


// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/web', webRoutes);

// React build
app.use(express.static(path.join(__dirname, 'build')));
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use(errorHandler);

const server =app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
// app.listen(PORT, ()=>{
//     console.log(`Server is running on port ${PORT}`);
// });

const io = new Server(server, {
    cors: corsOptions // Reuse the corsOptions object here
  });

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
  
    // Send a notification event
    setInterval(() => {
      socket.emit('desktop-notification', {
        title: 'Reminder',
        message: `Hello, this is a notification at ${new Date().toLocaleTimeString()}`,
      });
    }, 300000); // Every 5 min 
  
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });