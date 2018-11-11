import 'isomorphic-fetch';
import * as jwt from 'jsonwebtoken';
import { FetchFunctions } from './fetch';
import { jwk2pem } from 'pem-jwk';
import { config } from '@jenkins-cd/blueocean-config';

let storedToken:any = null;
let publicKeyStore:any = null;
let tokenFetchPromise:any = null;

const CLOCK_SKEW_SECONDS = 60;
export const JWT = {
    /**
     * Fetches the JWT token. This token is cached for a default of 25mins.
     * If it is within 5mins or expiry it will fetch a new one.
     */
    fetchJWT() {
        if (storedToken && storedToken.exp) {
            const diff = storedToken.exp - Math.trunc(new Date().getTime() / 1000);

            // refetch token if we are within 60s of it exp
            if (diff < CLOCK_SKEW_SECONDS) {
                tokenFetchPromise = null;
            }
        }

        if (!tokenFetchPromise) {
            tokenFetchPromise = fetch(`${config.getJWTServiceHostUrl()}/jwt-auth/token`, { credentials: 'include', mode: 'cors' })
                .then(FetchFunctions.checkStatus)
                .then(response => {
                    const token = response.headers.get('X-BLUEOCEAN-JWT');
                    if (token) {
                        return token;
                    }

                    throw new Error('Could not fetch jwt_token');
                });
        }

        return tokenFetchPromise;
    },

    /**
     * Verifies the token using the public key.
     */
    verifyToken(token:any, certObject:any) {
        return new Promise((resolve, reject) =>
            jwt.verify(token, jwk2pem(certObject), { algorithms: [certObject.alg], clockTolerance: CLOCK_SKEW_SECONDS }, (err, payload) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(payload);
                }
            })
        );
    },

    /**
     * Fetches the public key that is used to verify tokens.
     */
    fetchJWTPublicKey(token:any) {
        const decoded = jwt.decode(token, { complete: true });
        if(decoded && typeof decoded !== "string") {
        const url = `${config.getJWTServiceHostUrl()}/jwt-auth/jwks/${decoded.header.kid}/`;
        if (!publicKeyStore) {
            publicKeyStore = fetch(url, { credentials: 'same-origin' })
                .then(FetchFunctions.checkStatus)
                .then(FetchFunctions.parseJSON)
                .then(cert =>
                    this.verifyToken(token, cert).then(payload => ({
                        token,
                        payload,
                    }))
                );
        }

            return publicKeyStore;
        }
    },

    /**
     * Puts the token into global storage for later use.
     */
    storeToken(data: any) {
        storedToken = data.payload;
        return data;
    },

    /**
     * Use this function if you want the payload from the token.
     */
    getTokenWithPayload() {
        return this.fetchJWT()
            .then(FetchFunctions.checkStatus)
            .then((token:any) => this.fetchJWTPublicKey(token))
            .then((data:any) => this.storeToken(data));
    },

    /**
     * Gets the token from te server and verifies it.
     */
    getToken() {
        return this.getTokenWithPayload().then((token:any) => token.token);
    },
};
