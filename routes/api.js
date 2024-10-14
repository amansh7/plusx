import { Router } from "express";
import { 
    login, register, forgotPassword, createOTP, verifyOTP, home, getRiderData, updateProfile, deleteImg, logout, updatePassword, locationList, 
    notificationList, addRiderAddress, riderAddressList, deleteRiderAddress, deleteAccount  
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
import { addInsurance, insuranceList, insuranceDetails, evPreSaleBooking, evPreSaleList, evPreSaleDetails, preSaleSlotList, upload} from '../controller/api/EvInsuranceController.js';
import { 
    addDiscussionBoard, getDiscussionBoardList, getDiscussionBoardDetail, addComment, replyComment, boardLike, boardView, boardShare, votePoll, 
    reportOnBoard, boardNotInterested, boardDelete, editBoard, editPoll, deleteComment, deleteReplyComment, commentLike, replyCommentLike
} from '../controller/api/DiscussionBoardController.js';

const router = Router();

/* API Routes */
router.post('/rider-login', login);
router.post('/registration', register);
router.post('/rider-forgot_password', forgotPassword);
router.post('/create-otp', createOTP);
router.post('/verify-otp', verifyOTP);

/* Dynamic List */
router.post('/location-list', locationList);

/* Vehicle Routes */
router.get('/location-area-list', areaList);
router.get('/reminder-sell-vehicle-list', reminder_sell_vehicle_list);
router.post('/vehicle-brand-list', vehicleBrandList);
router.post('/vehicle-model-list', vehicleModelList);

/* -- Api Auth & Api Authz middleware -- */
router.post('/rider-home', home);
router.post('/get-rider-data', getRiderData);
router.post('/rider-profile-change', updateProfile);
router.post('/rider-profile-image-delete', deleteImg);
router.post('/rider-account-delete', deleteAccount);
router.post('/rider-logout', logout);
router.post('/rider-change_password', updatePassword);
router.post('/rider-notification-list', notificationList);
router.post('/rider-address-add', addRiderAddress);
router.get('/rider-address-list', riderAddressList);
router.get('/rider-address-delete', deleteRiderAddress);

/* Charging Station  */
router.get('/charging-station-list', stationList);
router.get('/nearest-charging-station-list', nearestChargerList);
router.get('/charging-station-detail', stationDetail);

/* Car Rental */
router.get('/car-rental-list', carList);
router.get('/car-rental-detail', carDetail);

/* Bike Rental Routes */
router.get('/bike-rental-list', bikeList);
router.get('/bike-rental-detail', bikeDetail);

/* Road Assistance Routes */
router.get('/road-assistance', addRoadAssistance);
router.get('/road-assistance-list', roadAssistanceList);
router.get('/road-assistance-details', roadAssistanceDetail);
router.get('/road-assistance-invoice-list', roadAssistanceInvoiceList);
router.get('/road-assistance-invoice-detail', roadAssistanceInvoiceDetail);

/* Installation Service Routes */
router.post('/charging-installation-service', serviceRequest); 
router.get('/charging-installation-list', requestList);
router.get('/charging-installation-detail', requestDetails);

/* Club Routes */
router.get('/club-list', clubList);
router.get('/club-detail', clubDetail);

/* Vehicle Routes */
router.get('/vehicle-list', vehicleList);
router.get('/vehicle-detail', vehicleDetail);
router.post('/interest-register', interestedPeople);
router.post('/sell-vehicle', sellVehicle);
router.get('/all-sell-vehicle-list', allSellVehicleList);
router.get('/sell-vehicle-list', sellVehicleList);
router.get('/sell-vehicle-detail', sellVehicleDetail);
router.post('/edit-sell-vehicle', updateSellVehicle);
router.get('/delete-sell-vehicle', deleteSellVehicle);
router.get('/sold-sell-vehicle', soldSellVehicle);

/* Discussion Board */
router.post('/add-discussion-board', addDiscussionBoard);
router.get('/discussion-board-list', getDiscussionBoardList);
router.get('/discussion-board-detail', getDiscussionBoardDetail);
router.post('/add-comment', addComment);
router.post('/reply-comment', replyComment);
router.get('/board-like', boardLike);
router.get('/board-view', boardView);
router.get('/board-share', boardShare);
router.get('/board-vote-poll', votePoll);
router.get('/discussion-board-report', reportOnBoard);
router.get('/discussion-board-not-interested', boardNotInterested);
router.get('/discussion-board-delete', boardDelete);
router.post('/discussion-board-edit', editBoard);
router.post('/board-vote-edit', editPoll);
router.post('/delete-comment', deleteComment);
router.post('/delete-reply-comment', deleteReplyComment);
router.get('/comment-like', commentLike);
router.get('/reply-comment-like', replyCommentLike);

/* Charging Service */
router.post('/charging-service-slot-list', getChargingServiceSlotList);
router.post('/charging-service', requestService);
router.get('/charging-service-list', listServices);
router.get('/charging-service-details', getServiceOrderDetail);
router.get('/pick-and-drop-invoice-list', getInvoiceList);
router.get('/pick-and-drop-invoice-detail', getInvoiceDetail);


/* Portable charger */
router.get('/portable-charger-list', chargerList);
router.get('/portable-charger-booking', chargerBooking);
router.get('/portable-charger-booking-list', chargerBookingList);
router.get('/portable-charger-booking-detail', chargerBookingDetail);
router.get('/portable-charger-booking-detail', invoiceList);

/* Offer Routes */
router.get('/offer-list', offerList);
router.get('/offer-detail', offerDetail);

/* Service Shop */
router.get('/service-shop-list', shopList);
router.get('/service-shop-detail', shopDetail);

/* EV Insurance */
router.post('/add-insurance', upload.fields([
    { name: 'vehicle_registration_img', maxCount: 10 },
    { name: 'driving_licence', maxCount: 10 },
    { name: 'car_images', maxCount: 10 },
    { name: 'car_type_image', maxCount: 10 },
    { name: 'scretch_image', maxCount: 10 },
    { name: 'emirates_id', maxCount: 10 }
]),addInsurance);
router.post('/insurance-list', insuranceList);
router.post('/insurance-details', insuranceDetails);
router.post('/ev-pre-sale-testing', evPreSaleBooking);
router.get('/ev-pre-sale-list', evPreSaleList);
router.get('/ev-pre-sale-detail', evPreSaleDetails);
router.post('/ev-pre-sale-slot-list', preSaleSlotList);


/* -- Api Auth & Api RSA Authz middleware -- */

/* Road Assitance with RSA */
router.get('/rsa-order-stage', getRsaOrderStage);
router.get('/order-action', orderAction);
/* Charging Service */
router.post('/charger-service-action', handleBookingAction);
router.get('/charger-service-stage', getRsaBookingStage);
router.post('/charger-service-reject', handleRejectBooking);
/* POD with RSA */
router.get('/portable-charger-stage', rsaBookingStage);
router.post('/portable-charger-action', bookingAction);
router.post('/portable-charger-reject', rejectBooking);


export default router;