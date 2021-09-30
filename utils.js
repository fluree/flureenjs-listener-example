const flureenjs = require('@fluree/flureenjs');

const reduceForNewUsernames = (flakes, usernamePredicateID) => {
  const usernameFlakeMap = flakes.reduce((previous, current) => {
    const predID = current[1];
    const usernameValue = current[2];
    const isAssertion = current[4];
    if (predID !== usernamePredicateID) {
      return previous;
    }
    const increment = !!isAssertion ? 1 : -1;
    if (!previous[usernameValue]) {
      return { ...previous, [usernameValue]: increment };
    }
    return {
      ...previous,
      [usernameValue]: previous[usernameValue] + increment,
    };
  }, {});

  const allUsernames = Object.keys(usernameFlakeMap);
  const newUsernames = allUsernames.filter(
    (username) => usernameFlakeMap[username] === 1
  );

  return newUsernames;
};

const fetchUsernamePredicateID = (flureeUrl, ledgerId) =>
  fetch(`${flureeUrl}/fdb/${ledgerId}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      selectOne: ['_id'],
      from: ['_predicate/name', '_user/username'],
    }),
  })
    .then((res) => res.json())
    .then((json) => json._id)
    .then((predID) => {
      return predID;
    })
    .catch((error) => {
      console.log('ERROR: Could not fetch necessary predicate _id');
      return null;
    });

const validateOrInitializeLedger = (flureeUrl, ledgerId) =>
  fetch(`${flureeUrl}/fdb/new-db`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 'db/id': ledgerId }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res && res.error === 'db/invalid-command') {
        console.info(
          `Ledger, ${ledgerId}, already exists on Fluree instance. Skipping initialization.\n`
        );
        return;
      }
      console.info(`Ledger added to Fluree instance: ${ledgerId}\n`);
    })
    .catch((_) => {
      console.warn(
        `ERROR. Check that Fluree instance is available at ${flureeUrl}`
      );
    });

const registerDataEventCallback =
  (flureeConn, usernamePredicateID) => async (eventType, eventData) => {
    if (!usernamePredicateID) {
      console.warn('ERROR: No predicate ID to use for monitoring');
      return;
    }

    // In this example, we only care about data events from the ledger that describe new blocks committed
    if (eventType !== 'block') {
      return;
    }

    console.info(
      'Data event is',
      eventType,
      '-- checking if block is relevant to new users...'
    );
    const { flakes } = eventData;

    // In this example, we only care to execute any logic if the block describes a net-new _user record with a _user/username value (i.e. insertion not update/deletion)
    // Because _user/username is a unique predicate by default, a new flake for _user/username with no corresponding retraction reliably indicates a non-redundant insertion
    // The reducer function below produces an array of _user/username values with no corresponding retraction
    const insertedUsernames = reduceForNewUsernames(
      flakes,
      usernamePredicateID
    );
    const containsInsertedUsernames = insertedUsernames.length > 0;

    console.info(`Block contains new username? :${containsInsertedUsernames}`);
    if (!containsInsertedUsernames) {
      console.info('This block is irrelevant to new usernames. No Op.\n');
      return;
    }

    console.info(
      'This block describes a new username... adding a new ledger to the network for this user...\n'
    );

    //The remainder of the code is what we want to happen when the listener function determines this new block matches our critical data event criteria
    //In this case, we want to add a new ledger to the network that is namespaced to this particular user's username...

    const normalizedUsernames = insertedUsernames.map((string) =>
      string.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    );

    await Promise.all(
      normalizedUsernames.map((username) =>
        flureenjs
          .new_ledger(flureeConn, `user/${username}`)
          .then((res) => {
            if (res.status === 200) {
              console.info(`New ledger added: user/${username}\n`);
              return username;
            }
            debugger;
          })
          .catch((err) => {
            console.warn((err && err.message) || 'Unable to insert new ledger');
            return null;
          })
      )
    );
  };

module.exports = {
  fetchUsernamePredicateID,
  validateOrInitializeLedger,
  registerDataEventCallback,
};
