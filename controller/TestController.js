import {generatePDF, numberToWords, formatNumber} from '../utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import transporter from '../mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateTemplate = async (req, resp) => {
    const result = {booking_id: 'BK-2024-01',user_name: 'John Doe',invoice_id: 'INV-2024-10-18',amount: 200.5,currency: 'USD',invoice_date: new Date(),};
    const invoiceDate = new Date(result.invoice_date).toLocaleDateString('en-US', {day: '2-digit',month: 'short',year: 'numeric',});
    resp.render('mail', {result,invoiceDate});
}

export const portableChargerInvoicePdf = async (req, resp) => {
    const data = {
        booking_id: 'NR-2024-01',
        user_name: 'John Snow',
        invoice_id: 'WIN-2024-10-18',
        amount: 200.5,
        currency: 'USD',
        invoice_date: '26-01-1990',
    };
    const htmlTemplate = path.join(__dirname, '../views/mail/portable-charger-invoice.ejs');

    try{
        const invoiceData = { data }
        const today = new Date();
        const pdfPath = path.join(__dirname,  '../public/files',`portable-charger-invoice-pdf-${today.getTime()}.pdf`);
        const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);

        await transporter.sendMail({
            from: `"Easylease Admin" <admin@easylease.com>`,
            to: 'famoney244@avzong.com',
            subject: 'Test mail - PlusX Electric App',
            html: `<html><body><h1>Hello </h1></body></html>`,
            attachments: [{
                filename: 'charger-installation-invoice.pdf',
                path: pdfPath,
                contentType: 'application/pdf'
            }]
        });
        
        return resp.json({
            message: ["Invoice send successfully"],
            pdf_path: pdfPath
        });

    }catch(err){
        console.log('Error in generating PDF', err);
    }
};

export const chargerInstallationInvoicePdf = async (req, resp) => {
    const data = {
        invoice_id: 'INV-12345',
        request_id: 'REQ-54321',
        invoice_date: '2024-10-18T10:00:00Z',
        payment_status: 'completed',
        payment_type: 'credit card',
        name: 'John Doe',
        email: 'john.doe@example.com',
        country_code: '+1',
        contact_no: '1234567890',
        company_name: 'Doe Enterprises',
        service_type: 'Premium Service',
        vehicle_model: 'Tesla Model 3',
        resident_type: 'Resident',
        no_of_charger: 2,
        address: '123 Main St, Cityville, State, 12345',
        price: 150.00,
        currency: 'AED',
    };
    
    const htmlTemplate = path.join(__dirname, '../views/mail/charger-installation-invoice.ejs');

    try{
        const invoiceData = { data, numberToWords, formatNumber }
        const today = new Date();
        const pdfPath = path.join(__dirname,  '../public/files',`charger-installation-invoice-pdf-${today.getTime()}.pdf`);
        const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);

        resp.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${pdf.pdfPath}.pdf`
        });

        resp.sendFile(pdf.pdfPath);

    }catch(err){
        console.log('Error in generating PDF', err);
    }
};

export const PreSaleInvoicePdf = async (req, resp) => {
    const data = {
        invoice_id: 'INV-12345',
        request_id: 'REQ-54321',
        invoice_date: '2024-10-18T10:00:00Z',
        payment_status: 'completed',
        payment_type: 'credit card',
        name: 'John Doe',
        email: 'john.doe@example.com',
        country_code: '+1',
        contact_no: '1234567890',
        company_name: 'Doe Enterprises',
        service_type: 'Premium Service',
        vehicle_model: 'Tesla Model 3',
        resident_type: 'Resident',
        no_of_charger: 2,
        address: '123 Main St, Cityville, State, 12345',
        price: 150.00,
        currency: 'AED',
    };

    const htmlTemplate = path.join(__dirname, '../views/mail/pre-sale-invoice.ejs');

    try{
        const invoiceData = { data, numberToWords, formatNumber }
        const today = new Date();
        const pdfPath = path.join(__dirname,  '../public/files',`pre-sale-invoice-pdf-${today.getTime()}.pdf`);
        const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);

        resp.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=${pdf.pdfPath}.pdf`
        });

        resp.sendFile(pdf.pdfPath);

    }catch(err){
        console.log('Error in generating PDF', err);
    }
};

export const pickAndDropInvoicePdf = async (req, resp) => {
    const data = {
        request_id: "BOOK-12345",
        name: "John Doe",
        invoice_date: "2024-10-18T14:30:00Z",
        invoice_id: "INV-98765",
        amount: 5000,
        currency: "USD",
    };

    const htmlTemplate = path.join(__dirname, '../views/mail/pick-and-drop-invoice.ejs');

    try{
        const invoiceData = { data, numberToWords, formatNumber }
        const today = new Date();
        const pdfPath = path.join(__dirname,  '../public/files',`pick-and-drop-invoice-pdf-${today.getTime()}.pdf`);
        const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);

        // resp.set({
        //     'Content-Type': 'application/pdf',
        //     'Content-Disposition': `inline; filename=${pdf.pdfPath}.pdf`
        // });

        // resp.sendFile(pdf.pdfPath);
        if (pdf.success) {
            await transporter.sendMail({
                from: `"Easylease Admin" <admin@easylease.com>`,
                to: 'famoney244@avzong.com',
                subject: 'Test mail - PlusX Electric App',
                html: `<html><body><h1>Hello </h1></body></html>`,
                attachments: [{
                    filename: 'charger-installation-invoice.pdf',
                    path: pdfPath,
                    contentType: 'application/pdf'
                }]
            });
            // Respond with a JSON object containing the status, message, and PDF path
            return resp.json({
                status: 1,
                message: 'PDF generated successfully!',
                pdfPath: pdfPath // Return the path to the generated PDF
            });
        } else {
            // Handle the case where PDF generation failed
            return resp.status(500).json({
                status: 0,
                message: 'Failed to generate PDF.',
                error: pdf.error // Return any error message
            });
        }
    }catch(err){
        console.log('Error in generating PDF', err);
    }
};

/*
    -> Delete Gallery Img...
    const [gallery] = await db.execute(`SELECT image_name FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);
    const galleryData = gallery.map(img => img.image_name);

    if (req.files['shop_gallery'] && galleryData.length > 0) {
        galleryData.forEach(img => img && deleteFile('charging-station-images', img));
        await db.execute(`DELETE FROM public_charging_station_gallery WHERE station_id = ?`, [station_id]);
    }
*/
