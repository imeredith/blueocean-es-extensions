import 'isomorphic-fetch';

import { JWT } from './jwt';
import { config } from '@jenkins-cd/blueocean-config';
import { dedupe } from './dedupe';

interface BlueRequestInit extends RequestInit{
    headers?: Record<string, string>
}
let refreshToken: string | null = null;

function isGetRequest(fetchOptions: BlueRequestInit | undefined): boolean {
    return !fetchOptions || !fetchOptions.method || 'get'.localeCompare(fetchOptions.method) === 0;
}
export namespace FetchFunctions {
    export interface RawFetchOpts {
        onSuccess?: <A, B>(success: A) => B;
        onError?: <A, B>(error: A) => B;
        fetchOptions?: BlueRequestInit;
        disableDedupe?: boolean;
     }
}
export namespace Fetch {
    export interface FetchOpts {
        onSuccess?: <A, B>(success: A) => B;
        onError?: <A, B>(error: A) => B;
        fetchOptions?: BlueRequestInit;
    }
}

export class FetchFunctions {
    /**
     * Ensures the URL starts with jenkins path if not an absolute URL.
     * @param url
     * @returns {string}
     */
    static prefixUrl(url: string): string {
        if (url.indexOf('http') === 0) {
            return url;
        }

        if (config.getJenkinsRootURL() !== '' && !url.startsWith(config.getJenkinsRootURL())) {
            return `${config.getJenkinsRootURL()}${url}`;
        }

        return url;
    }

    /**
     * This method checks for for 2XX http codes. Throws error it it is not.
     * This should only be used if not using fetch or fetchJson.
     */
    static checkStatus(response: Response): Response {
        if (response.status >= 300 || response.status < 200) {
            const message = `fetch failed: ${response.status} for ${response.url}`;
            const error: any = new Error(message); //FIXME
            error.response = response;
            throw error;
        }
        return response;
    }

    /**
     * Adds same-origin option to the fetch.
     */
    static sameOriginFetchOption(options: BlueRequestInit = {}): BlueRequestInit {
        const newOpts: BlueRequestInit = clone(options);
        newOpts.credentials = newOpts.credentials || 'same-origin';
        return newOpts;
    }

    /**
     * Enhances the fetchOptions with the JWT bearer token. Will only be needed
     * if not using fetch or fetchJson.
     */
    static jwtFetchOption(token: string, options: BlueRequestInit = {}): BlueRequestInit {
        const newOpts = clone(options);
    
        newOpts.headers = newOpts.headers || {};
        newOpts.headers['Authorization'] = newOpts.headers['Authorization'] || `Bearer ${token}`;
        return newOpts;
    }

    /**
     * REturns the json body from the response. It is only needed if
     * you are using FetchUtils.fetch
     *
     * Usage:
     * FetchUtils.fetch(..).then(FetchUtils.parseJSON)
     */
    
    static parseJSON<T>(response: Response): Promise<T> {
        return (
          response.json()
                // FIXME: workaround for status=200 w/ empty response body that causes error in Chrome
                // server should probably return HTTP 204 instead
                .catch(error => {
                    if (error.message.indexOf('Unexpected end of JSON input') !== -1) {
                        return {};
                    }
                    throw error;
                })
        )
    }

    /* eslint-disable no-param-reassign */
    /**
     * Parses the response body for the error generated in checkStatus.
     */
    static parseErrorJson(error: any): any {
        return error.response.json().then(
            (body:any) => {
                error.responseBody = body;
                throw error;
            },
            () => {
                error.responseBody = null;
                throw error;
            }
        );
    }
    /* eslint-enable no-param-reassign */

    /**
     * Error function helper to log errors to console.
     *
     * Usage;
     * fetchJson(..).catch(FetchUtils.consoleError)
     */
    static consoleError(error: any): void {
        console.error(error); // eslint-disable-line no-console
    }

    /**
     * Error function helper to call a callback on a rejected promise.
     * if callback is null, log to console). Use .catch() if you know it
     * will not be null though.
     *
     * Usage;
     * fetchJson(..).catch(FetchUtils.onError(error => //do something)
     */
    static onError(errorFunc: ((error: any) => any) | undefined): (error: any) => void {
        return error => {
            if (errorFunc) {
                errorFunc(error);
            } else {
                FetchFunctions.consoleError(error);
            }
        };
    }

