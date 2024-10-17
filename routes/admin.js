import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData } from "../controller/admin/AdminController.js";

const router = Router();

/* Admin Routes */
// router.post('/login', login);
// router.put('/logout', logout);
// router.post('/forgot-password', forgotPassword);
// router.put('/change-password',adminAuthorization,authenticateAdmin, updatePassword);

// router.get('/dashboard',adminAuthorization, authenticateAdmin, getDashboardData);

const adminRoutes = [
    { method: 'post', path: '/login', handler: login },
    { method: 'put', path: '/logout', handler: logout },
    { method: 'post', path: '/forgot-password', handler: forgotPassword },
    { method: 'put', path: '/change-password', handler: updatePassword },
    { method: 'get', path: '/dashboard', handler: getDashboardData }
];

adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [adminAuthorization, authenticateAdmin]; // Common middlewares for all admin routes

    if (path === '/change-password') {
        // Add any extra middlewares specific to certain routes
        middlewares.push(authenticateAdmin);
    }

    // Apply middlewares and route handlers
    router[method](path, ...middlewares, handler);
});




export default router;