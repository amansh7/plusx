import { Router } from "express";
import { authenticateAdmin } from "../middleware/admin/authenticationMiddleware.js";
import { adminAuthorization } from "../middleware/admin/authorizeMiddleware.js";
import { login, logout, forgotPassword, updatePassword } from "../controller/admin/AuthController.js";
import { getDashboardData, riderList, riderDetails,deleteRider } from "../controller/admin/AdminController.js";
import { chargerList, addCharger, editCharger, deleteCharger, chargerBookingList, chargerBookingDetails, 
    invoiceList,invoiceDetails, slotList, addSlot,editSlot,deleteSlot, assignBooking,
    slotDetails} from "../controller/admin/PortableChargerController.js";
import { handleFileUpload } from "../fileUpload.js";
import { bookingDetails, bookingList, pdAddSlot, pdDeleteSlot, pdEditSlot, pdInvoiceDetails, pdInvoiceList, pdSlotList, assignBooking as pdAssignBooking, pdSlotDetails } from "../controller/admin/PickAndDropController.js";
import { addPublicCharger, editPublicCharger, stationDetail, stationList } from "../controller/admin/PublicChargerController.js";
import { chargerInstallationDetails, chargerInstallationList } from "../controller/admin/ChargerInstallationController.js";
import { 
    storeList, storeData, storeAdd, storeView, storeUpdate, storeDelete,serviceList, serviceCreate, serviceUpdate, serviceDelete, brandList, brandCreate, brandUpdate, brandDelete
} from "../controller/admin/ShopController.js";
import { rsaList, rsaData, rsaAdd, rsaUpdate, rsaDelete, rsaStatusChange,  } from "../controller/admin/RsaController.js";
import { clubList, clubData, clubCreate, clubUpdate, clubDelete, clubDeleteImg } from "../controller/admin/RiderClubController.js"

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
    { method: 'post', path: '/rider-list', handler: riderList },
    { method: 'post', path: '/rider-details', handler: riderDetails },
    { method: 'post', path: '/delete-rider', handler: deleteRider },

    //Portable Charger 
    { method: 'post', path: '/charger-list', handler: chargerList },
    { method: 'post', path: '/add-charger', handler: addCharger },
    { method: 'post', path: '/edit-charger', handler: editCharger },
    { method: 'post', path: '/delete-charger', handler: deleteCharger },

    //Portable Charger Booking
    { method: 'post', path: '/charger-booking-list', handler: chargerBookingList },
    { method: 'post', path: '/charger-booking-details', handler: chargerBookingDetails },
    { method: 'post', path: '/charger-booking-invoice-list', handler: invoiceList },
    { method: 'post', path: '/charger-booking-invoice-details', handler: invoiceDetails },
    { method: 'post', path: '/charger-booking-assign', handler: assignBooking },
    
    //Portable Charger Slot List
    { method: 'post', path: '/charger-slot-list', handler: slotList },
    { method: 'post', path: '/charger-slot-details', handler: slotDetails },
    { method: 'post', path: '/charger-add-time-slot', handler: addSlot },
    { method: 'post', path: '/charger-edit-time-slot', handler: editSlot },
    { method: 'post', path: '/charger-delete-time-slot', handler: deleteSlot },

    //Pick & Drop Booking
    { method: 'post', path: '/pick-and-drop-booking-list', handler: bookingList },
    { method: 'post', path: '/pick-and-drop-booking-details', handler: bookingDetails },
    { method: 'post', path: '/pick-and-drop-invoice-list', handler: pdInvoiceList },
    { method: 'get', path: '/pick-and-drop-invoice-details', handler: pdInvoiceDetails },
    { method: 'get', path: '/pick-and-drop-assign', handler: pdAssignBooking },

    //Pick & Drop  Slot List
    { method: 'post', path: '/pick-and-drop-slot-list', handler: pdSlotList },
    { method: 'post', path: '/pick-and-drop-slot-details', handler: pdSlotDetails },
    { method: 'post', path: '/pick-and-drop-add-slot', handler: pdAddSlot },
    { method: 'put', path: '/pick-and-drop-edit-slot', handler: pdEditSlot },
    { method: 'delete', path: '/pick-and-drop-delete-slot', handler: pdDeleteSlot },

    //Public Charger
    { method: 'post', path: '/public-charger-station-list', handler: stationList },
    { method: 'get', path: '/public-charger-station-details', handler: stationDetail },
    { method: 'post', path: '/public-charger-add-station', handler: addPublicCharger },
    { method: 'put', path: '/public-charger-edit-station', handler: editPublicCharger },

    //Public Charger
    { method: 'post', path: '/public-charger-station-list', handler: stationList },
    { method: 'get', path: '/public-charger-station-details', handler: stationDetail },
    { method: 'post', path: '/public-charger-add-station', handler: addPublicCharger },
    { method: 'put', path: '/public-charger-edit-station', handler: editPublicCharger },


    //Charger Installation
    { method: 'post', path: '/charger-installation-list', handler: chargerInstallationList },
    { method: 'post', path: '/charger-installation-details', handler: chargerInstallationDetails },
    //Charger Installation
    { method: 'post', path: '/charger-installation-list', handler: chargerInstallationList },
    { method: 'get', path: '/charger-installation-details', handler: chargerInstallationDetails },
    
    /* Service Shops */
    { method: 'get',    path: '/shop-list',           handler: storeList },
    { method: 'get',    path: '/shop-data',           handler: storeData },
    { method: 'post',   path: '/shop-add',            handler: storeAdd },
    { method: 'get',    path: '/shop-view',           handler: storeView },
    { method: 'post',   path: '/shop-update',         handler: storeUpdate },
    { method: 'delete', path: '/shop-delete',         handler: storeDelete },
    { method: 'get',    path: '/shop-service-list',   handler: serviceList },
    { method: 'post',   path: '/shop-service-create', handler: serviceCreate },
    { method: 'post',   path: '/shop-service-update', handler: serviceUpdate },
    { method: 'delete', path: '/shop-service-delete', handler: serviceDelete },
    { method: 'get',    path: '/shop-brand-list',     handler: brandList },
    { method: 'post',   path: '/shop-brand-create',   handler: brandCreate },
    { method: 'post',   path: '/shop-brand-update',   handler: brandUpdate },
    { method: 'delete', path: '/shop-brand-delete',   handler: brandDelete },

    //RSA Routes
    { method: 'get',  path: '/rsa-list',          handler: rsaList },
    { method: 'get',  path: '/rsa-data',          handler: rsaData },
    { method: 'post', path: '/rsa-add',           handler: rsaAdd },
    { method: 'post', path: '/rsa-update',        handler: rsaUpdate },
    { method: 'get',  path: '/rsa-delete',        handler: rsaDelete },
    { method: 'get',  path: '/rsa-status-change', handler: rsaStatusChange },

    /* Rider Clubs */
    { method: 'get',    path: '/club-list',       handler: clubList },
    { method: 'get',    path: '/club-data',       handler: clubData },
    { method: 'post',   path: '/add-club',        handler: clubCreate },
    { method: 'post',   path: '/edit-club',       handler: clubUpdate },
    { method: 'delete', path: '/club-delete',     handler: clubDelete },
    { method: 'delete', path: '/club-delete-img', handler: clubDeleteImg },
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
    if (path === '/shop-add' || path === '/shop-update') {
        middlewares.push(handleFileUpload('shop-images', ['cover_image', 'shop_gallery'], 5));
    }
    if (path === '/add-club' || path === '/edit-club') {
        middlewares.push(handleFileUpload('club-images', ['cover_image', 'shop_gallery'], 5));
    }

    middlewares.push(authenticateAdmin);

    router[method](path, ...middlewares, handler);
});

export default router;