import NodeCache from "node-cache";
import axios from "axios";
import multer from 'multer';
import path from 'path';

export const generateRandomPassword = (length = 8) => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }
  return password;
};

export const checkNumber = (countryCode, num) => {
  const numArr = [
    { code: "+971", startWith: [5], length: 9 },
    { code: "+973", startWith: [3, 6, 8], length: 8 },
    { code: "+965", startWith: [5, 6, 9], length: 8 },
    { code: "+968", startWith: [7], length: 8 },
    { code: "+966", startWith: [5], length: 9 },
    { code: "+91", startWith: [6, 7, 8, 9], length: 10 },
    { code: "+1", startWith: [0, 1, 2, 9], length: 10 },
    { code: "+44", startWith: [0, 7], length: 11 },
    { code: "+974", startWith: [3, 5, 6], length: 8 },
  ];

  const entry = numArr.find((item) => item.code === countryCode);

  if (entry) {
    const first = Number(num.charAt(0));
    const isValidStart = entry.startWith.includes(first);
    const isValidLength = num.length === entry.length;

    if (!isValidStart) {
      return { status: 0, msg: `No start with ${entry.startWith.join(", ")}` };
    }
    if (!isValidLength) {
      return { status: 0, msg: `No should be ${entry.length} digits` };
    }
    return { status: 1, msg: "No is valid!" };
  }

  return { status: 1, msg: "No is valid!" };
};

export const generateOTP = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

/* Sore & Retrieve OTP from Cache Memory */
const otpCache = new NodeCache({ stdTTL: 60 });
export const storeOTP = (key, otp) => {
  otpCache.set(key, otp);
};

export const getOTP = (key) => {
  return otpCache.get(key);
};

/* API Call to Send OTP */
export const sendOtp = async (mobile, otpMsg) => {
  const username = "2btgve6f";
  const password = "aLXHNiHw";
  const from = "PlusX";

  const baseUrl = `https://api.smsglobal.com/http-api.php?action=sendsms&user=${username}&password=${password}&from=${encodeURIComponent(
    from
  )}&to=${mobile}&text=${encodeURIComponent(otpMsg)}`;

  try {
    const response = await axios.get(baseUrl);

    if (response.data) {
      return { status: 1, msg: response.data };
    }
  } catch (err) {
    return { status: 0, msg: err.message, code: err.status };
  }
};

/* Handle file upload */


/* Format Timings */
export const getOpenAndCloseTimings = (data) => {
  const dayTime = [];

  if (data.always_open === 0) {
    const openDays = data.open_days.split(',').map(day => day.trim());
    const openTimings = data.open_timing.split(',').map(time => time.trim());
    const uniqueTimings = [...new Set(openTimings)];

    if (uniqueTimings.length !== openTimings.length) {
      uniqueTimings.forEach((timing) => {
        const keys = openTimings.reduce((acc, curr, index) => {
          if (curr === timing) acc.push(index);
          return acc;
        }, []);
        let start = '';
        let end = '';
        let formattedTiming = 'Closed';

        if (timing !== 'Closed') {
          const times = timing.split('-');
          const startTime = new Date(`1970-01-01T${times[0]}:00`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = new Date(`1970-01-01T${times[1]}:00`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          formattedTiming = `${startTime}-${endTime}`;
        }

        for (let i = 0; i < keys.length; i++) {
          start = (start === '') ? openDays[keys[i]] : start;

          if (keys[i + 1] && (keys[i + 1] - keys[i] !== 1 && i + 1 !== keys.length)) {
            end = openDays[keys[i]];
            dayTime.push({ days: `${start}-${end}`, time: formattedTiming, position: keys[i] });
            start = '';
          }

          if (i + 1 === keys.length) {
            end = openDays[keys[i]];
            const days = (start === end) ? end : `${start}-${end}`;
            dayTime.push({ days, time: formattedTiming, position: keys[i] });
          }
        }
      });
    }

    dayTime.sort((a, b) => a.position - b.position);

    return dayTime;
  } else {
    return [{ days: 'Always Open', time: '' }];
  }
};