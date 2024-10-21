import { Router } from "express";
import { 
    login, register, forgotPassword, createOTP, verifyOTP, home, getRiderData, updateProfile, deleteImg, logout, updatePassword, locationList, 
    notificationList, addRiderAddress, riderAddressList, deleteRiderAddress, deleteAccount, addRiderVehicle ,editRiderVehicle, riderVehicleList, deleteRiderVehicle
} from "../controller/api/RiderController.js";
import {stationList, stationDetail, nearestChargerList} from '../controller/api/ChargingStationController.js';
import {carList, carDetail} from '../controller/api/ElectricCarRentalController.js';
import {bikeList, bikeDetail} from '../controller/api/ElectricBikeRentalController.js';
import {
    addRoadAssistance, roadAssistanceList, roadAssistanceDetail, roadAssistanceInvoiceList, roadAssistanceInvoiceDetail, getRsaOrderStage, orderAction
} from '../controller/api/RoadAssistanceController.js';
import {serviceRequest, requestList, requestDetails} from '../controller/api/ChargingInstallationServiceController.js';
import {clubList, clubDetail } from '../controller/api/ClubController.js';
import {vehicleList, vehicleDetail, interestedPeople, areaList, sellVehicle, allSellVehicleList, sellVehicleList, sellVehicleDetail, 
    updateSellVehicle, deleteSellVehicle, soldSellVehicle, reminder_sell_vehicle_list, vehicleModelList, vehicleBrandList
} from '../controller/api/VehicleController.js';
import {offerList, offerDetail} from '../controller/api/OfferController.js';
import {shopList, shopDetail} from '../controller/api/ShopController.js';
import {chargerList, chargerBooking, chargerBookingList,chargerBookingDetail, invoiceList, rsaBookingStage, bookingAction, rejectBooking} from '../controller/api/PortableChargerController.js';
import { getChargingServiceSlotList, requestService, listServices, getServiceOrderDetail, getInvoiceList, getInvoiceDetail, handleBookingAction, getRsaBookingStage, handleRejectBooking } from '../controller/api/ChargingServiceController.js';
import { addInsurance, insuranceList, insuranceDetails, evPreSaleBooking, evPreSaleList, evPreSaleDetails, preSaleSlotList} from '../controller/api/EvInsuranceController.js';
import { 
    addDiscussionBoard, getDiscussionBoardList, getDiscussionBoardDetail, addComment, replyComment, boardLike, boardView, boardShare, votePoll, 
    reportOnBoard, boardNotInterested, boardDelete, editBoard, editPoll, deleteComment, deleteReplyComment, commentLike, replyCommentLike
} from '../controller/api/DiscussionBoardController.js';
import { redeemCoupon, createIntent } from '../controller/PaymentController.js';
import { rsaInvoice, pickAndDropInvoice, portableChargerInvoice, preSaleTestingInvoice, chargerInstallationInvoice } from '../controller/InvoiceController.js';
import { apiAuthorization } from '../middleware/apiAuthorizationMiddleware.js';
import { apiAuthentication } from '../middleware/apiAuthenticationMiddleware.js';
import { apiRsaAuthentication } from '../middleware/apiRsaAuthenticationMiddleware.js';
import { handleFileUpload } from "../fileUpload.js";
import multer from "multer";

const router = Router();

router.post('/validate-coupon', redeemCoupon);
router.post('/payment-intent', createIntent);
//invoice related route -> authzAndAuthRoutes
router.post('/create-rsa-invoice', rsaInvoice);
router.post('/create-pick-drop-invoice', pickAndDropInvoice);
router.post('/create-portable-charger-invoice', portableChargerInvoice);
router.post('/create-pre-sale-invoice', preSaleTestingInvoice);
router.get('/create-charger-installation-invoice', chargerInstallationInvoice);


/* -- Api Auth Middleware -- */
const authzRoutes = [
    /* API Routes */
    {method: 'post', path: '/rider-login', handler: login},
    {method: 'post', path: '/registration', handler: register},
    {method: 'post', path: '/rider-forgot_password', handler: forgotPassword},
    {method: 'post', path: '/create-otp', handler: createOTP},
    {method: 'post', path: '/verify-otp', handler: verifyOTP},
    
    /* Dynamic List */
    {method: 'get', path: '/location-list', handler: locationList},
    
    /* Vehicle Routes */
    { method: 'get', path: '/location-area-list', handler: areaList },
    { method: 'get', path: '/reminder-sell-vehicle-list', handler: reminder_sell_vehicle_list },
    { method: 'post', path: '/vehicle-brand-list', handler: vehicleBrandList },
    { method: 'post', path: '/vehicle-model-list', handler: vehicleModelList },
];
authzRoutes.forEach(({ method, path, handler }) => {
    const middlewares = [apiAuthorization];
    if(path === '/registration'){
        const noUpload = multer();
        middlewares.push(noUpload.none()); 
    }
    router[method](path, ...middlewares, handler);
});


