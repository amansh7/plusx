import { Router } from "express";
import { handleFileUpload } from "../fileUpload.js";
// import multer from "multer";
import { apiAuthorization } from '../middleware/apiAuthorizationMiddleware.js';
import { apiRsaAuthentication } from '../middleware/apiRsaAuthenticationMiddleware.js';

import { rsaLogin, rsaUpdatePassword, rsaForgotPassword, rsaLogout, rsaLogutAll, rsaUpdateProfile, rsaStatusChange, rsaHome, rsaBookingHistory, rsaUpdateLatLong } from '../controller/driver/RsaController.js';

import { getRsaOrderStage, orderAction } from '../controller/driver/RoadAssistanceController.js';

import { 
    rsaBookingStage, bookingAction, rejectBooking, getActivePodList, storePodChargerHistory
} from '../controller/driver/PortableChargerController.js';
import { 
    handleBookingAction, getRsaBookingStage, handleRejectBooking 
} from '../controller/driver/ChargingServiceController.js';

// import { bulkEmailSend } from '../controller/TestController.js';

const router = Router();

/* -- Api Auth Middleware -- */
const authzRoutes = [
    /* RSA */
    {method: 'post', path: '/rsa-login',           handler: rsaLogin},
    {method: 'get',  path: '/rsa-logout-all',       handler: rsaLogutAll},
    {method: 'post', path: '/rsa-forgot-password', handler: rsaForgotPassword},
    
    /* POD */
    { method: 'get', path: '/pod-list',  handler: getActivePodList },
    
    /* Vehicle Routes */
    // { method: 'get',  path: '/location-area-list',         handler: areaList },
    // { method: 'get',  path: '/reminder-sell-vehicle-list', handler: reminder_sell_vehicle_list },
    
];
authzRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [apiAuthorization];

    router[method](path, ...middlewares, handler);
});

/* -- Api Auth & Api RSA Authz Middleware -- */
const authzRsaAndAuthRoutes = [
    /* RSA */
    { method: 'get',   path: '/rsa-home',            handler: rsaHome },
    { method: 'get',   path: '/rsa-logout',          handler: rsaLogout },
    { method: 'post',  path: '/rsa-profile-change',  handler: rsaUpdateProfile },
    { method: 'post',  path: '/rsa-status-change',   handler: rsaStatusChange },
    { method: 'get',   path: '/rsa-change-password', handler: rsaUpdatePassword },
    { method: 'get',   path: '/rsa-booking-history', handler: rsaBookingHistory },
    { method: 'post',  path: '/rsa-update-lat-long', handler: rsaUpdateLatLong },

    /* Road Assitance with RSA */
    { method: 'get', path: '/rsa-order-stage',  handler: getRsaOrderStage },
    { method: 'get', path: '/order-action',     handler: orderAction },
    
    /* Charging Service */
    { method: 'post', path: '/charger-service-action', handler: handleBookingAction },
    { method: 'get',  path: '/charger-service-stage',  handler: getRsaBookingStage },
    { method: 'post', path: '/charger-service-reject', handler: handleRejectBooking },
    
    /* POD with RSA */
    { method: 'get',  path: '/portable-charger-stage',    handler: rsaBookingStage },
    { method: 'post', path: '/portable-charger-action',   handler: bookingAction },
    { method: 'post', path: '/portable-charger-reject',   handler: rejectBooking },
    { method: 'post', path: '/store-pod-charger-history', handler: storePodChargerHistory },
];
authzRsaAndAuthRoutes.forEach(({ method, path, handler }) => {

    const middlewares = [];   

    if (path === '/portable-charger-action') {
        middlewares.push(handleFileUpload('portable-charger', ['image'], 1));
        
    } else if (path === '/charger-service-action') {
        middlewares.push(handleFileUpload('pick-drop-images', ['image'], 1));
    }
    if(path === '/rsa-profile-change'){   
        middlewares.push(handleFileUpload('rsa_images', ['profile-image'], 1));
    }
    middlewares.push(apiAuthorization);
    middlewares.push(apiRsaAuthentication);

    router[method](path, ...middlewares, handler);
});
// router.post('/test-mail', bulkEmailSend);

export default router;