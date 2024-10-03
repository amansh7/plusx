import { Router } from "express";
import { login, register, forgotPassword, createOTP, verifyOTP, home  } from "../controller/api/RiderController.js";

const router = Router();

/* API Routes */
router.post('/rider-login', login);
router.post('/registration', register);
router.post('/rider-forgot_password', forgotPassword);
router.post('/create-otp', createOTP);
router.post('/verify-otp', verifyOTP);
router.post('/rider-home', home);

export default router;