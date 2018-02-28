import IsNil from 'lodash-es/isNil';

import Extension from 'neon-extension-browser/extension';
import ActivityService, {ActivityEngine} from 'neon-extension-framework/services/source/activity';
import Registry from 'neon-extension-framework/core/registry';
import {createScript} from 'neon-extension-framework/core/helpers/script';

import Api from '../../api';
import Log from '../../core/logger';
import Plugin from '../../core/plugin';
import Shim from '../../api/shim';
import Parser from './core/parser';
import PlayerMonitor from './player/monitor';


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.engine = null;
        this.monitor = null;
    }

    initialize() {
        super.initialize();

        // Construct activity engine
        this.engine = new ActivityEngine(this.plugin, {
            getDuration: this._getDuration.bind(this),
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
        this.monitor = new PlayerMonitor();

        // Bind activity engine to monitor
        this.engine.bind(this.monitor);

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
            Shim.bind(document);

            // Wait for "ready" event
            Shim.once('ready', () => {
                resolve();
            });

            // TODO implement timeout?

            // Insert script into page
            (document.head || document.documentElement).appendChild(script);
        });
    }

    _getDuration() {
        if(IsNil(this.monitor)) {
            return null;
        }

        return this.monitor.player.getDuration();
    }

    _getMetadata(identifier) {
        Log.debug('Fetching metadata for %o', identifier);

        // Retrieve metadata for `identifier`
        return Api.metadata.get(identifier.key).then((item) => {
            Log.trace('Received item: %o', item);

            // Parse item into metadata models
            let metadata = Parser.parse(item);

            if(IsNil(metadata)) {
                Log.info('Unable to parse item: %o', item);
                return null;
            }

            Log.trace('Parsed item, metadata: %o', metadata);
            return metadata;
        });
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
