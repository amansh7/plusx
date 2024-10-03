import express from 'express';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});