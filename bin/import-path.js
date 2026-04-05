import { pathToFileURL } from 'url';

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;
const URL_SCHEME = /^(file|data|node):/;

export function toImportSpecifier(modulePath) {
    if (URL_SCHEME.test(modulePath)) {
        return modulePath;
    }

    if (WINDOWS_ABSOLUTE_PATH.test(modulePath)) {
        return encodeURI(`file:///${modulePath.replace(/\\/g, '/')}`);
    }

    return pathToFileURL(modulePath).href;
}
