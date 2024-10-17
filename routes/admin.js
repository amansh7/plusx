import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/AuthController.js";
import { getDashboardData } from "../controller/admin/AdminController.js";

const router = Router();

/* Admin Routes */
router.post('/login', login);
router.put('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.put('/change-password',adminAuthorization,authenticateAdmin, updatePassword);

router.get('/dashboard',adminAuthorization, authenticateAdmin, getDashboardData);



export default router;