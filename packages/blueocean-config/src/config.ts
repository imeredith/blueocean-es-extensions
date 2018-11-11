
interface BlueOceanConfig {
    features: { [key: string]: boolean}
    blueoceanAppURL: string
    serverBrowserTimeSkewMillis: number
    jenkinsRootURL: string
    resourceUrl: string
    isLoaded: boolean
    jenkinsConfig: JenkinsConfig
}

interface JenkinsConfig {
    security: {
        enableJWT: boolean
        jwtServiceHostUrl: string
        loginUrl: string
    }
    analytics: boolean
}
interface BlueOcean {
    config: BlueOceanConfig
    prefetchdata: object
    organization: {
        name: string,
        displayName: string,
        organizationGroup: string
    }
}
declare global {
    interface Window {
        $blueocean: BlueOcean
    }
}


export class Config {
    blueocean: BlueOcean

    constructor() {
        this.blueocean = window.$blueocean || {};
        this.loadUrls();
        // any all features added by ?features=SOMETHING,SOMETHING_ELSE
        const pfx: string = "features=";
        const pfxlen = pfx.length;
        const condition =
            window && window.location && window.location.href && window.location.href.split instanceof Function && window.location.href.split('?').length > 0;
        const query = condition ? window.location.href.split('?')[1] : undefined;
        if (query) {
            query.split('&').forEach(
                p =>
                    p.startsWith(pfx) &&
                    p
                        .substring(pfxlen)
                        .split(',')
                        .forEach(f => {
                            this.blueocean.config.features[f] = true;
                        })
            );
        }
    }

    private loadUrls() {
        try {
            const headElement = document.getElementsByTagName('head')[0];

            // Look up where the Blue Ocean app is hosted
            const blueoceanAppURL = headElement.getAttribute('data-appurl');
            this.blueocean.config.blueoceanAppURL = typeof blueoceanAppURL === 'string' ? blueoceanAppURL : '/';

            const serverBrowserTimeSkewMillis = +(headElement.getAttribute('data-servertime') || '') - Date.now();
            this.blueocean.config.serverBrowserTimeSkewMillis = typeof serverBrowserTimeSkewMillis === 'number' ? serverBrowserTimeSkewMillis : 0;
          
            const jenkinsRootURL = headElement.getAttribute('data-rooturl');
            this.getConfig().jenkinsRootURL = typeof jenkinsRootURL === 'string' ? jenkinsRootURL : '/jenkins';
           
            const resourceUrl = headElement.getAttribute('data-resurl');
            this.blueocean.config.resourceUrl = typeof resourceUrl === 'string' ? resourceUrl : '/jenkins/static';
        } catch (e) {
            // headless escape
            this.getConfig().jenkinsRootURL = '/jenkins';
            this.getConfig().serverBrowserTimeSkewMillis = 0;
        }
    }

    getConfig() {
        return this.blueocean.config;
    }

    getJenkinsConfig() {
        return this.blueocean.config.jenkinsConfig || {};
    }

    getOrganizationName(encoded = true) {
        return encoded ? encodeURIComponent(this.blueocean.organization.name) : this.blueocean.organization.name;
    }

    getOrganizationDisplayName() {
        return this.blueocean.organization.displayName;
    }

    getOrganizationGroup() {
        return this.blueocean.organization.organizationGroup;
    }

    getSecurityConfig() {
        return this.getJenkinsConfig().security || {};
    }

    getAnalyticsEnabled() {
        return this.getJenkinsConfig().analytics || false;
    }

    isJWTEnabled() {
        return !!this.getSecurityConfig().enableJWT;
    }

    getJWTServiceHostUrl() {
        return this.getSecurityConfig().jwtServiceHostUrl;
    }

    getLoginUrl() {
        return this.getSecurityConfig().loginUrl;
    }

    isFeatureEnabled(name: string, defaultValue?: boolean) {
        const value = this.getConfig().features[name];
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof defaultValue === 'boolean') {
            return defaultValue;
        }
        return false;
    }

    showOrg() {
        return this.isFeatureEnabled('organizations.enabled', false);
    }

    getJenkinsRootURL() {
        return this.blueocean.config.jenkinsRootURL;
    }

    getResourceURL() {
        return 
    }

    getBlueOceanAppURL() {
        return this.blueocean.config.blueoceanAppURL;
    }

    getServerBrowserTimeSkewMillis() {
      
        return this.blueocean.config.serverBrowserTimeSkewMillis;
    }

    getRestRoot() {
        return `${this.getJenkinsRootURL()}/blue/rest`;
    }

    getPrefetchData() {
        return this.blueocean.prefetchdata;
    }

    /**
     * Set a new "jenkinsConfig" object.
     * Useful for testing in a headless environment.
     * @param newConfig
     * @private
     */
    _setJenkinsConfig(newConfig: JenkinsConfig) {
        this.blueocean.config.jenkinsConfig = newConfig;
    }
};