/* -- Api Auth & Api Authz Middleware -- */
const authzAndAuthRoutes = [
    { method: 'get', path: '/rider-home', handler: home },
    { method: 'get', path: '/get-rider-data', handler: getRiderData },
    { method: 'post', path: '/rider-profile-change', handler: updateProfile },
    { method: 'get', path: '/rider-profile-image-delete', handler: deleteImg },
    { method: 'get', path: '/rider-account-delete', handler: deleteAccount },
    { method: 'post', path: '/rider-logout', handler: logout },
    { method: 'post', path: '/rider-change_password', handler: updatePassword },
    { method: 'get', path: '/rider-notification-list', handler: notificationList },
    { method: 'post', path: '/rider-address-add', handler: addRiderAddress },
    { method: 'get', path: '/rider-address-list', handler: riderAddressList },
    { method: 'get', path: '/rider-address-delete', handler: deleteRiderAddress },
    { method: 'post', path: '/rider-vehicle-add', handler: addRiderVehicle },
    { method: 'post', path: '/rider-vehicle-edit', handler: editRiderVehicle },
    { method: 'get', path: '/rider-vehicle-list', handler: riderVehicleList },
    { method: 'get', path: '/rider-vehicle-delete', handler: deleteRiderVehicle },

    /* Charging Station */
    { method: 'get', path: '/charging-station-list', handler: stationList },
    { method: 'get', path: '/nearest-charging-station-list', handler: nearestChargerList },
    { method: 'get', path: '/charging-station-detail', handler: stationDetail },

    /* Car Rental */
    { method: 'get', path: '/car-rental-list', handler: carList },
    { method: 'get', path: '/car-rental-detail', handler: carDetail },

    /* Bike Rental Routes */
    { method: 'get', path: '/bike-rental-list', handler: bikeList },
    { method: 'get', path: '/bike-rental-detail', handler: bikeDetail },

    /* Road Assistance Routes */
    { method: 'get', path: '/road-assistance', handler: addRoadAssistance },
    { method: 'get', path: '/road-assistance-list', handler: roadAssistanceList },
    { method: 'get', path: '/road-assistance-details', handler: roadAssistanceDetail },
    { method: 'get', path: '/road-assistance-invoice-list', handler: roadAssistanceInvoiceList },
    { method: 'get', path: '/road-assistance-invoice-detail', handler: roadAssistanceInvoiceDetail },

    /* Installation Service Routes */
    { method: 'post', path: '/charging-installation-service', handler: serviceRequest },
    { method: 'get', path: '/charging-installation-list', handler: requestList },
    { method: 'get', path: '/charging-installation-detail', handler: requestDetails },

    /* Club Routes */
    { method: 'get', path: '/club-list', handler: clubList },
    { method: 'get', path: '/club-detail', handler: clubDetail },

    /* Vehicle Routes */
    { method: 'get', path: '/vehicle-list', handler: vehicleList },
    { method: 'get', path: '/vehicle-detail', handler: vehicleDetail },
    { method: 'post', path: '/interest-register', handler: interestedPeople },
    { method: 'post', path: '/sell-vehicle', handler: sellVehicle },
    { method: 'get', path: '/all-sell-vehicle-list', handler: allSellVehicleList },
    { method: 'get', path: '/sell-vehicle-list', handler: sellVehicleList },
    { method: 'get', path: '/sell-vehicle-detail', handler: sellVehicleDetail },
    { method: 'post', path: '/edit-sell-vehicle', handler: updateSellVehicle },
    { method: 'get', path: '/delete-sell-vehicle', handler: deleteSellVehicle },
    { method: 'get', path: '/sold-sell-vehicle', handler: soldSellVehicle },

    /* Discussion Board */
    { method: 'post', path: '/add-discussion-board', handler: addDiscussionBoard },
    { method: 'get', path: '/discussion-board-list', handler: getDiscussionBoardList },
    { method: 'get', path: '/discussion-board-detail', handler: getDiscussionBoardDetail },
    { method: 'post', path: '/add-comment', handler: addComment },
    { method: 'post', path: '/reply-comment', handler: replyComment },
    { method: 'get', path: '/board-like', handler: boardLike },
    { method: 'get', path: '/board-view', handler: boardView },
    { method: 'get', path: '/board-share', handler: boardShare },
    { method: 'get', path: '/board-vote-poll', handler: votePoll },
    { method: 'get', path: '/discussion-board-report', handler: reportOnBoard },
    { method: 'get', path: '/discussion-board-not-interested', handler: boardNotInterested },
    { method: 'get', path: '/discussion-board-delete', handler: boardDelete },
    { method: 'post', path: '/discussion-board-edit', handler: editBoard },
    { method: 'post', path: '/board-vote-edit', handler: editPoll },
    { method: 'post', path: '/delete-comment', handler: deleteComment },
    { method: 'post', path: '/delete-reply-comment', handler: deleteReplyComment },
    { method: 'get', path: '/comment-like', handler: commentLike },
    { method: 'get', path: '/reply-comment-like', handler: replyCommentLike },

    /* Charging Service */
    { method: 'post', path: '/charging-service-slot-list', handler: getChargingServiceSlotList },
    { method: 'post', path: '/charging-service', handler: requestService },
    { method: 'get', path: '/charging-service-list', handler: listServices },
    { method: 'get', path: '/charging-service-details', handler: getServiceOrderDetail },
    { method: 'get', path: '/pick-and-drop-invoice-list', handler: getInvoiceList },
    { method: 'get', path: '/pick-and-drop-invoice-detail', handler: getInvoiceDetail },

    /* Portable charger */
    { method: 'get', path: '/portable-charger-list', handler: chargerList },
    { method: 'get', path: '/portable-charger-booking', handler: chargerBooking },
    { method: 'get', path: '/portable-charger-booking-list', handler: chargerBookingList },
    { method: 'get', path: '/portable-charger-booking-detail', handler: chargerBookingDetail },
    { method: 'get', path: '/portable-charger-booking-detail', handler: invoiceList },

    /* Offer Routes */
    { method: 'get', path: '/offer-list', handler: offerList },
    { method: 'get', path: '/offer-detail', handler: offerDetail },

    /* Service Shop */
    { method: 'get', path: '/service-shop-list', handler: shopList },
    { method: 'get', path: '/service-shop-detail', handler: shopDetail },

    /* EV Insurance */
    { method: 'post', path: '/add-insurance', handler: addInsurance},
    { method: 'post', path: '/insurance-list', handler: insuranceList },
    { method: 'post', path: '/insurance-details', handler: insuranceDetails },
    { method: 'post', path: '/ev-pre-sale-testing', handler: evPreSaleBooking },
    { method: 'get', path: '/ev-pre-sale-list', handler: evPreSaleList },
    { method: 'get', path: '/ev-pre-sale-detail', handler: evPreSaleDetails },
    { method: 'post', path: '/ev-pre-sale-slot-list', handler: preSaleSlotList },
];
authzAndAuthRoutes.forEach(({ method, path, handler }) => {
    const middlewares = []; 

    if(path === '/rider-profile-change'){
        middlewares.push(handleFileUpload('rider_profile', ['profile_image'], 1));
    }
    if(path === '/sell-vehicle' || path === '/edit-sell-vehicle'){
        middlewares.push(handleFileUpload('vehicle-image', ['car_images', 'car_tyre_image', 'other_images'], ['car_images', 'car_tyre_image'], 5));
    }
    if(path === '/add-discussion-board' || path === '/discussion-board-edit'){
        middlewares.push(handleFileUpload('discussion-board-images', ['image'], 5));
    }
    if(path === '/add-insurance'){
        middlewares.push(handleFileUpload('insurance-images', ['vehicle_registration_img', 'driving_licence', 'car_images', 'car_type_image', 'scretch_image', 'emirates_id'], 5));
    }
    
    middlewares.push(apiAuthorization);
    middlewares.push(apiAuthentication);
    router[method](path, ...middlewares, handler);
});


/* -- Api Auth & Api RSA Authz Middleware -- */
const authzRsaAndAuthRoutes = [
    /* Road Assitance with RSA */
    { method: 'get', path: '/rsa-order-stage', handler: getRsaOrderStage },
    { method: 'get', path: '/order-action', handler: orderAction },
    /* Charging Service */
    { method: 'post', path: '/charger-service-action', handler: handleBookingAction },
    { method: 'get', path: '/charger-service-stage', handler: getRsaBookingStage },
    { method: 'post', path: '/charger-service-reject', handler: handleRejectBooking },
    /* POD with RSA */
    { method: 'get', path: '/portable-charger-stage', handler: rsaBookingStage },
    { method: 'post', path: '/portable-charger-action', handler: bookingAction },
    { method: 'post', path: '/portable-charger-reject', handler: rejectBooking }
];
authzRsaAndAuthRoutes.forEach(({ method, path, handler }) => {
    router[method](path, apiAuthorization, apiRsaAuthentication, handler);
});



export default router;