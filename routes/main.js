import { Router } from "express";
import PDFKit from 'pdfkit';
import { jsPDF } from 'jspdf';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ejs from 'ejs';

const router = Router();

/* pdf test s */

const projectRoot = path.resolve();
const __filename = fileURLToPath(import.meta.url);
const filesDirectory = path.join(projectRoot, 'public', 'files');

const invoiceTemplatePath = path.join(filesDirectory, 'invoice.html');

const renderTemplate = (template, data) => {
    return template.replace(/{{(.*?)}}/g, (match, key) => {
      return data[key.trim()] || match;
    });
};

 
  
router.get('/generate-pdf-jspdf', (req, res) => {
    try {
        if (!fs.existsSync(filesDirectory)) {
            fs.mkdirSync(filesDirectory, { recursive: true });
        }
    
        const doc = new jsPDF();
    
        doc.setFontSize(16);
        doc.text('This is a PDF generated using jsPDF!', 10, 10);
        doc.setFontSize(12);
        doc.text('Here is more content for the PDF generated inside the route function.', 10, 20);
        doc.text('You can customize this content as needed.', 10, 30);
    
        const filePath = path.join(filesDirectory, 'output-jspdf.pdf');
    
        const pdfOutput = doc.output('arraybuffer');
    
        fs.writeFile(filePath, Buffer.from(pdfOutput), (err) => {
            if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error saving PDF with jsPDF' });
            }
    
            const fullUrl = `${req.protocol}://${req.get('host')}/files/output-jspdf.pdf`;
            res.status(200).json({
            message: 'PDF generated successfully!',
            filePath: fullUrl,
            });
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error generating PDF with jsPDF' });
    }
});
  
/* pdf test e */


export default router;