    /**
     * Raw fetch that returns the json body.
     *
     * This method is semi-private, under normal conditions it should not be
     * used as it does not include the JWT bearer token
     *
     * @param {string} url - The URL to fetch from.
     * @param {Object} [options]
     * @param {function} [options.onSuccess] - Optional callback success function.
     * @param {function} [options.onError] - Optional error callback.
     * @param {Object} [options.fetchOptions] - Optional isomorphic-fetch options.
     * @param {boolean} [options.disableDedupe] - Optional flag to disable dedupe for this request.
     * @param {boolean} [options.disableLoadingIndicator] - Optional flag to disable loading indicator for this request.
     * @returns JSON body
     */
    static rawFetchJSON(
        url: string,
        { onSuccess, onError, fetchOptions, disableDedupe }: FetchFunctions.RawFetchOpts = {}
    ) {
        const request = () => {
            let future = getPrefetchedDataFuture(url); // eslint-disable-line no-use-before-define

            if (!future) {
                future = fetch(url, FetchFunctions.sameOriginFetchOption(fetchOptions));

              
                future = future.then(FetchFunctions.checkStatus).then(FetchFunctions.parseJSON, FetchFunctions.parseErrorJson);

            } 
            if (onSuccess) {
                return future.then(onSuccess).catch(FetchFunctions.onError(onError));
            }

            return future;
        };
        if (disableDedupe || !isGetRequest(fetchOptions)) {
            return request();
        }

        return dedupe(url, request);
    }
    /**
     * Raw fetch.
     *
     * This method is semi-private, under normal conditions it should not be
     * used as it does not include the JWT bearer token
     *
     * @param {string} url - The URL to fetch from.
     * @param {Object} [options]
     * @param {function} [options.onSuccess] - Optional callback success function.
     * @param {function} [options.onError] - Optional error callback.
     * @param {Object} [options.fetchOptions] - Optional isomorphic-fetch options.
     * @param {boolean} [options.disableDedupe] - Optional flag to disable dedupe for this request.
     * @param {boolean} [options.disableLoadingIndicator] - Optional flag to disable loading indicator for this request.
     * @returns fetch response
     */
    static rawFetch(url:string, { onSuccess, onError, fetchOptions, disableDedupe }: FetchFunctions.RawFetchOpts = {}) {
        const request = () => {
            let future = getPrefetchedDataFuture(url); // eslint-disable-line no-use-before-define
            if (!future) {
                future = fetch(url, FetchFunctions.sameOriginFetchOption(fetchOptions));


                future = future.then(FetchFunctions.checkStatus);
            }

            if (onSuccess) {
                return future.then(onSuccess).catch(FetchFunctions.onError(onError));
            }
            return future;
        };

        if (disableDedupe || !isGetRequest(fetchOptions)) {
            return request();
        }

        return dedupe(url, request);
    }
}

export class Fetch {
    /**
     * Fetch JSON data.
     * <p>
     * Utility function that can be mocked for testing.
     *
     * @param {string} url - The URL to fetch from.
     * @param {Object} [options]
     * @param {function} [options.onSuccess] - Optional callback success function.
     * @param {function} [options.onError] - Optional error callback.
     * @param {Object} [options.fetchOptions] - Optional isomorphic-fetch options.
     * @returns JSON body.
     */
    static fetchJSON(url: string, { onSuccess, onError, fetchOptions }: Fetch.FetchOpts = {}) {
        const fixedUrl = FetchFunctions.prefixUrl(url);
        let future;
        if (!config.isJWTEnabled()) {
            future = FetchFunctions.rawFetchJSON(fixedUrl, { onSuccess, onError, fetchOptions});
        } else {
            future = JWT.getToken().then((token:any) =>
                FetchFunctions.rawFetchJSON(fixedUrl, {
                    onSuccess,
                    onError,
                    fetchOptions: FetchFunctions.jwtFetchOption(token, fetchOptions),
                })
            );
        }

     
        return future;
    }

    /**
     * Fetch data.
     * <p>
     * Utility function that can be mocked for testing.
     *
     * @param {string} url - The URL to fetch from.
     * @param {Object} [options]
     * @param {function} [options.onSuccess] - Optional callback success function.
     * @param {function} [options.onError] - Optional error callback.
     * @param {Object} [options.fetchOptions] - Optional isomorphic-fetch options.
     * @returns fetch body.
     */
    static fetch(url: any, { onSuccess, onError, fetchOptions }: Fetch.FetchOpts = {}) {
        const fixedUrl = FetchFunctions.prefixUrl(url);

        if (!config.isJWTEnabled()) {
            return FetchFunctions.rawFetch(fixedUrl, { onSuccess, onError, fetchOptions });
        }

        return JWT.getToken().then((token:any) =>
            FetchFunctions.rawFetch(fixedUrl, {
                onSuccess,
                onError,
                fetchOptions: FetchFunctions.jwtFetchOption(token, fetchOptions),
            })
        );
    }
}

function trimRestUrl(url:string) {
    const REST_PREFIX = 'blue/rest/';
    const prefixOffset = url.indexOf(REST_PREFIX);

    if (prefixOffset !== -1) {
        return url.substring(prefixOffset);
    }

    return url;
}

function getPrefetchedDataFuture(url:string): Promise<Response> | undefined {
    const trimmedUrl = trimRestUrl(url);
    const prefetchdata:any = config.getPrefetchData();
    for (const prop in prefetchdata) {
        if (prefetchdata.hasOwnProperty(prop)) {
            const preFetchEntry = prefetchdata[prop];
            if (preFetchEntry.restUrl && preFetchEntry.data) {
                // If the trimmed/normalized rest URL matches the url arg supplied
                // to the function, construct a pre-resolved future object containing
                // the prefetched data as the value.
                if (trimRestUrl(preFetchEntry.restUrl) === trimmedUrl) {
                    try {
                        return Promise.resolve(JSON.parse(preFetchEntry.data));
                    } finally {
                        // Delete the preFetchEntry i.e. we only use these entries once. So, this
                        // works only for the first request for the data at that URL. Subsequent
                        // calls on that REST endpoint will result in a proper fetch. A local
                        // store needs to be used (redux/mobx etc) if you want to avoid multiple calls
                        // for the same data. This is not a caching layer/mechanism !!!
                        delete prefetchdata[prop];
                    }
                }
            }
        }
    }

    return undefined;
}

function clone<T extends object>(obj: T): T {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj)) as T;
}