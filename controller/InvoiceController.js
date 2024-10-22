import { generatePDF, numberToWords, formatNumber, mergeParam } from '../utils.js';
import db from "../config/db.js";
import validateFields from "../validation.js";
import path from 'path';
import { fileURLToPath } from 'url';
import transporter from '../mailer.js';
import Stripe from "stripe";
import dotenv from 'dotenv';
import { insertRecord, queryDB } from '../dbUtils.js';
import moment from 'moment/moment.js';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rsaInvoice = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"], /* payment_intent_id: ["required"] */ });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoiceId = request_id.replace('RAO', 'INVR');
    
    const createObj = {
        invoice_id: invoiceId,
        request_id: request_id,
        rider_id: rider_id,
        invoice_date: moment().format('YYYY-MM-DD HH:mm:ss'),
    }
    
    if(payment_intent_id && payment_intent_id.trim() != '' ){
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
        const cardData = {
            brand:     charge.payment_method_details.card.brand,
            country:   charge.payment_method_details.card.country,
            exp_month: charge.payment_method_details.card.exp_month,
            exp_year:  charge.payment_method_details.card.exp_year,
            last_four: charge.payment_method_details.card.last4,
        };

        createObj.amount = charge.amount;  
        createObj.payment_intent_id = charge.payment_intent;  
        createObj.payment_method_id = charge.payment_method;  
        createObj.payment_cust_id = charge.customer;  
        createObj.charge_id = charge.id;  
        createObj.transaction_id = charge.payment_method_details.card.three_d_secure?.transaction_id || null;  
        createObj.payment_type = charge.payment_method_details.type;  
        createObj.payment_status = charge.status;  
        createObj.currency = charge.currency;  
        createObj.invoice_date = moment(charge.created).format('YYYY-MM-DD HH:mm:ss');
        createObj.receipt_url = charge.receipt_url;
        createObj.card_data = cardData;
    }

    const columns = Object.keys(createObj);
    const values = Object.values(createObj);
    const insert = await insertRecord('road_assistance_invoice', columns, values);

    const data = await queryDB(`
        SELECT 
            rai.invoice_id, rai.amount AS price, rai.payment_status, rai.invoice_date, rai.currency, rai.payment_type, rai.rider_id,
            r.name, r.country_code, r.contact_no, r.types_of_issue, r.pickup_address, r.drop_address, r.request_id,
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = rai.rider_id) AS rider_email
        FROM 
            road_assistance_invoice AS rai
        LEFT JOIN
            road_assistance AS r
        ON 
            r.request_id = rai.request_id
        WHERE 
            rai.invoice_id = ?
        LIMIT 1
    `, [invoiceId]);
    const htmlTemplate = path.join(__dirname, '../views/mail/road-assistance-invoice.ejs');
    const invoiceData = { data, numberToWords, formatNumber }
    const pdfPath = path.join(__dirname,  '../public/road-side-invoice',`${invoiceId}-invoice.pdf`);
    const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);
    
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'aman@shunyaekai.tech',
        subject: 'Roadside Assistance Booking Invoice - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${data.name}</h4>
                <p>Thank you for choosing PlusX Electric's Road Side Assistance. We are pleased to inform you that your booking has been successfully completed. Please find your invoice attached to this email.</p> 
                <p> Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`,
        attachments: [{
            filename: `${invoiceId}-invoice.pdf`, path: pdfPath, contentType: 'application/pdf'
        }]
    });
    
    if(insert.affectedRows > 0 && pdf.success){
        resp.json({ message: ["Invoice created successfully!"], status:1, code:200 });
    }else{
        return resp.json({ message: ["Oops! Something went wrong! Please Try Again."], status:0, code:200 });
    }
};

export const pickAndDropInvoice = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id = '' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"], /* payment_intent_id: ["required"] */  });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoiceId = request_id.replace('CS', 'INVCS');

    const createObj = {
        invoice_id: invoiceId,
        request_id: request_id,
        rider_id: rider_id,
        invoice_date: moment().format('YYYY-MM-DD HH:mm:ss'),
    }

    if(payment_intent_id && payment_intent_id.trim() != '' ){
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
        const cardData = {
            brand:     charge.payment_method_details.card.brand,
            country:   charge.payment_method_details.card.country,
            exp_month: charge.payment_method_details.card.exp_month,
            exp_year:  charge.payment_method_details.card.exp_year,
            last_four: charge.payment_method_details.card.last4,
        };

        createObj.amount = charge.amount;  
        createObj.payment_intent_id = charge.payment_intent;  
        createObj.payment_method_id = charge.payment_method;  
        createObj.payment_cust_id = charge.customer;  
        createObj.charge_id = charge.id;  
        createObj.transaction_id = charge.payment_method_details.card.three_d_secure?.transaction_id || null;  
        createObj.payment_type = charge.payment_method_details.type;  
        createObj.payment_status = charge.status;  
        createObj.currency = charge.currency;  
        createObj.invoice_date = moment(charge.created).format('YYYY-MM-DD HH:mm:ss');
        createObj.receipt_url = charge.receipt_url;
        createObj.card_data = cardData;
    }

    const columns = Object.keys(createObj);
    const values = Object.values(createObj);
    const insert = await insertRecord('charging_service_invoice', columns, values);

    const data = await queryDB(`
        SELECT 
            csi.invoice_id, csi.amount, csi.invoice_date, csi.currency, cs.name, cs.request_id,
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = csi.rider_id) AS rider_email
        FROM 
            charging_service_invoice AS csi
        LEFT JOIN
            charging_service AS cs ON cs.request_id = csi.request_id
        WHERE 
            csi.invoice_id = ?
        LIMIT 1
    `, [invoiceId]);
    const htmlTemplate = path.join(__dirname, '../views/mail/pick-and-drop-invoice.ejs');
    const invoiceData = { data, numberToWords, formatNumber }
    const pdfPath = path.join(__dirname,  '../public/pick-drop-invoice',`${invoiceId}-invoice.pdf`);
    const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);
    
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'aman@shunyaekai.tech',
        // to: data.rider_email,
        subject: 'Your Pick & Drop Booking Invoice - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${data.name}</h4>
                <p>Thank you for choosing PlusX Electric's Valet Charging service. We are pleased to inform you that your booking has been successfully completed. Please find your invoice attached to this email.</p> 
                <p>Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`,
        attachments: [{
            filename: `${invoiceId}-invoice.pdf`, path: pdfPath, contentType: 'application/pdf'
        }]
    });
    
    if(insert.affectedRows > 0 && pdf.success){
        resp.json({ message: ["Pick & Drop Invoice created successfully!"], status:1, code:200 });
    }else{
        return resp.json({ message: ["Oops! Something went wrong! Please Try Again."], status:0, code:200 });
    }
};

