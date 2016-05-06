'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var Module = require('module');

module.exports = include;
module.exports.lookup = lookup;

var cache = {};
var resolvedArgv;

function include(filepath) {
    if (filepath in cache) {
        return cache[filepath];
    }

    var code = loadSource(filepath);
    var subModule = new Module(filepath);
    subModule._compile = _moduleCompile;
    subModule.paths = [
        path.dirname(filepath)
    ];

    var paths = path.resolve(path.dirname(module.id), filepath).split(path.sep).slice(0, -1);
    while (paths.length) {
        subModule.paths.push(paths.join(path.sep) + '/node_modules');
        paths.pop();
    }

    return cache[filepath] = subModule._compile(code, filepath);
}

function loadSource(filepath) {
    var content = fs.readFileSync(filepath, 'utf-8');
    // Cut BOM
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

function lookup(filepath) {
    var dirs = path.dirname(filepath).split(path.sep);
    while (dirs.length) {
        let dir = path.join('/', ...dirs);
        dirs.pop();

        if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'scope.js'))) {
            return require(path.join(dir, 'scope.js'));
        }

        // Don't lookup from node_modules
        if (dirs[dirs.length - 1] === 'node_modules') {
            return global;
        }
    }

    return global;
}

function _moduleCompile (content, filename) {
    var self = this;
    // remove shebang
    content = content.replace(/^\#\!.*/, '');

    function require(request) {
        if (request.charAt(0) === '.') {
            request = path.resolve(path.dirname(filename), request);
        }
        return include(request);
    }

    require.resolve = function(request) {
        return Module._resolveFilename(request, self);
    };

    require.include = function(subpath) {
        return include(require.resolve(path.resolve(path.dirname(filename), subpath)));
    };

    Object.defineProperty(require, 'paths', {
        get() {
            throw new Error('require.paths is removed. Use ' +
            'node_modules folders, or the NODE_PATH ' +
            'environment variable instead.');
        }
    });

    require.main = process.mainModule;

    // Enable support to add extra extension types
    require.extensions = Module._extensions;
    require.registerExtension = function() {
        throw new Error('require.registerExtension() removed. Use ' +
        'require.extensions instead.');
    };

    require.cache = Module._cache;

    var dirname = path.dirname(filename);
    // TODO Decide about event name
    // TODO Check arguments
    process.emit('moduleLoaded', module);

    // create wrapper function
    var wrapper
        = '(function (exports, require, module, __filename, __dirname, lookup)'
        + '{ with(lookup(__filename)){ (function(){'
        + content
        + '\n}).call(exports)}});';

    var compiledWrapper = vm.runInThisContext(wrapper, filename);
    if (global.v8debug) {
        if (! resolvedArgv) {
            // we enter the repl if we're not given a filename argument.
            if (process.argv[1]) {
                resolvedArgv = Module._resolveFilename(process.argv[1], null);
            } else {
                resolvedArgv = 'repl';
            }
        }

        // Set breakpoint on module start
        if (filename === resolvedArgv) {
            global.v8debug.Debug.setBreakPoint(compiledWrapper, 0, 0);
        }
    }
    var args = [self.exports, require, self, filename, dirname, lookup];
    compiledWrapper.apply(self.exports, args);

    return self.exports;
}
