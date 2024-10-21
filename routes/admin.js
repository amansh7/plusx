import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData, riderList, riderDetails,deleteRider } from "../controller/admin/AdminController.js";
import { chargerList, addCharger, editCharger, deleteCharger, chargerBookingList, chargerBookingDetails } from "../controller/admin/PortableChargerController.js";
import { handleFileUpload } from "../fileUpload.js";

const router = Router();


const adminAuthRoutes = [
    { method: 'post', path: '/login', handler: login },
]
adminAuthRoutes.forEach(({ method, path, handler }) => {
    router[method](path, adminAuthorization, handler);
});
const adminRoutes = [
    { method: 'put', path: '/logout', handler: logout },
    { method: 'post', path: '/forgot-password', handler: forgotPassword },
    { method: 'put', path: '/change-password', handler: updatePassword },
    { method: 'get', path: '/dashboard', handler: getDashboardData },
    { method: 'get', path: '/rider-list', handler: riderList },
    { method: 'get', path: '/rider-details', handler: riderDetails },
    { method: 'post', path: '/delete-rider', handler: deleteRider },

    //Portable Charger 
    { method: 'get', path: '/charger-list', handler: chargerList },
    { method: 'post', path: '/add-charger', handler: addCharger },
    { method: 'post', path: '/edit-charger', handler: editCharger },
    { method: 'post', path: '/delete-charger', handler: deleteCharger },


    //Portable Charger Booking
    { method: 'get', path: '/charger-booking-list', handler: chargerBookingList },
    { method: 'get', path: '/charger-booking-details', handler: chargerBookingDetails },
];

adminRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [adminAuthorization];

    // For /login and /logout, only use adminAuthorization
    // if (path === '/login' || path === '/logout') {
    //     middlewares.push(adminAuthorization);
    // } else {
    //     // For all other routes, add both adminAuthorization and authenticateAdmin
    //     middlewares.push(adminAuthorization, authenticateAdmin);
    // }

    if (path === '/add-charger' || path === '/edit-charger') {
        middlewares.push(handleFileUpload('charger-images', ['charger_image'], 1));
    }

    middlewares.push(authenticateAdmin);

    router[method](path, ...middlewares, handler);
});





export default router;