export const portableChargerInvoice = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id = '' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"], /* payment_intent_id: ["required"] */ });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoiceId = request_id.replace('PCB', 'INVPC');

    const createObj = {
        invoice_id: invoiceId,
        request_id: request_id,
        rider_id: rider_id,
        invoice_date: moment().format('YYYY-MM-DD HH:mm:ss'),
    }

    if(payment_intent_id && payment_intent_id.trim() != '' ){
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
        const cardData = {
            brand:     charge.payment_method_details.card.brand,
            country:   charge.payment_method_details.card.country,
            exp_month: charge.payment_method_details.card.exp_month,
            exp_year:  charge.payment_method_details.card.exp_year,
            last_four: charge.payment_method_details.card.last4,
        };

        createObj.amount = charge.amount;  
        createObj.payment_intent_id = charge.payment_intent;  
        createObj.payment_method_id = charge.payment_method;  
        createObj.payment_cust_id = charge.customer;  
        createObj.charge_id = charge.id;  
        createObj.transaction_id = charge.payment_method_details.card.three_d_secure?.transaction_id || null;  
        createObj.payment_type = charge.payment_method_details.type;  
        createObj.payment_status = charge.status;  
        createObj.currency = charge.currency;  
        createObj.invoice_date = moment(charge.created).format('YYYY-MM-DD HH:mm:ss');
        createObj.receipt_url = charge.receipt_url;
        createObj.card_data = cardData;
    }

    const columns = Object.keys(createObj);
    const values = Object.values(createObj);
    const insert = await insertRecord('portable_charger_invoice', columns, values);

    const data = await queryDB(`
        SELECT 
            pci.invoice_id, pci.amount, pci.invoice_date, pci.currency, 
            pcb.user_name, pcb.booking_id
            (SELECT rd.rider_email FROM riders AS rd WHERE rd.rider_id = pci.rider_id) AS rider_email
        FROM 
            portable_charger_invoice AS pci
        LEFT JOIN
            portable_charger_booking AS pcb ON pcb.request_id = pci.request_id
        WHERE 
            pci.invoice_id = ?
        LIMIT 1
    `, [invoiceId]);
    const htmlTemplate = path.join(__dirname, '../views/mail/portable-charger-invoice.ejs');
    const invoiceData = { data, numberToWords, formatNumber }
    const pdfPath = path.join(__dirname,  '../public/portable-charger-invoice',`${invoiceId}-invoice.pdf`);
    const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);
    
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'aman@shunyaekai.tech',
        // to: data.rider_email,
        subject: 'Your Portable Charger Booking Invoice - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${data.name}</h4>
                <p>Thank you for choosing PlusX Electric's Portable Charger. We are pleased to inform you that your booking has been successfully completed. Please find your invoice attached to this email.</p> 
                <p> Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`,
        attachments: [{
            filename: `${invoiceId}-invoice.pdf`, path: pdfPath, contentType: 'application/pdf'
        }]
    });
    
    if(insert.affectedRows > 0 && pdf.success){
        resp.json({ message: ["Portable Charger Invoice created successfully!"], status:1, code:200 });
    }else{
        return resp.json({ message: ["Oops! Something went wrong! Please Try Again."], status:0, code:200 });
    }
};

export const preSaleTestingInvoice = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id = '' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"], /* payment_intent_id: ["required"] */ });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoiceId = request_id.replace('PCB', 'INVPC');

    const createObj = {
        invoice_id: invoiceId,
        request_id: request_id,
        rider_id: rider_id,
        invoice_date: moment().format('YYYY-MM-DD HH:mm:ss'),
    }

    if(payment_intent_id && payment_intent_id.trim() != '' ){
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
        const cardData = {
            brand:     charge.payment_method_details.card.brand,
            country:   charge.payment_method_details.card.country,
            exp_month: charge.payment_method_details.card.exp_month,
            exp_year:  charge.payment_method_details.card.exp_year,
            last_four: charge.payment_method_details.card.last4,
        };

        createObj.amount = charge.amount;  
        createObj.payment_intent_id = charge.payment_intent;  
        createObj.payment_method_id = charge.payment_method;  
        createObj.payment_cust_id = charge.customer;  
        createObj.charge_id = charge.id;  
        createObj.transaction_id = charge.payment_method_details.card.three_d_secure?.transaction_id || null;  
        createObj.payment_type = charge.payment_method_details.type;  
        createObj.payment_status = charge.status;  
        createObj.currency = charge.currency;  
        createObj.invoice_date = moment(charge.created).format('YYYY-MM-DD HH:mm:ss');
        createObj.receipt_url = charge.receipt_url;
        createObj.card_data = cardData;
    }

    const columns = Object.keys(createObj);
    const values = Object.values(createObj);
    const insert = await insertRecord('ev_pre_sale_testing_invoice', columns, values);

    const data = await queryDB(`
        SELECT 
            psti.invoice_id, psti.amount as price, psti.payment_status, psti.invoice_date, psti.currency, psti.payment_type,  
            evsl.owner_name, evsl.country_code, evsl.mobile_no, evsl.email, evsl.vehicle, evsl.pickup_address, evsl.booking_id, evsl.slot_date, evsl.slot_time_id, 
            (SELECT CONCAT(vehicle_make, "-", vehicle_model) FROM riders_vehicles AS rv WHERE rv.vehicle_id = evsl.vehicle) AS vehicle_data
        FROM 
            ev_pre_sale_testing_invoice AS psti
        LEFT JOIN
            ev_pre_sale_testing AS evsl ON evsl.booking_id = psti.request_id
        WHERE 
            psti.invoice_id = ?
        LIMIT 1
    `, [invoiceId]);
    const htmlTemplate = path.join(__dirname, '../views/mail/ev-pre-sale-invoice.ejs');
    const invoiceData = { data, numberToWords, formatNumber }
    const pdfPath = path.join(__dirname,  '../public/ev-pre-sale-invoice',`${invoiceId}-invoice.pdf`);
    const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);
    
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'aman@shunyaekai.tech',
        // to: data.rider_email,
        subject: 'Your EV-pre Sale Booking Booking Invoice - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${data.owner_name}</h4>
                <p>Thank you for choosing PlusX Electric's EV-pre sale testing. We are pleased to inform you that your booking has been successfully completed. Please find your invoice attached to this email.</p> 
                <p> Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`,
        attachments: [{
            filename: `${invoiceId}-invoice.pdf`, path: pdfPath, contentType: 'application/pdf'
        }]
    });
    
    if(insert.affectedRows > 0 && pdf.success){
        resp.json({ message: ["Pre-sale Testing Invoice created successfully!"], status:1, code:200 });
    }else{
        return resp.json({ message: ["Oops! Something went wrong! Please Try Again."], status:0, code:200 });
    }
};

