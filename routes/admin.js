import { Router } from "express";
import { authorizeUser, authenticateAdmin } from "../middleware/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/AuthController.js";
import { appSignupList, getDashboardData } from "../controller/AdminController.js";

const router = Router();

// router.get('/dashboard', function(req, resp){
//     resp.json({message: "Hello Admin Dashboard"});
// });

/* Admin Routes */
router.post('/login', login);
router.put('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.put('/change-password',authenticateAdmin, updatePassword);

router.get('/dashboard',authenticateAdmin, getDashboardData);


export default router;