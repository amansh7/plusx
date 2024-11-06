import express from 'express';
import bodyParser from 'body-parser';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3333;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin: [
        'http://192.168.1.21:1112',
        'http://192.168.1.87:3434',
        'http://localhost:1112',
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

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});