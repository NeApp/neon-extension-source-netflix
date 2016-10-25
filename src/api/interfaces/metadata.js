import Interface from './base';


export default class MetadataInterface extends Interface {
    get(id, imageFormat) {
        return this._client.request('GET', '/metadata', {
            query: {
                movieid: id,
                imageFormat: imageFormat || 'webp'
            }
        });
    }
}