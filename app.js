global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest; // switch out to xhr2 https://stackoverflow.com/questions/32604460/xmlhttprequest-module-not-defined-found/46081151#46081151
global.WebSocket = require('ws'); // https://flaviocopes.com/node-websockets/
const flureenjs = require('@fluree/flureenjs');
require('isomorphic-fetch');
const {
  fetchUsernamePredicateID,
  validateOrInitializeLedger,
  registerDataEventCallback,
} = require('./utils');

flureenjs.set_logging({ level: 'info' });

// Variables for watch
let flureeUrl = 'http://localhost:8090';
let ledgerId = 'listener/example';
let cbKey = 'abc123'; // an arbirtrary key that indexes this particular connection
let flureeConn;

// Function to connect to fluree instance instance
function flureeConnect(url, options) {
  if (!url) {
    throw 'Unable to connect to Fluree: Missing url. ';
  }

  var cOpts = {};
  if (options && options.keepAlive && options.keepAlive === true) {
    cOpts = {
      'keep-alive-fn': function () {
        flureeConnect(url, options);
      },
    };
  }

  const includesOptions = Object.keys(cOpts).length > 0;
  // console.info('Connecting to Fluree instance @', url, 'options:', cOpts);
  console.info(
    `Connecting to Fluree instance @ ${url}${
      includesOptions ? `. Options: ${cOpts}` : ''
    }`
  );

  flureenjs
    .connect_p(url, cOpts)
    .then((conn) => {
      flureeConn = conn;
    })
    .catch((error) => {
      console.error('Error connecting to Fluree DB', error);
    });
}

// function to wire-up listener on a ledger
const addListener = (conn, ledger, key, callback) =>
  flureenjs.listen(conn, ledger, key, callback);

// function to start listener when connection available
function startListener() {
  flureeConnect(flureeUrl);

  // wait for connection - non-blocking check
  (async () => {
    while (!flureeConn) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.info('Connection Established!\n');

    // NOTE: This is just specific to this example, to ensure that your Fluree instance has our `listener/example` ledger initialized
    await validateOrInitializeLedger(flureeUrl, ledgerId);

    // Fetch necessary predicate ID in order to monitor query
    const usernamePredicateID = await fetchUsernamePredicateID(
      flureeUrl,
      ledgerId
    );

    // function to log update -- this function returns another function, and is defined inside of 'startListener' to guarantee live Fluree conn object at time of function definition
    const dataEventCallback = registerDataEventCallback(
      flureeConn,
      usernamePredicateID
    );

    addListener(flureeConn, ledgerId, cbKey, dataEventCallback);
  })().catch((e) => console.warn(e));
}

startListener();
