import express from 'express';
import bodyParser from 'body-parser';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());

app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});