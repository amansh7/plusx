import db from "../config/db.js";
import validateFields from "../validation.js";
import {  queryDB } from '../dbUtils.js';
import { mergeParam, formatNumber } from '../utils.js';
import moment from "moment";
import Stripe from "stripe";
import dotenv from 'dotenv';
import generateUniqueId from "generate-unique-id";
dotenv.config();


export const createIntent = async (req, resp) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const {rider_name, rider_email,amount, currency } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_name: ["required"], 
        rider_email: ["required"],
        amount: ["required"],
        currency: ["required"],
    });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });

    try{
        const customer = await stripe.customers.create({
            name: rider_name,
            address: {
                line1: "476 Yudyog Vihar Phase - V",
                postal_code: "122016",
                city: "Gurugram",
                state: "Haryana",
                country: "IND",
            },
            email: rider_email,
        });
        
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            {apiVersion: '2024-04-10'}
        );

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount < 200 ? 200 : Math.floor(amount),
            currency: currency,
            customer: customer.id,
            automatic_payment_methods: {
                enabled: false,
            },
            payment_method_types: ["card"],
            use_stripe_sdk: true,
            payment_method_options: {
                card: {
                    request_three_d_secure: 'any',
                },
            },
        });

        const returnData = {
            paymentIntentId: paymentIntent.id,
            paymentIntentSecret: paymentIntent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customer.id,
            publishableKey: process.env.STRIPE_PUBLISER_KEY,
        };
    
        return resp.json({
            message: ["Payment Intent Created successfully!"],
            data: returnData,
            status: 1,
            code: 200,
        });
    }catch (err) {
        console.error('Error creating payment intent:', err);
        return resp.status(500).json({
            message: ["Error creating payment intent"],
            error: err.message,
            status: 0,
            code: 500,
        });
    }
};

export const redeemCoupon = async (req, resp) => {
    const {rider_id, amount,booking_type, coupon_code } = mergeParam(req);
    
    const { isValid, errors } = validateFields(mergeParam(req), {
        rider_id: ["required"], 
        amount: ["required"],
        booking_type: ["required"],
        coupon_code: ["required"],
    });
    
    const [[{ count }]] = await db.execute('SELECT COUNT(*) AS count FROM coupon WHERE coupan_code = ?',[coupon_code]);
    
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    if (count === 0) return resp.json({ status: 0, code: 422, message: ['The coupon code you entered does not exist in our records.'] });

    const coupon = await queryDB(`
        SELECT
            coupan_percentage, end_date, user_per_user, status, booking_for, 
            (SELECT count(id) FROM coupon_usage AS cu WHERE cu.coupan_code = coupon.coupan_code AND user_id = ?) as use_count
        FROM coupon
        WHERE coupan_code = ?
        LIMIT 1
    `, [rider_id, coupon_code]); 

    if (moment(coupon.end_date).isBefore(moment(), 'day') || coupon.status < 1){
        return resp.json({ errors: {coupon_code: ["Coupon is invalid or expired."]} });
    }else if(coupon.booking_for != booking_type){
        return resp.json({ errors: {booking_type: ["Coupon code is invalid for this booking type."]} });
    }else if(coupon.use_count >= coupon.user_per_user){
        return resp.json({ errors: {coupon_code: ["Coupon per user limit exceeded."]} });
    }

    const disAmount = (amount * coupon.coupan_percentage)/100;
    const finalAmount = amount - disAmount;
    console.log(`Discount Amount: ${disAmount.toFixed(2)}`); // Log the discount amount
    console.log(`Final Amount: ${finalAmount.toFixed(2)}`);

    return resp.json({
        message: [""],
        data: formatNumber(finalAmount),
        discount: formatNumber(disAmount),
        status: 1,
        code: 200
    });
};

export const createPortableChargerSubscription = async (req, resp) => {
    const {rider_id, request_id, payment_intent_id } = mergeParam(req);
    const { isValid, errors } = validateFields(mergeParam(req), {rider_id: ["required"] });
    if (!isValid) return resp.json({ status: 0, code: 422, message: errors });
    const currDate = moment().format('YYYY-MM-DD');
    const endDate = moment().add(30, 'days').format('YYYY-MM-DD');
    const count = await queryDB(`SELECT COUNT(*) as count FROM portable_charger_subscriptions WHERE rider_id=? AND total_booking < 10 AND expiry_date > ?`,[rider_id, currDate]);
    if(count > 0) return resp.json({status:1, code:200, message: ["You have alredy Subscription plan"]});
    
    const subscriptionId = `PCS-${generateUniqueId({length:12})}`;
    
    const createObj = {
        subscription_id: subscriptionId,
        rider_id: rider_id,
        amount: 0,
        expiry_date: endDate,
        booking_limit: 10,
        total_booking: 0,
        status: 1,
        payment_date: moment().format('YYYY-MM-DD HH:mm:ss'),
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
    const insert = await insertRecord('portable_charger_subscriptions', columns, values);

    const data = await queryDB(`
        SELECT 
            rider_email, rider_name
        FROM 
            portable_charger_subscriptions AS pcs
        LEFT JOIN
            riders AS r
        ON 
            r.rider_id = portable_charger_subscriptions.rider_id
        WHERE 
            pcs.subscription_id = ?
        LIMIT 1
    `, [subscriptionId]);
    const html = `<html>
        <body>
            <h4>Dear ${data.rider_name},</h4>
            <p>Thank you for subscribing to our EV Charging Plan with PlusX Electric App! We're excited to support your electric vehicle needs.</p>

            <p>Subscription Details: </p>

            <p>Plan: 10 EV Charging Sessions </p>
            <p>Duration: 30 days  </p>
            <p>Total Cost: 750 AED </p>

            <p>Important Information:</p>

            <p>Subscription Start Date: ${currDate}</p>
            <p>Subscription End Date: ${endDate}</p>

            <p>You can use your 10 charging sessions any time within the 30-day period. If you have any questions or need assistance, please do not hesitate to contact our support team.</p>

            <p>Thank you for choosing PlusX. We're committed to providing you with top-notch service and support.</p>

            <p> Best regards,<br/> PlusX Electric App Team </p>
        </body>
    </html>`;

    emailQueue.addEmail(data.rider_email, 'PlusX Electric App: Charging Subscription Confirmation', html);
    
    return resp.json({status:1, code:200, message: ["Your PlusX subscription is active! Start booking chargers for your EV now."]});
};
