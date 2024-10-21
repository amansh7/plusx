import db from "../config/db.js";
import validateFields from "../validation.js";
import {  queryDB } from '../dbUtils.js';
import { mergeParam, formatNumber } from '../utils.js';
import moment from "moment";
import Stripe from "stripe";
import dotenv from 'dotenv';
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

