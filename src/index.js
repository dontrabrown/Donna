var winston = require('winston');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var Q = require('q');

// Routers
var InputRouter = require('./routers/input');
var IntentRouter = require('./routers/intent');
var OutputRouter = require('./routers/output');
// Config
var Config = require('./config');
// Entities
var InputEntity = require('./entities/input');
var IntentEntity = require('./entities/intent');

var Donna = module.exports = (function() {

    Donna.logger = null;

    Donna.outputEmitter = null;

    Donna.options = null;

    Donna.inputRouter = null;
    Donna.intentRouter = null;
    Donna.outputRouter = null;

    Donna.config = null;

    Donna.InputEntity = InputEntity;
    Donna.IntentEntity = IntentEntity;

    // http://stackoverflow.com/a/1608546/2578205
    Donna.prototype.createInputEntity = (function() {
        function F(args) {
            return InputEntity.apply(this, args);
        }
        F.prototype = InputEntity.prototype;
        return function() {
            return new F(arguments);
        }
    })();
    Donna.createInputEntity = Donna.prototype.createInputEntity;
    Donna.prototype.createIntentEntity = (function() {
        function F(args) {
            return IntentEntity.apply(this, args);
        }
        F.prototype = IntentEntity.prototype;
        return function() {
            return new F(arguments);
        }
    })();
    Donna.createIntentEntity = Donna.prototype.createIntentEntity;

    Donna.prototype.defaultOptions = {
        logger: {
            colorize: true,
            timestamp: true,
            showLevel: true,
            level: "debug"
        }
    };

    function Donna(options) {

        // Merge options and defaults
        options = typeof options === "undefined" ? {} : options;
        this.config = new Config();
        _.merge(this.config, _.cloneDeep(Donna.prototype.defaultOptions));
        _.merge(this.config, options);

        return this;
    }

    Donna.prototype.registerPlugin = function(plugin) {
        var deferred = Q.defer();

        if (typeof plugin === "string") {
            this.logger.debug("Register plugin", plugin);
            require(plugin)(this);
            deferred.resolve();
        } else if (typeof plugin === "function") {
            plugin(this);
            deferred.resolve();
        } else {
            var err = new Error("Plugin not supported. Type "+typeof plugin);
            this.logger.error(err);
            deferred.resolve();
        }
        return deferred.promise;

    };

    Donna.prototype.setupLogger = function() {
        // Setup Logger
        var options = this.config.logger;
        var logger = new(winston.Logger);
        logger.add(winston.transports.Console, options);
        // Attach logger to Donna
        this.logger = logger;
        logger.debug("Logger initialized");
    };

    Donna.prototype.init = function() {
        var self = this;
        var deferred = Q.defer();

        this.setupLogger();
        this.logger.info("Initializing Donna");

        var cb = function(err) {
            self.logger.info("Done initializing Donna");
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        };

        // Routers
        this.inputRouter = new InputRouter(this);
        this.intentRouter = new IntentRouter(this);
        this.outputRouter = new OutputRouter(this);

        // Register plugins
        var plugins = require('./plugins')(this, cb);

        return deferred.promise;
    };

    Donna.prototype.registerIntent = function(intent, handler) {
        var deferred = Q.defer();
        this.intentRouter.register(intent, handler, function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    };

    // TODO: Sense plugin emits events that are handled by the Brain
    Donna.prototype.registerSense = function(sense) {
        var senseInst = sense(this);
        this.senses.push(senseInst);

        return this;
    }

    /**
    Intent Extractors take in an InputEntity and
    will propogate any IntentEntity results from that to Donna.
    */
    Donna.prototype.registerIntentExtractor = function(meta, handler) {
        return this.inputRouter.register(meta, handler);
    };

    // Input to Intent
    Donna.prototype.input = function(inputEntity) {
        return this.inputRouter.process(inputEntity);
    };

    // Intent router
    Donna.prototype.intent = function(intentEntity) {
        this.logger.debug('received intente!!!!');
        return this.intentRouter.process(intentEntity);
    };

    // Process Intent in Brain with plugins

    // Output router

    // Output to Output plugin

    return Donna;

})();
