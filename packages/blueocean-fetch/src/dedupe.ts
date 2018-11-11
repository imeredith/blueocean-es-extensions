/**
 * DuplicateCallTracker maintains active calls against a particular key
 */
export class DeDupeCallTracker {
    private promises: { [url: string]: PromiseLike<any>}
    constructor() {
        /**
         * Onload callbacks cache. Used to ensure we don't
         * issue multiple in-parallel requests for the same
         * class metadata.
         */
        this.promises = {};
    }

    /**
     * Generalization of duplicate request consolidation:
     *
     * @key: key to use to track the duplicate requests
     * @promiseCreator: function that will return an initial promise, e.g. () => fetch(...)
     * @return a Promise
     */
    dedupe(key: string, promiseCreator: () => Promise<any>) {
        // get active or create
        return (
            this.promises[key] ||
            (this.promises[key] = promiseCreator()
                .then(data => {
                    delete this.promises[key];
                    return data;
                })
                .catch(err => {
                    delete this.promises[key];
                    return Promise.reject(err);
                }
        )));
    }
}

const deDupeCallTracker = new DeDupeCallTracker();

/**
 * Generalization of duplicate request consolidation:
 *
 * @key: key to use to track the duplicate requests
 * @promiseCreator: function that will return an initial promise, e.g. () => fetch(...)
 * @return a Promise
 */
export function dedupe(key: string, promiseCreator: () => Promise<any>) {
    return deDupeCallTracker.dedupe(key, promiseCreator);
}
