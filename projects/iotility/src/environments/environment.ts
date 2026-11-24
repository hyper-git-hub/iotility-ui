export const environment = {
  production: false,
  apiBaseUrl: 'https://devgateway.hypernymbiz.com',
  userMsBaseUrl: 'https://devgateway.hypernymbiz.com/user-ms',
  cobPackagesBaseUrl: 'https://devgateway.hypernymbiz.com/cob-packages',
  cobConsumerAppSecret: 'G;6{l?5]V@p5@2~<f%PFJ+W4k@-H?s',
  fleetBaseUrl: 'https://devgateway.hypernymbiz.com/fms-fleet',
  signalRUrl: 'https://func-vfq-dev.azurewebsites.net',
  overpassApiUrl: 'https://overpass-api.de/api/interpreter',
  useCaseId: 6,
  firebase: {
    apiKey: "AIzaSyABXKV8XL-yirnv7Wz-gznDuM54dFGpxcA",
    authDomain: "gohyper-fleet.firebaseapp.com",
    databaseURL: "https://gohyper-fleet-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gohyper-fleet",
    storageBucket: "gohyper-fleet.firebasestorage.app",
    messagingSenderId: "752397433573",
    appId: "1:752397433573:web:ac8682308db4a0da29720c"
  },
} as const;
