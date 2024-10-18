import express from 'express';
import bodyParser from 'body-parser';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import {portableChargerInvoicePdf, chargerInstallationInvoicePdf, PreSaleInvoicePdf, pickAndDropInvoicePdf} from './controller/TestController.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

/* test routes s*/
app.get('/test', (req, resp) => {
    
    return resp.json({ text: 'txt' });
});
app.get('/generate-pdf', portableChargerInvoicePdf);
app.get('/generate-pdf-ci', chargerInstallationInvoicePdf);
app.get('/generate-pdf-ps', PreSaleInvoicePdf);
app.get('/generate-pdf-pnd', pickAndDropInvoicePdf);
/* test routes e*/

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});