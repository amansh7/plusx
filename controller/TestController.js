
import path from 'path';
import { fileURLToPath } from 'url';
import transporter from '../mailer.js';
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const bulkEmailSend = async (req, resp) => {
    const htmlFilePath = path.join(__dirname, "PlusXEmailer.html");
    const emailHtml = fs.readFileSync(htmlFilePath, "utf8");
    try { 
        await transporter.sendMail({
            from    : `"Shunya Ekai" <ravimishra2042@gmail.com>`,
            to      : 'ravi@shunyaekai.tech',
            subject : 'Test mail - PlusX Electric App',
            html    : emailHtml,
        });
        return resp.json({
            message  : "Mail send successfully",
        });

    } catch(err) {
        console.log('Error in sending mail', err);
        return resp.json({
            message  : err,
        });
        
    }
};

export const getPaymentSession = async (req, resp) => {
    
    const {rider_name, amount, currency, booking_id, building_name, street_name='', unit_no, area, emirate, screen } = mergeParam(req);

    const { isValid, errors } = validateFields(req.body, {
        rider_name  : ["required"], 
        amount      : ["required"],
        currency    : ["required"],
        booking_id    : ["required"],
        building_name : ["required"],
        unit_no       : ["required"],
        area          : ["required"],
        emirate       : ["required"],
        screen        : ["required"],
    });
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items : [
                {
                    price_data : {
                        currency     : currency,
                        product_data : { name: `This booking Id : ${booking_id} for POD Booking.` },
                        unit_amount  : amount, // $50.00
                    },
                    quantity : 1,
                },
            ],
            payment_method_options: {
                card : {
                  request_three_d_secure: "any", // Force OTP for every transaction
                },
            },
            customer_creation   : "always",
            payment_intent_data : {
                shipping: {
                    name    : rider_name,
                    address : {
                        line1       : `${building_name} ${street_name}`, //"D55-PBU - Dubai Production City",
                        city        : area,         //"Dubai Production City",
                        state       : emirate,     //"Dubai",
                        country     : "United Arab Emirates",   // ✅ Default country set to the United States
                        postal_code : unit_no,   //"D55",
                    },
                },
            },
            default_values : {
                billing_address : {
                    country : "AE", // Default Country Set to UAE
                }, 
            },
            payment_intent_data: {
                setup_future_usage: "off_session", // Forces 3D Secure authentication
            },
            mode        : "payment",
            success_url : `https://plusx.shunyaekai.com/payment-success`,   //?booking_id=${booking_id}&screen=${screen}&session_id=${session.id} 
            cancel_url  : `https://plusx.shunyaekai.com/payment-cancel`    //?screen=${screen}
            // automatic_payment_methods : { enabled: true },
        });
        // resp.json({ url: session.url });
        return resp.json({ message: ['Paymnet session'], status: 1, code: 200,  url: session.url, session_id: session.id });
    } catch (error) {
        // resp.status(500).json({ error: error.message });
        return resp.json({ message: ['Sorry this is a duplicate entry!'], status: 0, code: 200, error : error.message });
    }
} 
export const getPaymentSessionData = async (req, resp) => {
    
    const sessionId = 'cs_live_a1Oh355GEjOZjGmdQ9Rb2eRpxMhnwQ7rHyXJHzUPxzWUL2C0HfJR5LsjYt' ;
    
    try {
        const session           = await stripe.checkout.sessions.retrieve(sessionId);
        const payment_intent_id = session.payment_intent;
        console.log("Checkout Session:", session);
        
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        const charge       = await stripe.charges.retrieve(paymentIntent.latest_charge);  //payment_method       
        
        return resp.json({ payment_intent_id, charge });
    } catch (error) {
        return resp.json({ error : error.message });
    }
}