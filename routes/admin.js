import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData, riderList, riderDetails,deleteRider } from "../controller/admin/AdminController.js";
import { chargerList, addCharger, editCharger, deleteCharger, chargerBookingList, chargerBookingDetails, 
    invoiceList,invoiceDetails, slotList, addSlot,editSlot,deleteSlot} from "../controller/admin/PortableChargerController.js";
import { handleFileUpload } from "../fileUpload.js";
import { bookingDetails, bookingList, pdAddSlot, pdDeleteSlot, pdEditSlot, pdInvoiceDetails, pdInvoiceList, pdSlotList } from "../controller/admin/PickAndDropController.js";
import { stationDetail, stationList } from "../controller/admin/PublicChargerController.js";

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
    { method: 'get', path: '/charger-booking-invoice-list', handler: invoiceList },
    { method: 'get', path: '/charger-booking-invoice-details', handler: invoiceDetails },

    //Portable Charger Slot List
    { method: 'get', path: '/charger-slot-list', handler: slotList },
    { method: 'post', path: '/charger-add-time-slot', handler: addSlot },
    { method: 'put', path: '/charger-edit-time-slot', handler: editSlot },
    { method: 'delete', path: '/charger-delete-time-slot', handler: deleteSlot },


     //Pick & Drop Booking
     { method: 'get', path: '/pick-and-drop-booking-list', handler: bookingList },
     { method: 'get', path: '/pick-and-drop-booking-details', handler: bookingDetails },
     { method: 'get', path: '/pick-and-drop-invoice-list', handler: pdInvoiceList },
     { method: 'get', path: '/pick-and-drop-invoice-details', handler: pdInvoiceDetails },

      //Pick & Drop  Slot List
     { method: 'get', path: '/pick-and-drop-slot-list', handler: pdSlotList },
     { method: 'post', path: '/pick-and-drop-add-slot', handler: pdAddSlot },
     { method: 'put', path: '/pick-and-drop-edit-slot', handler: pdEditSlot },
     { method: 'delete', path: '/pick-and-drop-delete-slot', handler: pdDeleteSlot },


     //Public Charger
     { method: 'get', path: '/public-charger-station-list', handler: stationList },
     { method: 'get', path: '/public-charger-station-details', handler: stationDetail },
    
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