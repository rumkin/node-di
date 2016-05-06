const fs = require('fs');
const path = require('path');
const decamelize = require('decamelize');

const scope = {
    name: 'scope',
    value: 3.14
};

module.exports = new Proxy(scope, {
    has(target, prop) {
        if (prop in target) {
            return true;
        }

        if (typeof prop !== 'string') {
            return;
        }

        var filename = decamelize(prop, '-')  + '.js';
        var filepath = path.resolve(__dirname, 'deps', filename);
        return fs.existsSync(filepath);
    },
    get(target, prop) {
        if (prop in target) {
            return target[prop];
        }

        if (typeof prop !== 'string') {
            return;
        }

        var filename = decamelize(prop, '-')  + '.js';
        var filepath = path.resolve(__dirname, 'deps', filename);
        if (fs.existsSync(filepath)) {
            return scope[prop] = require(filepath);
        }

        return null;
    }
});
