import { Router } from "express";
import PDFKit from 'pdfkit';
import { jsPDF } from 'jspdf';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ejs from 'ejs';

const router = Router();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/generate-pdf-pdfkit', async (req, res) => {
    try {
        const invoiceData = {
            invoiceNumber: 'INV-1002',
            invoiceDate: new Date().toISOString().split('T')[0],
            clientName: 'John Doe Str',
            clientAddress: '1234 Main St, Springfield, USA',
            items: [
                { description: 'Product 1', quantity: 2, unitPrice: 30 },
                { description: 'Product 2', quantity: 1, unitPrice: 100 },
                { description: 'Service A', quantity: 3, unitPrice: 50 },
                { description: 'Service B', quantity: 2, unitPrice: 10 }
            ],
            totalAmount: 310
        };

        const pdfPath = await generateInvoicePDF(invoiceData);

        res.json({ pdfPath: `/files/${path.basename(pdfPath)}` });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error generating PDF');
    }
});
  
  
/* pdf test e */

/* pdf test e */


export default router;
