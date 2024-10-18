import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData, riderList, riderDetails,deleteRider } from "../controller/admin/AdminController.js";

const router = Router();

/* Admin Routes */
// router.post('/login', login);
// router.put('/logout', logout);
// router.post('/forgot-password', forgotPassword);
// router.put('/change-password',adminAuthorization,authenticateAdmin, updatePassword);

// router.get('/dashboard',adminAuthorization, authenticateAdmin, getDashboardData);

// const adminRoutes = [
//     { method: 'post', path: '/login', handler: login },
//     { method: 'put', path: '/logout', handler: logout },
//     { method: 'post', path: '/forgot-password', handler: forgotPassword },
//     { method: 'put', path: '/change-password', handler: updatePassword },
//     { method: 'get', path: '/dashboard', handler: getDashboardData },
//     { method: 'get', path: '/rider-list', handler: riderList },
//     { method: 'get', path: '/rider-details', handler: riderDetails },
//     { method: 'get', path: '/delete-rider', handler: deleteRider }
// ];

// adminRoutes.forEach(({ method, path, handler }) => {
//     const middlewares = [adminAuthorization]; 

//     if (path === '/change-password' || path === '/dashboard' || path === '/signup-list') {
//         middlewares.push(authenticateAdmin);
//     }
   
//     router[method](path, ...middlewares, handler);
// });

const adminRoutes = [
    { method: 'post', path: '/login', handler: login },
    { method: 'put', path: '/logout', handler: logout },
    { method: 'post', path: '/forgot-password', handler: forgotPassword },
    { method: 'put', path: '/change-password', handler: updatePassword },
    { method: 'get', path: '/dashboard', handler: getDashboardData },
    { method: 'get', path: '/rider-list', handler: riderList },
    { method: 'get', path: '/rider-details', handler: riderDetails },
    { method: 'get', path: '/delete-rider', handler: deleteRider },
];

adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [];

    // For /login and /logout, only use adminAuthorization
    if (path === '/login' || path === '/logout') {
        middlewares.push(adminAuthorization);
    } else {
        // For all other routes, add both adminAuthorization and authenticateAdmin
        middlewares.push(adminAuthorization, authenticateAdmin);
    }

    router[method](path, ...middlewares, handler);
});





export default router;