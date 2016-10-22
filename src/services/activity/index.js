import Extension from 'eon.extension.browser/extension';
import ActivityService, {ActivityEngine} from 'eon.extension.framework/services/source/activity';
import MessagingBus from 'eon.extension.framework/messaging/bus';
import Registry from 'eon.extension.framework/core/registry';
import {isDefined} from 'eon.extension.framework/core/helpers';
import {createScript} from 'eon.extension.framework/core/helpers/script';

import MetadataApi from '../../api/metadata';
import Log from '../../core/logger';
import Parser from './core/parser';
import Plugin from '../../core/plugin';
import ShimApi from '../../api/shim';
import Monitor from './monitor';


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.bus = null;
        this.engine = null;
        this.monitor = null;
    }

    initialize() {
        super.initialize();

        // Construct messaging bus
        this.bus = new MessagingBus(Plugin.id + ':activity');
        this.bus.connect('eon.extension.core:scrobble');

        // Construct activity engine
        this.engine = new ActivityEngine(this.plugin, this.bus, {
            getMetadata: this._getMetadata.bind(this),
            isEnabled: () => true
        });

        // Bind to document
        this.bind();
    }

    bind() {
        if(document.body === null) {
            Log.info('Document body not loaded yet, will try again in 500ms');
            setTimeout(() => this.bind(), 500);
            return;
        }

        // Initialize activity monitor
        this.monitor = new Monitor(this);
        this.monitor.initialize();

        // Bind activity engine to monitor
        this.engine.bind(this.monitor.player);

        // Inject shim
        this._inject()
            .then(() => this.monitor.bind(document))
            .catch((error) => {
                Log.error('Unable to inject shim:', error);
            });
    }

    _inject() {
        return new Promise((resolve, reject) => {
            let script = createScript(document, Extension.getUrl('/source/netflix/shim/shim.js'));

            // Bind shim api to page
            ShimApi.bind(document);

            // Wait for "ready" event
            ShimApi.once('ready', () => {
                resolve();
            });

            // TODO implement timeout?

            // Insert script into page
            (document.head || document.documentElement).appendChild(script);
        });
    }

    _getMetadata(identifier) {
        Log.debug('Fetching metadata for %o', identifier);

        // Retrieve metadata for `identifier`
        return MetadataApi.get(identifier.key).then((item) => {
            Log.trace('Received item: %o', item);

            // Parse item into metadata models
            let metadata = Parser.parse(item);

            if(!isDefined(metadata)) {
                return Promise.reject(new Error(
                    'Unable to parse item'
                ));
            }

            Log.trace('Parsed item, metadata: %o', metadata);
            return metadata;
        });
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
