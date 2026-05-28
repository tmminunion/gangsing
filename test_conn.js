import { WebcastPushConnection } from 'tiktok-live-connector';

const username = 'nufat.id';
const sessionId = 'c269fd11dc08f8a3b142d164fff1af50';

console.log('Testing WebcastPushConnection with sessionId and ttTargetIdc...');

const connectionOptions = {
  processInitialData: true,
  fetchRoomConfig: true,
  enableExtendedGiftInfo: true,
  requestPollingInterval: 1000,
  clientParams: {
    "app_language": "id-ID",
    "device_platform": "web"
  },
  sessionId: sessionId,
  ttTargetIdc: 'row', // Added ttTargetIdc!
  authenticateWs: false
};

console.log('Options:', connectionOptions);
const connection = new WebcastPushConnection(username, connectionOptions);

console.log('Attempting to connect...');
connection.connect()
  .then(state => {
    console.log('🎉 CONNECTED SUCCESSFULLY!');
    console.log('Room ID:', state.roomId);
    connection.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ CONNECTION FAILED:', err);
    process.exit(1);
  });

setTimeout(() => {
  console.log('⏰ Test timed out after 15 seconds.');
  process.exit(1);
}, 15000);
