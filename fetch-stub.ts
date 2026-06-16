export const fetch = typeof globalThis !== 'undefined' ? globalThis.fetch.bind(globalThis) : (undefined as any);
export const Headers = typeof globalThis !== 'undefined' ? globalThis.Headers : (undefined as any);
export const Request = typeof globalThis !== 'undefined' ? globalThis.Request : (undefined as any);
export const Response = typeof globalThis !== 'undefined' ? globalThis.Response : (undefined as any);
export const FormData = typeof globalThis !== 'undefined' ? globalThis.FormData : (undefined as any);
export const formDataToBlob = function() { return new Blob(); };
export default fetch;
