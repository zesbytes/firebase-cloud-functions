import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { RuntimeOptions } from 'firebase-functions';

const runtimeOpts: RuntimeOptions = {
  timeoutSeconds: 5,
  memory: '128MB'
};

admin.initializeApp();
// const app = admin.initializeApp();

// app.options.credential?.getAccessToken().then(token => {
//   console.log(`service account access token: ${token.access_token}`);
// });

// admin.auth().createUser({email: 'admin@zesbytes.com'})
//   .then(user => admin.auth().setCustomUserClaims(user.uid, {'admin': true}))
//   .catch(err => console.log(err));


export const addAgentRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'unauthorized');
  }

  if (context.auth.token.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'forbidden');
  }

  const email = data.email;
  if (typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'email is invalid');
  }
  try {
    await grantRole(email, 'agent');
  } catch (err) {
    if (err.code === 'auth/invalid-email' || err.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('invalid-argument', 'email is invalid');
    } else {
      throw err;
    }
  }

  return {
    result: `Request fulfilled! ${email} now has agent role.`
  }
});

// could use "onCall" instead but want an example to demonistrate determining role from request itself
export const agentOnlyQuery = functions
  .region('asia-east2')
  .runWith(runtimeOpts).https.onRequest(
    hasRole('agent', httpGet((_request, response) => response.send('user has agent access')))
  );

export const publicQuery = functions.https.onRequest(
  httpGet((_request, response) => response.send("unprotected endpoint reached successfully"))
);

type RequestFunction = (request: functions.https.Request, response: functions.Response) => void;

// just a little function to only execute nested logic if user is authorized.
// is only a proof of concept - can replace with more extensible express middleware type mechanism to chain logic
function hasRole(role: string, fn:RequestFunction) {  
  return async (request:functions.https.Request, response:functions.Response) => {

    const tokenId = request.headers.authorization?.split('Bearer ')[1];
    if (!tokenId) {
      response.sendStatus(401);
      return;
    }

    try {
      const token = await admin.auth().verifyIdToken(tokenId);
      if (token[role] === true) {
        fn(request, response);
      } else {
        response.sendStatus(403);
      }
    } catch (err) {
      response.sendStatus(401);
    }
  };
}

function httpGet(fn:RequestFunction) {
  return (request:functions.https.Request, response:functions.Response) => {

    if (request.method !== 'GET') {
      response.sendStatus(405);
    } else {
      fn(request, response);
    }
  }
}

async function grantRole(email: string, role:string): Promise<void> {
  const user = await admin.auth().getUserByEmail(email);

  if (user.customClaims && user.customClaims[role] === true) {
    return;
  }
  // TODO - optimistic locking support so operation is atomic?
  await admin.auth().setCustomUserClaims(user.uid, {
    ...user.customClaims,
    [role]: true
  });
}
