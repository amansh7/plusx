import conn from './db.js';
import mqtt from 'mqtt';

let options = {
    port            : 1833,
    host            : 'supro.shunyaekai.tech',
    clientId        : 'supro',
    username        : 'supro',
    password        : 'T62$pO^GxSG94SFMvqNQgR1$k',
    keepalive       : 60,
    reconnectPeriod : 1000,
    protocolId      : 'MQIsdp',
    protocolVersion : 3,
    clean           : true,
    encoding        : 'utf8'
};

let client = mqtt.connect('mqtt://supro.shunyaekai.tech:1883', options);

client.on('connect', () => {
    console.log('connected');
    client.subscribe('/supro/CYCLE/#', () => {
        client.on('message', (topic, message, packet) => {
            //  console.log('received', message);

            const str = message.toString();
            const explode   = str.split(', ');
            
            if(str){
                let device_id = explode[0];
                let latitude  = explode[1];
                let longitude = explode[2];
                let status    = (speed >  2) ? 'R' : 'S';

                conn.query(`
                    SELECT rider_id, (SELECT speed FROM device_running_history WHERE device_id="${device_id}" ORDER BY id DESC LIMIT 1) as old_speed 
                    FROM devices 
                    WHERE device_id = ?
                `, [device_id], (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        if(result.length > 0 && result[0].old_speed != speed ){
                            let rider_id = result[0].rider_id ;
                            let sqlquery = `INSERT INTO device_running_history SET device_id = ?, rider_id = ?, speed = ?, latitude =?, longitude =?, status = ?`;
    
                            conn.query(sqlquery, [ device_id, rider_id, speed, latitude, longitude, status ], (err, result1) => {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log('created data');
                                }
                            });
                        }
                    }
                });

            }
        });
        // publish a message to a topic 
        // client.publish('get/ravv', 'Msg by ravv', () => {
        //     console.log("Message is published"); 
        //     client.end(); 
        // });
    }); 
});