export const chargerInstallationInvoice = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id = '' } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"], request_id: ["required"], /* payment_intent_id: ["required"] */ });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    const invoiceId = request_id.replace('CIS', 'INVCIS');

    const createObj = {
        invoice_id: invoiceId,
        request_id: request_id,
        rider_id: rider_id,
        invoice_date: moment().format('YYYY-MM-DD HH:mm:ss'),
    }

    if(payment_intent_id && payment_intent_id.trim() != '' ){
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
        const cardData = {
            brand:     charge.payment_method_details.card.brand,
            country:   charge.payment_method_details.card.country,
            exp_month: charge.payment_method_details.card.exp_month,
            exp_year:  charge.payment_method_details.card.exp_year,
            last_four: charge.payment_method_details.card.last4,
        };

        createObj.amount = charge.amount;  
        createObj.payment_intent_id = charge.payment_intent;  
        createObj.payment_method_id = charge.payment_method;  
        createObj.payment_cust_id = charge.customer;  
        createObj.charge_id = charge.id;  
        createObj.transaction_id = charge.payment_method_details.card.three_d_secure?.transaction_id || null;  
        createObj.payment_type = charge.payment_method_details.type;  
        createObj.payment_status = charge.status;  
        createObj.currency = charge.currency;  
        createObj.invoice_date = moment(charge.created).format('YYYY-MM-DD HH:mm:ss');
        createObj.receipt_url = charge.receipt_url;
        createObj.card_data = cardData;
    }

    const columns = Object.keys(createObj);
    const values = Object.values(createObj);
    const insert = await insertRecord('portable_charger_invoice', columns, values);

    const data = await queryDB(`
        SELECT 
            cii.invoice_id, cii.amount AS price, cii.payment_status, cii.invoice_date, cii.currency, cii.payment_type, 
            ci.name, ci.country_code, ci.contact_no, ci.email, ci.request_id, ci.service_type, ci.company_name, ci.resident_type, 
            ci.address, ci.vehicle_model, ci.no_of_charger
        FROM 
            charging_installation_invoice AS cii
        LEFT JOIN
            charging_installation_service AS ci ON cii.request_id = ci.request_id
        WHERE 
            pci.invoice_id = ?
        LIMIT 1
    `, [invoiceId]);
    const htmlTemplate = path.join(__dirname, '../views/mail/charger-installation-invoice.ejs');
    const invoiceData = { data, numberToWords, formatNumber }
    const pdfPath = path.join(__dirname,  '../public/charger-installation-invoice',`${invoiceId}-invoice.pdf`);
    const pdf = await generatePDF(invoiceData, htmlTemplate, pdfPath, req);
    
    await transporter.sendMail({
        from: `"Easylease Admin" <admin@easylease.com>`,
        to: 'aman@shunyaekai.tech',
        // to: data.rider_email,
        subject: 'Your Charging Installation Booking Invoice - PlusX Electric App',
        html: `<html>
            <body>
                <h4>Dear ${data.name}</h4>
                <p>Thank you for choosing PlusX Electric's Charging Installation. We are pleased to inform you that your booking has been successfully completed. Please find your invoice attached to this email.</p> 
                <p> Regards,<br/> PlusX Electric App Team </p>
            </body>
        </html>`,
        attachments: [{
            filename: `${invoiceId}-invoice.pdf`, path: pdfPath, contentType: 'application/pdf'
        }]
    });
    
    if(insert.affectedRows > 0 && pdf.success){
        resp.json({ message: ["Charger Installation Invoice created successfully!"], status:1, code:200 });
    }else{
        return resp.json({ message: ["Oops! Something went wrong! Please Try Again."], status:0, code:200 });
    }
};