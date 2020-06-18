# Firebase Authenticated Cloud Function Example

## Installation

See https://firebase.google.com/docs/functions/get-started

From the command line:
```sh
npm install -g firebase-tools
firebase login
firebase projects:create --display-name "firebase-cloud-functions" zesbytes-firebase-func
firebase projects:create --display-name "firebase-cloud-functions-staging" zesbytes-firebase-func-stage
mkdir firebase-cloud-functions
cd firebase-cloud-functions
firebase init functions
firebase use --add zesbytes-firebase-func --alias prod
firebase use --add zesbytes-firebase-func-stage --alias staging
cd functions
npm i firebase-admin@latest firebase-functions@latest
```

Note - do not select option to include tslint; instead install eslint manually (see issue https://github.com/firebase/firebase-tools/pull/1663/files)

Further steps:
1. update package.json engines node version from 8 to 10
1. add users to staging firebase project (via firebase console UI)
1. under "project settings > service account" generate a new private key
1. copy service account file to project and rename to "service-account.staging.json"
1. uncomment out code in src/index.ts so that the service account token id is written to the console.
1. update at least one user to have admin role:
   ```sh
   curl https://identitytoolkit.googleapis.com/v1/projects/zesbytes-firebase-func-stage/accounts:update -H 'Authorization: Bearer <service account token>' -H 'content-type: application/json' -d '{"localId":"<user uid>", "customAttributes":"{\"agent\":true,\"admin\":true}"}'
   ```
1. comment out the service token code once again

## Staging and Production Environments

A separate firebase project needs to be created for each environment. See [Installation](#installation)

The command "firebase use --add" changes the configuration within file .firebaserc

To switch project between environments:
- `firebase use <alias>`
- `firebase deploy -P <alias>`

Note that changing the active project makes a change to the global config file '<user home>/.config/configstore/firebase-tools.json'

TODO - Investigate firebase deploy targets

## Executing Locally

```sh
npm run serve
```

To get a bearer token for calling authorized endpoints:
```sh
curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<web API key>' -H 'Content-Type: application/json' -d '{"email":"<email>","password":"<password>","returnSecureToken":true}'
```

The web api key can be obtained from the Firebase project settings page. The token expires after 1 hour and cannot be changed, but does support refresh tokens.

To get information about oneself:
```sh
curl 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=<web api key>' -H 'Content-Type: application/json' -d '{"idToken":"<id token>"}'
```

To call an authenticated endpoint:
```sh
curl -X GET http://localhost:5000/zesbytes-firebase-func-stage/us-central1/restrictedAction -H 'Authorization: Bearer <id token>'
```

As an admin user, to add an agent role to a user:
```sh
curl -X POST http://localhost:5000/zesbytes-firebase-func-stage/us-central1/addAgentRole -H 'Content-Type:application/json' -H 'Authorization: Bearer <admin id token>' -d '{"data":{"email":"<user email>"}}'
```

To update any users custom attributes (claims):
```sh
curl https://identitytoolkit.googleapis.com/v1/projects/zesbytes-firebase-func-stage/accounts:update -H 'Authorization: Bearer <service account token>' -H 'content-type: application/json' -d '{"localId":"<user uid>", "customAttributes":"{\"agent\":true,\"admin\":true}"}'
```

To get information on any user:
```sh
curl https://identitytoolkit.googleapis.com/v1/projects/zesbytes-firebase-func-stage/accounts:lookup 'Authorization: Bearer <service account token>' -H 'content-type: application/json' -d '{"email": ["<user email>"]}'
```

See [Installation](#installation) for details on how to obtain the service account token. The service account token allows execution of secure operations.

Note in order to obtain the service account token the environment variable GOOGLE_APPLICATION_CREDENTIALS must be set to the path of the file containing service account details obtained from firebase. These service account details include a private key.

The function `node_modules/firebase-admin/lib/auth/credentials.js#ServiceAccountCredential.prototype.getAccessToken` uses service account details to create a JWT, sign the JWT using the private key and then receive an access token via `https://accounts.google.com/o/oauth2/token -H 'Content-Type:application/x-www-form-urlencoded" -d 'grant_type=grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=<signed JWT>'`.

## Debugging

From visual studio code terminal:
1. ```sh
   firebase emulators:start --inspect-functions
   ```
1. Press F1 to bring up commands to execute.
1. Select "Debug: Attach to node process"
1. Select the "firebase emulator:start" process

## Environment Variables

The following effect the currently active project:
```sh
firebase functions:config:set <key>=<value>
firebase functions:config:get
firebase functions:config:clone --from <other project>
firebase functions:config:unset env && firebase functions:config:set env='${cat env,json}'
```

To access a variable within code:
```typescript
const key = functions.config().<key>
```

process.env.GCLOUD_PROJECT is available to acess name of active project.

## Routing

Cloud functions do not allow for matching on URL patterns or on Http method type. A cloud function must implement subrouting logic itself.

Google will populate a request object according to the Content-Type of a request. Cloud functions need to check the Content-Type in order to correctly access the data of a request. If the implementation of a cloud function deems a Content-Type to be invalid, Google would still have parsed the data prior to calling the function.

## Authorization

A `functions.https.onCall` cloud function will automatically parse and check the validity of Authorization tokens. The function will only accept POST http methods and the top level JSON property must be "data".

The code in the project also gives an example of manually validating an Authorization token for a `functions.https.onRequest` cloud function.

If Express is used then middleware can be used for Authorization. e.g. `router.get('/', authorize(Role.Admin), getAll)`

## Swagger

Cloud functions do not natively support swagger generation.

There are Express libraries for generating swagger documentation and endpoints. Google cloud functions can be integrated with Express.

## Sign Out

There is no ability in the backend to immediately cause use of a token to fail. There is however the ability to have refresh tokens revoked by calling `server.admin.auth().revokeRefreshToken(<uid>)`. This will cause the request for refresh tokens of any active tokens to fail. This relies on Googles own Authentication service being stateful.

Upon sign out client code should drop use of a users authentication token and call the backend to revoke the users refresh tokens.

## Testing

```sh
npm i -D firebase-functions-test
npm i -D mocha
```

create test directory under functions directory
execute `npm test` within functions directory to execute tests
