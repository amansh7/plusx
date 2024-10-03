import { Router } from "express";
import { login, forgotPassword, updatePassword } from "../controller/AuthController.js";

const router = Router();

router.get('/dashboard', function(req, resp){
    resp.json({message: "Hello Admin Dashboard"});
});

/* Admin Routes */
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/change-password', updatePassword);

export default router;