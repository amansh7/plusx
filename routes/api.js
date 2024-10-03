import { Router } from "express";
import { login, register, forgotPassword, createOTP, verifyOTP, home, getRiderData, updateProfile, logout, updatePassword, locationList, notificationList  } from "../controller/api/RiderController.js";

const router = Router();

/* API Routes */
router.post('/rider-login', login);
router.post('/registration', register);
router.post('/rider-forgot_password', forgotPassword);
router.post('/create-otp', createOTP);
router.post('/verify-otp', verifyOTP);
router.post('/location-list', locationList);

/* -- Api Auth & Api Authz middleware -- */
router.post('/rider-home', home);
router.post('/get-rider-data', getRiderData);
router.post('/rider-profile-change', updateProfile);
router.post('/rider-logout', logout);
router.post('/rider-change_password', updatePassword);
router.post('/rider-notification-list', notificationList);

export default router;