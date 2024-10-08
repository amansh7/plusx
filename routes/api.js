import { Router } from "express";
import { 
    login, register, forgotPassword, createOTP, verifyOTP, home, getRiderData, updateProfile, deleteImg, logout, updatePassword, locationList, 
    notificationList, addRiderAddress, riderAddressList, deleteRiderAddress, deleteAccount  
} from "../controller/api/RiderController.js";
import {stationList, stationDetail, nearestChargerList} from '../controller/api/ChargingStationController.js';
import {carList, carDetail} from '../controller/api/ElectricCarRentalController.js';
import {bikeList, bikeDetail} from '../controller/api/ElectricBikeRentalController.js';
import {addRoadAssistance, roadAssistanceList, roadAssistanceDetail} from '../controller/api/RoadAssistanceController.js';
import {serviceRequest, requestList, requestDetails} from '../controller/api/ChargingInstallationServiceController.js';
import {clubList, clubDetail } from '../controller/api/ClubController.js';

const router = Router();

/* API Routes */
router.post('/rider-login', login);
router.post('/registration', register);
router.post('/rider-forgot_password', forgotPassword);
router.post('/create-otp', createOTP);
router.post('/verify-otp', verifyOTP);
router.post('/location-list', locationList);

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

/* Installation Service Routes */
router.post('/charging-installation-service', serviceRequest);
router.get('/charging-installation-list', requestList);
router.get('/charging-installation-detail', requestDetails);

/* Club Routes */
router.get('/club-list', clubList);
router.get('/club-detail', clubDetail);

export default router;