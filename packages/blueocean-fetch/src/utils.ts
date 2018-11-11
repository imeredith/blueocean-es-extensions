export function cleanSlashes(url: string) {
    let baseUrl = '';
    let urlParams = '';

    if (url && url.indexOf('?') > -1) {
        baseUrl = url
            .split('?')
            .slice(0, 1)
            .join('');
        urlParams = url
            .split('?')
            .slice(-1)
            .join('');
    } else {
        baseUrl = url;
    }

    // replace any number of consecutive slashes with one slash
    baseUrl = baseUrl.replace(/\/\/+/g, '/');

    if (baseUrl.substr(-1) !== '/') {
        baseUrl = `${baseUrl}/`;
    }

    return !urlParams ? baseUrl : `${baseUrl}?${urlParams}`;
}