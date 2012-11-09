(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return window.setImmediate;
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/lib/Producer.js",function(require,module,exports,__dirname,__filename,process,global){var std = require('std'),
    events = require('events'),
    Client = require('./Client'),
    error = require('./error')

module.exports = std.Class(Client, function(supr) {

    var defaults = {
        reconnectInterval: 1000,
    }

    this._init = function(opts) {
        supr(this, '_init', arguments)
        opts = std.extend(opts, defaults)
        this._reconnectInterval = opts.reconnectInterval
        this.on('closed', std.bind(this, '_retry'))
    }

    this.getStats = function() {
        return "producer "
               + supr(this, "getStats", arguments)
               + ", msgs_requested: " + this._msgs_requested
               + ", msgs_sent: " + this._msgs_sent
               + ", msgs_dropped: " + this._msgs_dropped
               + ", total_processed: " + (this._msgs_dropped + this._msgs_sent)
    }

    this.disconnect = function() {
        supr(this, 'disconnect', arguments)
        this._reconnectInterval = -1
    }

    this._retry = function(address) {
        if (this._reconnectInterval < 0) return
        setTimeout(std.bind(this, '_reconnect'), this._reconnectInterval)
    }

    this._reconnect = function() {
        if (!this.connected() && !this.connecting()) this.connect()
    }
})

});

require.define("/node_modules/std/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"std"}
});

require.define("/node_modules/std/std.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = {
	Class: require('./Class'),
	bind: require('./bind'),
	curry: require('./curry'),
	delay: require('./delay'),
	isArray: require('./isArray'),
	each: require('./each'),
	map: require('./map'),
	pick: require('./pick'),
	extend: require('./extend'),
	slice: require('./slice'),
	pack: require('./pack'),
	unpack: require('./unpack'),
	crc32: require('./crc32'),
	strip: require('./strip')
}

});

require.define("/node_modules/std/Class.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Based off of implementation in https://github.com/mcarter/js.io/blob/master/packages/base.js by Martin Hunt @mgh

	Example usage:

	var Person = Class(function() {

		this._init = function(name) {
			this._name = name
		}

		this.getName = function() {
			return this._name
		}
		
		this.greet = function(name) {
			return 'Hi ' + name + '! My name is ' + this._name
		}
	})

	var CoolKid = Class(Person, function(supr) {
		
		this.greet = function() {
			return supr(this, 'greet', arguments).replace(/^Hi /, 'Sup').replace('My name is', "I'm")
		}

	})

	var john = new Person("John"),
		coolKid = new CoolKid("mr Coolio")
	
	john.greet(coolKid)
	coolKid.greet(john)
*/

module.exports = function Class(parent, proto) {
	if(!proto) { proto = parent }
	proto.prototype = parent.prototype

	var cls = function() { if(this._init) { this._init.apply(this, arguments) }}
	cls.prototype = new proto(function(context, method, args) {
		var target = parent
		while(target = target.prototype) {
			if(target[method]) {
				return target[method].apply(context, args || [])
			}
		}
		throw new Error('supr: parent method ' + method + ' does not exist')
	})

	cls.prototype.constructor = cls
	return cls
}

});

require.define("/node_modules/std/bind.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Example usage:

	function Client() {
		this._socket = new Connection()
		this._socket.open()
		this._socket.on('connected', bind(this, '_log', 'connected!'))
		this._socket.on('connected', bind(this, 'disconnect'))
	}

	Client.prototype._log = function(message) {
		console.log('client says:', message)
	}

	Client.prototype.disconnect = function() {
		this._socket.disconnect()
	}

	Example usage:

	var Toolbar = Class(function() {
		
		this._init = function() {
			this._buttonWasClicked = false
		}
		
		this.addButton = function(clickHandler) {
			this._button = new Button()
			this._button.on('Click', bind(this, '_onButtonClick', clickHandler))
		}

		this._onButtonClick = function(clickHandler) {
			this._buttonWasClicked = true
			clickHandler()
		}

	})

*/
var slice = require('./slice')

module.exports = function bind(context, method /* curry1, curry2, ... curryN */) {
	if (typeof method == 'string') { method = context[method] }
	var curryArgs = slice(arguments, 2)
	return function bound() {
		var invocationArgs = slice(arguments)
		return method.apply(context, curryArgs.concat(invocationArgs))
	}
}


});

require.define("/node_modules/std/slice.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Example usage:

	function log(category, arg1, arg2) { // arg3, arg4, ..., argN
		console.log('log category', category, std.slice(arguments, 1))
	}
*/
module.exports = function args(args, offset, length) {
	if (typeof length == 'undefined') { length = args.length }
	return Array.prototype.slice.call(args, offset || 0, length)
}


});

require.define("/node_modules/std/curry.js",function(require,module,exports,__dirname,__filename,process,global){var slice = require('./slice')

module.exports = function curry(fn /* arg1, arg2, ... argN */) {
	var curryArgs = slice(arguments, 1)
	return function curried() {
		var invocationArgs = slice(arguments)
		return fn.apply(this, curryArgs.concat(invocationArgs))
	}
}


});

require.define("/node_modules/std/delay.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Delay the execution of a function.
	If the function gets called multiple times during a delay, the delayed function gets invoced only once,
	with the arguments of the most recent invocation. This is useful for expensive functions that should
	not be called multiple times during a short time interval, e.g. rendering
	
	Example usage:

	Class(UIComponent, function() {
		this.render = delay(function() {
			...
		}, 250) // render at most 4 times per second
	})

	// Bath messages into a single email
	var EmailBatcher = Class(function() {
		this._init = function() {
			this._queue = []
		}

		this.send = function(email) {
			this._queue.push(email)
			this._scheduleDispatch()
		}

		this._scheduleDispatch = delay(function() {
			smtp.send(this._queue.join('\n\n'))
			this._queue = []
		}, 5000) // send emails at most once every 5 seconds
	})
*/
	
module.exports = function(fn, delay) {
	if (typeof delay != 'number') { delay = 50 }
	var timeout
	return function() {
		var args = arguments
		if (timeout) { return }
		timeout = setTimeout(function() {
			fn.apply(this, args)
		}, delay)
	}
}


});

require.define("/node_modules/std/isArray.js",function(require,module,exports,__dirname,__filename,process,global){// thanks @kangax http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
module.exports = function(obj) {
	return Object.prototype.toString.call(obj) == '[object Array]'
}

});

require.define("/node_modules/std/each.js",function(require,module,exports,__dirname,__filename,process,global){var isArray = require('./isArray')

module.exports = function(items, ctx, fn) {
	if (!items) { return }
	if (!fn) {
		fn = ctx
		ctx = this
	}
	if (isArray(items)) {
		for (var i=0; i < items.length; i++) {
			fn.call(ctx, items[i], i)
		}
	} else {
		for (var key in items) {
			fn.call(ctx, items[key], key)
		}
	}
}

});

require.define("/node_modules/std/map.js",function(require,module,exports,__dirname,__filename,process,global){var each = require('./each')

module.exports = function(items, ctx, fn) {
	var result = []
	if (!fn) {
		fn = ctx
		ctx = this
	}
	each(items, ctx, function(item, key) {
		result.push(fn.call(ctx, item, key))
	})
	return result
}

});

require.define("/node_modules/std/pick.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Example usage:
	pick([1,2,0,'',false,null,undefined]) // -> [1,2,0,'',false]
	pick([1,2,3], function(val, index) { val == 1 }) // -> [1]
*/
var each = require('./each')

module.exports = function pick(arr, fn) {
	var result = []
	if (!fn) { fn = falseOrTruthy }
	each(arr, function(value, index) {
		if (!fn(value, index)) { return }
		result.push(value)
	})
	return result
}

function falseOrTruthy(arg) {
	return !!arg || arg === false
}


});

require.define("/node_modules/std/extend.js",function(require,module,exports,__dirname,__filename,process,global){/*
	Example usage:

	var A = Class(function() {
		
		var defaults = {
			foo: 'cat',
			bar: 'dum'
		}

		this._init = function(opts) {
			opts = std.extend(opts, defaults)
			this._foo = opts.foo
			this._bar = opts.bar
		}

		this.getFoo = function() {
			return this._foo
		}

		this.getBar = function() {
			return this._bar
		}
	})

	var a = new A({ bar:'sim' })
	a.getFoo() == 'cat'
	a.getBar() == 'sim'
*/

module.exports = function extend(target, extendWith) {
	target = target || {}
	for (var key in extendWith) {
		if (typeof target[key] != 'undefined') { continue }
		target[key] = extendWith[key]
	}
	return target
}

});

require.define("/node_modules/std/pack.js",function(require,module,exports,__dirname,__filename,process,global){// https://github.com/kvz/phpjs/raw/2ae4292a8629d6007eae26298bd19339ef97957e/functions/misc/pack.js
// MIT License http://phpjs.org/pages/license

module.exports = function pack (format) {
    // http://kevin.vanzonneveld.net
    // +   original by: Tim de Koning (http://www.kingsquare.nl)
    // +      parts by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +   bugfixed by: Tim de Koning (http://www.kingsquare.nl)
    // %        note 1: Float encoding by: Jonas Raoni Soares Silva
    // %        note 2: Home: http://www.kingsquare.nl/blog/12-12-2009/13507444
    // %        note 3: Feedback: phpjs-pack@kingsquare.nl
    // %        note 4: 'machine dependent byte order and size' aren't
    // %        note 4: applicable for JavaScript; pack works as on a 32bit,
    // %        note 4: little endian machine
    // *     example 1: pack('nvc*', 0x1234, 0x5678, 65, 66);
    // *     returns 1: '4xVAB'
    var formatPointer = 0,
        argumentPointer = 1,
        result = '',
        argument = '',
        i = 0,
        r = [],
        instruction, quantifier, word, precisionBits, exponentBits, extraNullCount;

    // vars used by float encoding
    var bias, minExp, maxExp, minUnnormExp, status, exp, len, bin, signal, n, intPart, floatPart, lastBit, rounded, j, k, tmpResult;

    while (formatPointer < format.length) {
        instruction = format[formatPointer];
        quantifier = '';
        formatPointer++;
        while ((formatPointer < format.length) && (format[formatPointer].match(/[\d\*]/) !== null)) {
            quantifier += format[formatPointer];
            formatPointer++;
        }
        if (quantifier === '') {
            quantifier = '1';
        }

        // Now pack variables: 'quantifier' times 'instruction'
        switch (instruction) {
        case 'a':
            // NUL-padded string
        case 'A':
            // SPACE-padded string
            if (typeof arguments[argumentPointer] === 'undefined') {
                throw new Error('Warning:  pack() Type ' + instruction + ': not enough arguments');
            } else {
                argument = String(arguments[argumentPointer]);
            }
            if (quantifier === '*') {
                quantifier = argument.length;
            }
            for (i = 0; i < quantifier; i++) {
                if (typeof argument[i] === 'undefined') {
                    if (instruction === 'a') {
                        result += String.fromCharCode(0);
                    } else {
                        result += ' ';
                    }
                } else {
                    result += argument[i];
                }
            }
            argumentPointer++;
            break;
        case 'h':
            // Hex string, low nibble first
        case 'H':
            // Hex string, high nibble first
            if (typeof arguments[argumentPointer] === 'undefined') {
                throw new Error('Warning: pack() Type ' + instruction + ': not enough arguments');
            } else {
                argument = arguments[argumentPointer];
            }
            if (quantifier === '*') {
                quantifier = argument.length;
            }
            if (quantifier > argument.length) {
                throw new Error('Warning: pack() Type ' + instruction + ': not enough characters in string');
            }
            for (i = 0; i < quantifier; i += 2) {
                // Always get per 2 bytes...
                word = argument[i];
                if (((i + 1) >= quantifier) || typeof(argument[i + 1]) === 'undefined') {
                    word += '0';
                } else {
                    word += argument[i + 1];
                }
                // The fastest way to reverse?
                if (instruction === 'h') {
                    word = word[1] + word[0];
                }
                result += String.fromCharCode(parseInt(word, 16));
            }
            argumentPointer++;
            break;

        case 'c':
            // signed char
        case 'C':
            // unsigned char
            // c and C is the same in pack
            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }

            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(arguments[argumentPointer]);
                argumentPointer++;
            }
            break;

        case 's':
            // signed short (always 16 bit, machine byte order)
        case 'S':
            // unsigned short (always 16 bit, machine byte order)
        case 'v':
            // s and S is the same in pack
            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }

            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
                argumentPointer++;
            }
            break;

        case 'n':
            // unsigned short (always 16 bit, big endian byte order)
            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }

            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
                argumentPointer++;
            }
            break;

        case 'i':
            // signed integer (machine dependent size and byte order)
        case 'I':
            // unsigned integer (machine dependent size and byte order)
        case 'l':
            // signed long (always 32 bit, machine byte order)
        case 'L':
            // unsigned long (always 32 bit, machine byte order)
        case 'V':
            // unsigned long (always 32 bit, little endian byte order)
            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }

            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF);
                argumentPointer++;
            }

            break;
        case 'N':
            // unsigned long (always 32 bit, big endian byte order)
            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }

            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(arguments[argumentPointer] >> 24 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 16 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] >> 8 & 0xFF);
                result += String.fromCharCode(arguments[argumentPointer] & 0xFF);
                argumentPointer++;
            }
            break;

        case 'f':
            // float (machine dependent size and representation)
        case 'd':
            // double (machine dependent size and representation)
            // version based on IEEE754
            precisionBits = 23;
            exponentBits = 8;
            if (instruction === 'd') {
                precisionBits = 52;
                exponentBits = 11;
            }

            if (quantifier === '*') {
                quantifier = arguments.length - argumentPointer;
            }
            if (quantifier > (arguments.length - argumentPointer)) {
                throw new Error('Warning:  pack() Type ' + instruction + ': too few arguments');
            }
            for (i = 0; i < quantifier; i++) {
                argument = arguments[argumentPointer];
                bias = Math.pow(2, exponentBits - 1) - 1;
                minExp = -bias + 1;
                maxExp = bias;
                minUnnormExp = minExp - precisionBits;
                status = isNaN(n = parseFloat(argument)) || n === -Infinity || n === +Infinity ? n : 0;
                exp = 0;
                len = 2 * bias + 1 + precisionBits + 3;
                bin = new Array(len);
                signal = (n = status !== 0 ? 0 : n) < 0;
                n = Math.abs(n);
                intPart = Math.floor(n);
                floatPart = n - intPart;

                for (k = len; k;) {
                    bin[--k] = 0;
                }
                for (k = bias + 2; intPart && k;) {
                    bin[--k] = intPart % 2;
                    intPart = Math.floor(intPart / 2);
                }
                for (k = bias + 1; floatPart > 0 && k; --floatPart) {
                    (bin[++k] = ((floatPart *= 2) >= 1) - 0);
                }
                for (k = -1; ++k < len && !bin[k];) {}

                if (bin[(lastBit = precisionBits - 1 + (k = (exp = bias + 1 - k) >= minExp && exp <= maxExp ? k + 1 : bias + 1 - (exp = minExp - 1))) + 1]) {
                    if (!(rounded = bin[lastBit])) {
                        for (j = lastBit + 2; !rounded && j < len; rounded = bin[j++]) {}
                    }
                    for (j = lastBit + 1; rounded && --j >= 0;
                    (bin[j] = !bin[j] - 0) && (rounded = 0)) {}
                }

                for (k = k - 2 < 0 ? -1 : k - 3; ++k < len && !bin[k];) {}

                if ((exp = bias + 1 - k) >= minExp && exp <= maxExp) {
                    ++k;
                } else {
                    if (exp < minExp) {
                        if (exp !== bias + 1 - len && exp < minUnnormExp) { /*"encodeFloat::float underflow" */
                        }
                        k = bias + 1 - (exp = minExp - 1);
                    }
                }

                if (intPart || status !== 0) {
                    exp = maxExp + 1;
                    k = bias + 2;
                    if (status === -Infinity) {
                        signal = 1;
                    } else if (isNaN(status)) {
                        bin[k] = 1;
                    }
                }

                n = Math.abs(exp + bias);
                tmpResult = '';

                for (j = exponentBits + 1; --j;) {
                    tmpResult = (n % 2) + tmpResult;
                    n = n >>= 1;
                }

                n = 0;
                j = 0;
                k = (tmpResult = (signal ? '1' : '0') + tmpResult + bin.slice(k, k + precisionBits).join('')).length;
                r = [];

                for (; k;) {
                    n += (1 << j) * tmpResult.charAt(--k);
                    if (j === 7) {
                        r[r.length] = String.fromCharCode(n);
                        n = 0;
                    }
                    j = (j + 1) % 8;
                }

                r[r.length] = n ? String.fromCharCode(n) : '';
                result += r.join('');
                argumentPointer++;
            }
            break;

        case 'x':
            // NUL byte
            if (quantifier === '*') {
                throw new Error('Warning: pack(): Type x: \'*\' ignored');
            }
            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(0);
            }
            break;

        case 'X':
            // Back up one byte
            if (quantifier === '*') {
                throw new Error('Warning: pack(): Type X: \'*\' ignored');
            }
            for (i = 0; i < quantifier; i++) {
                if (result.length === 0) {
                    throw new Error('Warning: pack(): Type X:' + ' outside of string');
                } else {
                    result = result.substring(0, result.length - 1);
                }
            }
            break;

        case '@':
            // NUL-fill to absolute position
            if (quantifier === '*') {
                throw new Error('Warning: pack(): Type X: \'*\' ignored');
            }
            if (quantifier > result.length) {
                extraNullCount = quantifier - result.length;
                for (i = 0; i < extraNullCount; i++) {
                    result += String.fromCharCode(0);
                }
            }
            if (quantifier < result.length) {
                result = result.substring(0, quantifier);
            }
            break;

        default:
            throw new Error('Warning:  pack() Type ' + instruction + ': unknown format code');
        }
    }
    if (argumentPointer < arguments.length) {
        throw new Error('Warning: pack(): ' + (arguments.length - argumentPointer) + ' arguments unused');
    }

    return result;
}

});

require.define("/node_modules/std/unpack.js",function(require,module,exports,__dirname,__filename,process,global){// https://github.com/marcuswestin/phpjs/raw/master/_workbench/misc/unpack.js
// Original repo https://github.com/kvz/phpjs/blob/master/_workbench/misc/unpack.js
// MIT license

module.exports = function unpack(format, data) {
    // http://kevin.vanzonneveld.net
    // +   original by: Tim de Koning (http://www.kingsquare.nl)
    // +      parts by: Jonas Raoni Soares Silva
    // +      http://www.jsfromhell.com
    // %        note 1: Float decoding by: Jonas Raoni Soares Silva
    // %        note 2: Home: http://www.kingsquare.nl/blog/22-12-2009/13650536
    // %        note 3: Feedback: phpjs-unpack@kingsquare.nl
    // %        note 4: 'machine dependant byte order and size' aren't
    // %        note 5: applicable for JavaScript unpack works as on a 32bit,
    // %        note 6: little endian machine
    // *     example 1: unpack('f2test', 'abcddbca');
    // *     returns 1: { 'test1': 1.6777999408082E+22.
    // *     returns 2: 'test2': 2.6100787562286E+20 }

    var formatPointer = 0, dataPointer = 0, result = {}, instruction = '',
            quantifier = '', label = '', currentData = '', i = 0, j = 0,
            word = '', precisionBits = 0, exponentBits = 0, dataByteLength = 0;

    // Used by float decoding
    var b = [], bias,  signal, exponent, significand, divisor, curByte,
            byteValue, startBit = 0, mask, currentResult;

    var readBits = function(start, length, byteArray){
        var offsetLeft, offsetRight, curByte, lastByte, diff, sum;

        function shl(a, b){
            for(++b; --b;) {
                a = ((a %= 0x7fffffff + 1) & 0x40000000) === 0x40000000 ?
                    a * 2 :
                    (a - 0x40000000) * 2 + 0x7fffffff + 1;
            }
            return a;
        }
        if(start < 0 || length <= 0) {
            return 0;
        }

        offsetRight = start % 8;
        curByte = byteArray.length - (start >> 3) - 1;
        lastByte = byteArray.length + (-(start + length) >> 3);
        diff = curByte - lastByte;
        sum = (
                (byteArray[ curByte ] >> offsetRight) &
                ((1 << (diff ? 8 - offsetRight : length)) - 1)
            ) + (
               diff && (offsetLeft = (start + length) % 8) ?
                (byteArray[ lastByte++ ] & ((1 << offsetLeft) - 1)) <<
                (diff-- << 3) - offsetRight :
                0
            );

        for(; diff;) {
            sum += shl(byteArray[ lastByte++ ], (diff-- << 3) - offsetRight);
        }
        return sum;
    };

    while (formatPointer < format.length) {
        instruction = format[formatPointer];

        // Start reading 'quantifier'
        quantifier = '';
        formatPointer++;
        while ((formatPointer < format.length) &&
              (format[formatPointer].match(/[\d\*]/) !== null)) {
            quantifier += format[formatPointer];
            formatPointer++;
        }
        if (quantifier === '') {
            quantifier = '1';
        }


        // Start reading label
        label = '';
        while ((formatPointer < format.length) &&
              (format[formatPointer] !== '/')) {
            label += format[formatPointer];
            formatPointer++;
        }
        if (format[formatPointer] === '/') {
            formatPointer++;
        }

        // Process given instruction
        switch (instruction) {
            case 'a': // NUL-padded string
            case 'A': // SPACE-padded string
                if (quantifier === '*') {
                    quantifier = data.length - dataPointer;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }
                currentData = data.substr(dataPointer, quantifier);
                dataPointer += quantifier;

                if (instruction === 'a') {
                    currentResult = currentData.replace(/\0+$/, '');
                } else {
                    currentResult = currentData.replace(/ +$/, '');
                }
                result[label] = currentResult;
                break;

            case 'h': // Hex string, low nibble first
            case 'H': // Hex string, high nibble first
                if (quantifier === '*') {
                    quantifier = data.length - dataPointer;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }
                currentData = data.substr(dataPointer, quantifier);
                dataPointer += quantifier;

                if (quantifier>currentData.length) {
                    throw new Error('Warning: unpack(): Type ' + instruction +
                            ': not enough input, need '  + quantifier);
                }

                currentResult = '';
                for(i=0;i<currentData.length;i++) {
                    word = currentData.charCodeAt(i).toString(16);
                    if (instruction === 'h') {
                        word = word[1]+word[0];
                    }
                   currentResult += word;
                }
                result[label] = currentResult;
                break;

            case 'c': // signed char
            case 'C': // unsigned c
                if (quantifier === '*') {
                    quantifier = data.length - dataPointer;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer, quantifier);
                dataPointer += quantifier;

                for (i=0;i<currentData.length;i++) {
                     currentResult = currentData.charCodeAt(i);
                     if ((instruction === 'c') && (currentResult >= 128)) {
                        currentResult -= 256;
                     }
                     result[label+(quantifier>1?
                            (i+1):
                            '')] = currentResult;
                }
                break;

            case 'S': // unsigned short (always 16 bit, machine byte order)
            case 's': // signed short (always 16 bit, machine byte order)
            case 'v': // unsigned short (always 16 bit, little endian byte order)
                if (quantifier === '*') {
                    quantifier = (data.length - dataPointer) / 2;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer, quantifier * 2);
                dataPointer += quantifier * 2;

                for (i=0;i<currentData.length;i+=2) {
                     // sum per word;
                    currentResult = (currentData.charCodeAt(i+1) & 0xFF) << 8 +
                            (currentData.charCodeAt(i) & 0xFF);
                    if ((instruction === 's') && (currentResult >= 32768)) {
                        currentResult -= 65536;
                    }
                    result[label+(quantifier>1?
                            ((i/2)+1):
                            '')] = currentResult;
                }
                break;

            case 'n': // unsigned short (always 16 bit, big endian byte order)
                if (quantifier === '*') {
                    quantifier = (data.length - dataPointer) / 2;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer, quantifier * 2);
                dataPointer += quantifier * 2;

                for (i=0;i<currentData.length;i+=2) {
                     // sum per word;
                    currentResult = ((currentData.charCodeAt(i) & 0xFF) << 8) +
                            (currentData.charCodeAt(i+1) & 0xFF);
                    result[label+(quantifier>1?
                            ((i/2)+1):
                            '')] = currentResult;
                }
                break;

            case 'i': // signed integer (machine dependent size and byte order)
            case 'I': // unsigned integer (machine dependent size & byte order)
            case 'l': // signed long (always 32 bit, machine byte order)
            case 'L': // unsigned long (always 32 bit, machine byte order)
            case 'V': // unsigned long (always 32 bit, little endian byte order)
                if (quantifier === '*') {
                    quantifier = (data.length - dataPointer) / 4;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer, quantifier * 4);
                dataPointer += quantifier * 4;

                for (i=0;i<currentData.length;i+=4) {
                    currentResult =
                            ((currentData.charCodeAt(i+3) & 0xFF) << 24) +
                            ((currentData.charCodeAt(i+2) & 0xFF) << 16) +
                            ((currentData.charCodeAt(i+1) & 0xFF) << 8) +
                            ((currentData.charCodeAt(i) & 0xFF));
                    result[label+(quantifier>1?
                            ((i/4)+1):
                            '')] = currentResult;
                }

                break;

            case 'N': // unsigned long (always 32 bit, little endian byte order)
               if (quantifier === '*') {
                    quantifier = (data.length - dataPointer) / 4;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer, quantifier * 4);
                dataPointer += quantifier * 4;

                for (i=0;i<currentData.length;i+=4) {
                    currentResult =
                            ((currentData.charCodeAt(i) & 0xFF) << 24) +
                            ((currentData.charCodeAt(i+1) & 0xFF) << 16) +
                            ((currentData.charCodeAt(i+2) & 0xFF) << 8) +
                            ((currentData.charCodeAt(i+3) & 0xFF));
                    result[label+(quantifier>1?
                            ((i/4)+1):
                            '')] = currentResult;
                }

                break;

            case 'f':
            case 'd':
                exponentBits = 8;
                dataByteLength = 4;
                if (instruction === 'd') {
                    exponentBits = 11;
                    dataByteLength = 8;
                }

               if (quantifier === '*') {
                    quantifier = (data.length - dataPointer) / dataByteLength;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                currentData = data.substr(dataPointer,
                        quantifier * dataByteLength);
                dataPointer += quantifier * dataByteLength;

                for (i=0;i<currentData.length;i+=dataByteLength) {
                    data = currentData.substr(i, dataByteLength);

                    b = [];
                    for(j = data.length-1; j >= 0  ; --j) {
                        b.push(data.charCodeAt(j));
                    }

                    precisionBits = (instruction === 'f')?23:52;

                    bias = Math.pow(2, exponentBits - 1) - 1;
                    signal = readBits(precisionBits + exponentBits, 1, b);
                    exponent = readBits(precisionBits, exponentBits, b);
                    significand = 0;
                    divisor = 2;
                    curByte = b.length + (-precisionBits >> 3) - 1;
                    startBit = 0;

                    do {
                        byteValue = b[ ++curByte ];
                        startBit = precisionBits % 8 || 8;
                        mask = 1 << startBit;
                        for(; (mask >>= 1);) {
                            if (byteValue & mask) {
                                significand += 1 / divisor;
                            }
                            divisor *= 2;
                        }
                    } while ((precisionBits -= startBit));

                        if (exponent === (bias << 1) + 1) {
                            if (significand) {
                                currentResult = NaN;
                            } else {
                                if (signal) {
                                    currentResult = -Infinity;
                                } else {
                                    currentResult = +Infinity;
                                }
                            }
                        } else {
                            if ((1 + signal * -2) * (exponent || significand)) {
                                if (!exponent) {
                                    currentResult = Math.pow(2, -bias + 1) *
                                            significand;
                                } else {
                                    currentResult = Math.pow(2,
                                            exponent - bias) *
                                            (1 + significand);
                                }
                            } else {
                                currentResult = 0;
                            }
                        }
                        result[label+(quantifier>1?
                                ((i/4)+1):
                                '')] = currentResult;
                }

                break;

            case 'x': // NUL byte
            case 'X': // Back up one byte
            case '@': // NUL byte
                 if (quantifier === '*') {
                    quantifier = data.length - dataPointer;
                } else {
                    quantifier = parseInt(quantifier, 10);
                }

                if (quantifier > 0) {
                    if (instruction === 'X') {
                        dataPointer -= quantifier;
                    } else {
                        if (instruction === 'x') {
                            dataPointer += quantifier;
                        } else {
                            dataPointer = quantifier;
                        }
                    }
                }
                break;

            default:
            throw new Error('Warning:  unpack() Type ' + instruction +
                    ': unknown format code');
        }
    }
    return result;
}

});

require.define("/node_modules/std/crc32.js",function(require,module,exports,__dirname,__filename,process,global){// https://github.com/kvz/phpjs/raw/2ae4292a8629d6007eae26298bd19339ef97957e/functions/strings/crc32.js
// MIT License http://phpjs.org/pages/license

var utf8_encode = require('./utf8_encode')

module.exports = function crc32 (str) {
    // http://kevin.vanzonneveld.net
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: T0bsn
    // -    depends on: utf8_encode
    // *     example 1: crc32('Kevin van Zonneveld');
    // *     returns 1: 1249991249
    str = utf8_encode(str);
    var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";

    var crc = 0;
    var x = 0;
    var y = 0;

    crc = crc ^ (-1);
    for (var i = 0, iTop = str.length; i < iTop; i++) {
        y = (crc ^ str.charCodeAt(i)) & 0xFF;
        x = "0x" + table.substr(y * 9, 8);
        crc = (crc >>> 8) ^ x;
    }

    return crc ^ (-1);
}

});

require.define("/node_modules/std/utf8_encode.js",function(require,module,exports,__dirname,__filename,process,global){// https://github.com/kvz/phpjs/raw/2ae4292a8629d6007eae26298bd19339ef97957e/functions/xml/utf8_encode.js
// MIT License http://phpjs.org/pages/license

module.exports = function utf8_encode (argString) {
    // http://kevin.vanzonneveld.net
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: sowberry
    // +    tweaked by: Jack
    // +   bugfixed by: Onno Marsman
    // +   improved by: Yves Sucaet
    // +   bugfixed by: Onno Marsman
    // +   bugfixed by: Ulrich
    // *     example 1: utf8_encode('Kevin van Zonneveld');
    // *     returns 1: 'Kevin van Zonneveld'
    var string = (argString + ''); // .replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var utftext = "",
        start, end, stringl = 0;

    start = end = 0;
    stringl = string.length;
    for (var n = 0; n < stringl; n++) {
        var c1 = string.charCodeAt(n);
        var enc = null;

        if (c1 < 128) {
            end++;
        } else if (c1 > 127 && c1 < 2048) {
            enc = String.fromCharCode((c1 >> 6) | 192) + String.fromCharCode((c1 & 63) | 128);
        } else {
            enc = String.fromCharCode((c1 >> 12) | 224) + String.fromCharCode(((c1 >> 6) & 63) | 128) + String.fromCharCode((c1 & 63) | 128);
        }
        if (enc !== null) {
            if (end > start) {
                utftext += string.slice(start, end);
            }
            utftext += enc;
            start = end = n + 1;
        }
    }

    if (end > start) {
        utftext += string.slice(start, stringl);
    }

    return utftext;
}

});

require.define("/node_modules/std/strip.js",function(require,module,exports,__dirname,__filename,process,global){var stripRegex = /^\s*(.*?)\s*$/
module.exports = function(str) {
	return str.match(stripRegex)[1]
}


});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/lib/Client.js",function(require,module,exports,__dirname,__filename,process,global){// Implements a low-level kafka client which can do the following:
//  - request messages for a topic
//  - get offsets for a topic
//  - send messages to a topic
//
// TODO
//  - queueing of requests when client is down (max sized FIFO)
//  - intelligent collapse (batch) of similar events (e.g. send)
var std = require('std'),
    events = require('events'),
    bigint = require('bigint'),
    Connection = require('./Connection'),
    requestTypes = require('./requestTypes'),
    error = require('./error')

module.exports = std.Class(Connection, function(supr) {
    var states = {
        ERROR: 0,
        HEADER_LEN_0: 1, HEADER_LEN_1: 2, HEADER_LEN_2: 3, HEADER_LEN_3: 4,
        HEADER_EC_0: 5, HEADER_EC_1: 6,
        RESPONSE_MSG_0: 7, RESPONSE_MSG_1: 8, RESPONSE_MSG_2: 9, RESPONSE_MSG_3: 10,
        RESPONSE_MAGIC: 11,
        RESPONSE_COMPRESSION: 12,
        RESPONSE_CHKSUM_0: 13, RESPONSE_CHKSUM_1: 14, RESPONSE_CHKSUM_2: 15, RESPONSE_CHKSUM_3: 16,
        RESPONSE_MSG: 17,

        OFFSET_LEN_0: 18, OFFSET_LEN_1: 19, OFFSET_LEN_2: 20, OFFSET_LEN_3: 21,
        OFFSET_OFFSETS_0: 22, OFFSET_OFFSETS_1: 23, OFFSET_OFFSETS_2: 24, OFFSET_OFFSETS_3: 25,
        OFFSET_OFFSETS_4: 26, OFFSET_OFFSETS_5: 27, OFFSET_OFFSETS_6: 28, OFFSET_OFFSETS_7: 29,
    }

    var LATEST_TIME = -1
    var EARLIEST_TIME = -1
    var MAGIC_VALUE = 0

    var defaults = {
        maxSize: 1048576, //1MB
        autoConnectOnWrite: true,
        sendQueueLength: 10000,
    }

    var fetch_defaults = {
        type: requestTypes.FETCH,
        next: states.RESPONSE_MSG_0,
        last: 'lastmessage',
        encode: function (t) {
            return this._encodeFetchRequest(t)
        },

        partition: 0,
        offset: 0,
    }

    var offset_defaults = {
        type: requestTypes.OFFSETS,
        next: states.OFFSET_LEN_0,
        last: 'lastoffset',
        encode: function (t) {
            return this._encodeOffsetsRequest(t)
        },

        partition: 0,
        offsets: 1,
    }

    var send_defaults = {
        type: requestTypes.PRODUCE,
        encode: function (t) {
            return this._encodeSendRequest(t)
        },

        partition: 0,
    }

    this._init = function(opts) {
        supr(this, '_init', arguments)
        opts = std.extend(opts, defaults)
        this._buffer = new Buffer(opts.maxSize)
        fetch_defaults.encode = fetch_defaults.encode.bind(this)
        offset_defaults.encode = offset_defaults.encode.bind(this)
        send_defaults.encode = send_defaults.encode.bind(this)

        this._autoConnectOnWrite = opts.autoConnectOnWrite
        this._sendQueueLength = opts.sendQueueLength

        this.on('connected', std.bind(this, '_connected'))

        this._msgs_requested = 0
        this._msgs_sent = 0
        this._msgs_dropped = 0

        this._reset()
        this.clearRequests()
    }

    this.getStats = function() {
        return "host: " + this._host + ":" + this._port
             + ", socket.bufferSize: " + (this.connected() ? this._connection.bufferSize : "n/a")
    }

    this.getMaxFetchSize = function() {
        return defaults.maxSize;
    }

    this._reset = function() {
        this._toRead = 0
        this._state = states.HEADER_LEN_0
    }
    
    this.clearRequests = function() {
        this._requests = []        
        this._sendRequests = []
    }

    this.fetchTopic = function(args) {
        var request = std.extend({}, std.extend(args.name == undefined ? { name: args } : args, fetch_defaults))
        request.original_offset = bigint(request.offset)
        request.bytesRead = 0
        this._pushRequest({request: request})
        return this
    }

    this.fetchOffsets = function(args) {
        var request = std.extend({}, std.extend(args.name == undefined ? { name: args } : args, offset_defaults))
        this._pushRequest({request: request})
        return this
    }

    this.send = function(args, messages, callback) {
        var request = std.extend({}, std.extend(messages == undefined ? args : { topic: args, messages: messages}, send_defaults))
        if (!(request.messages instanceof Array)) request.messages = [request.messages]
        var cb = function() {
            this._msgs_sent++
            callback && callback()
        }.bind(this)
        this._msgs_requested++
        this._pushSendRequest({request: request, callback: cb})
        return this
    }

    this._connected = function() {
        this._reset()
        
        // handle data from the connection
        this._connection.on('data', std.bind(this, '_onData'))
        
        // send queued send requests
        // make a copy because socket writes may return immediately and modify the size
        var r = this._sendRequests.slice(0);
        for (i in r) this._writeRequest(r[i])
        // send queued read requests
        for (i in this._requests) this._writeRequest(this._requests[i])
    }

    this._pushSendRequest = function(requestObj) {
        var cb = requestObj.callback;
        requestObj.callback = function() {
            this._sendRequests.shift()
            cb && cb()
        }.bind(this)
        // drop entries if too long
        if (this._sendRequests.length >= this._sendQueueLength) {
            this._msgs_dropped++
            this._sendRequests.shift()
        }
        this._sendRequests.push(requestObj)
        this._writeRequest(requestObj)
    }

    this._pushRequest = function(requestObj) {
        this._requests.push(requestObj)
        this._writeRequest(requestObj)
    }

    this._writeRequest = function(requestObj) {
        if (this._autoConnectOnWrite && !this.connected() && !this.connecting()) {
            this.connect()
            return
        }
        if (!this.connected()) {
            return
        }
	    if (!this._connection.writable) {
	        this.close();
	    } else {
            this._connection.write(requestObj.request.encode(requestObj.request), 'utf8', requestObj.callback)
	    }
    }

    this._encodeFetchRequest = function(t) {
        var offset = bigint(t.offset)
        var request = std.pack('n', t.type)
            + std.pack('n', t.name.length)
            + t.name
            + std.pack('N', t.partition)
            + std.pack('N', offset.shiftRight(32).and(0xffffffff))
            + std.pack('N', offset.and(0xffffffff))
            + std.pack('N', (t.maxSize == undefined)? this._buffer.length : t.maxSize)

        var requestSize = 2 + 2 + t.name.length + 4 + 8 + 4

        return this._bufferPacket(std.pack('N', requestSize) + request)
    }

    this._encodeOffsetsRequest = function(t) {
        var request = std.pack('n', t.type)
            + std.pack('n', t.name.length) + t.name
            + std.pack('N', t.partition)
            + std.pack('N2', -1 , -1)
            + std.pack('N', t.offsets)

        var requestSize = 2 + 2 + t.name.length + 4 + 8 + 4
        return this._bufferPacket(std.pack('N', requestSize) + request)
    }

    this._encodeSendRequest = function(t) {
        var encodedMessages = ''
        for (var i = 0; i < t.messages.length; i++) {
            var encodedMessage = this._encodeMessage(t.messages[i])
            encodedMessages += std.pack('N', encodedMessage.length) + encodedMessage
        }

        var request = std.pack('n', t.type)
            + std.pack('n', t.topic.length) + t.topic
            + std.pack('N', t.partition)
            + std.pack('N', encodedMessages.length) + encodedMessages

        return this._bufferPacket(std.pack('N', request.length) + request)
    }

    this._encodeMessage = function(message) {
        return std.pack('CN', MAGIC_VALUE, std.crc32(message)) + message
    }

    this._onData = function(buf) {
        if (this._requests[0] == undefined) return
        var index = 0        
        while (index != buf.length) {
            var bytes = 1
            var next = this._state + 1
            switch (this._state) {
                case states.ERROR:
                    // just eat the bytes until done
                    next = states.ERROR
                    break
                    
                case states.HEADER_LEN_0:
                    this._totalLen = buf[index] << 24
                    break

                case states.HEADER_LEN_1:
                    this._totalLen += buf[index] << 16
                    break

                case states.HEADER_LEN_2:
                    this._totalLen += buf[index] << 8
                    break

                case states.HEADER_LEN_3:
                    this._totalLen += buf[index]
                    break

                case states.HEADER_EC_0:
                    this._error = buf[index] << 8
                    this._totalLen--
                    break

                case states.HEADER_EC_1:
                    this._error += buf[index]
                    this._toRead = this._totalLen
                    next = this._requests[0].request.next
                    this._totalLen--
                    if (this._error != error.NoError) this.emit('messageerror', 
                                                                this._requests[0].request.name, 
                                                                this._requests[0].request.partition, 
                                                                this._error, 
                                                                error[this._error])
                    break

                case states.RESPONSE_MSG_0:
                    this._msgLen = buf[index] << 24
                    this._requests[0].request.last_offset = bigint(this._requests[0].request.offset)
                    this._requests[0].request.offset++
                    this._payloadLen = 0
                    break

                case states.RESPONSE_MSG_1:
                    this._msgLen += buf[index] << 16
                    this._requests[0].request.offset++
                    break

                case states.RESPONSE_MSG_2:
                    this._msgLen += buf[index] << 8
                    this._requests[0].request.offset++
                    break

                case states.RESPONSE_MSG_3:
                    this._msgLen += buf[index]
                    this._requests[0].request.offset++
                    if (this._msgLen > this._totalLen) {
                        console.log(buf)
                        this.emit("parseerror", 
                                  this._requests[0].request.name,
                                  this._requests[0].request.partition,
                                  "unexpected message len " + this._msgLen + " > " + this._totalLen 
                                  + " for topic: " + this._requests[0].request.name 
                                  + ", partition: " + this._requests[0].request.partition
                                  + ", original_offset:" + this._requests[0].request.original_offset
                                  + ", last_offset: " + this._requests[0].request.last_offset)
                       this._error = error.InvalidMessage
                       next = states.ERROR
                    }
                    break

                case states.RESPONSE_MAGIC:
                    this._magic = buf[index]
                    this._requests[0].request.offset++
                    this._msgLen--
                    if (false && Math.random()*20 > 18) this._magic = 5
                    switch (this._magic) {
                        case 0:
                          next = states.RESPONSE_CHKSUM_0
                          break
                        case 1:
                          next = states.RESPONSE_COMPRESSION
                          break
                        default:
                          this.emit("parseerror", 
                                    this._requests[0].request.name,
                                    this._requests[0].request.partition,
                                    "unexpected message format - bad magic value " + this._magic                                     
                                    + " for topic: " + this._requests[0].request.name 
                                    + ", partition: " + this._requests[0].request.partition
                                    + ", original_offset:" + this._requests[0].request.original_offset
                                    + ", last_offset: " + this._requests[0].request.last_offset)
                          this._error = error.InvalidMessage
                          next = states.ERROR
                    }
                    break

                case states.RESPONSE_COMPRESSION:
                    this._msgLen--
                    this._requests[0].request.offset++
                    if (buf[index] > 0) {
                        console.log(buf)
                        this.emit("parseerror",
                                  this._requests[0].request.name,
                                  this._requests[0].request.partition,
                                  "unexpected message format - bad compression flag " 
                                  + " for topic: " + this._requests[0].request.name 
                                  + ", partition: " + this._requests[0].request.partition
                                  + ", original_offset:" + this._requests[0].request.original_offset
                                  + ", last_offset: " + this._requests[0].request.last_offset)
                        this._error = error.InvalidMessage
                        next = states.ERROR
                    }
                    break
                
                case states.RESPONSE_CHKSUM_0:
                    this._chksum = buf[index] << 24
                    this._requests[0].request.offset++
                    this._msgLen--
                    break

                case states.RESPONSE_CHKSUM_1:
                    this._chksum += buf[index] << 16
                    this._requests[0].request.offset++
                    this._msgLen--
                    break

                case states.RESPONSE_CHKSUM_2:
                    this._chksum += buf[index] << 8
                    this._requests[0].request.offset++
                    this._msgLen--
                    break

                case states.RESPONSE_CHKSUM_3:
                    this._chksum += buf[index]
                    this._requests[0].request.offset++
                    this._msgLen--
                    break

                case states.RESPONSE_MSG:
                    next = states.RESPONSE_MSG

                    // try to avoid a memcpy if possible
                    var payload = null
                    if (this._payloadLen == 0 && buf.length - index >= this._msgLen) {
                        payload = buf.toString('utf8', index, index + this._msgLen)
                        bytes = this._msgLen
                    } else {
                        var end = index + this._msgLen - this._payloadLen
                        if (end > buf.length) end = buf.length
                        buf.copy(this._buffer, this._payloadLen, index, end)
                        this._payloadLen += end - index
                        bytes = end - index
                        if (this._payloadLen == this._msgLen) {
                            payload = this._buffer.toString('utf8', 0, this._payloadLen)
                        }
                    }
                    if (payload != null) {
                        this._requests[0].request.offset += this._msgLen
                        next = states.RESPONSE_MSG_0
                        this.emit('message', this._requests[0].request.name, payload, bigint(this._requests[0].request.offset))
                    }
                    break

                case states.OFFSET_LEN_0:
                    this._msgLen = buf[index] << 24
                    break

                case states.OFFSET_LEN_1:
                    this._msgLen += buf[index] << 16
                    break

                case states.OFFSET_LEN_2:
                    this._msgLen += buf[index] << 8
                    break

                case states.OFFSET_LEN_3:
                    this._msgLen += buf[index]
                    break

                case states.OFFSET_OFFSETS_0:
                    this._requests[0].request.offset_buffer = new Buffer(8)
                    this._requests[0].request.offset_buffer[0] = buf[index]
                    break

                case states.OFFSET_OFFSETS_1:
                    this._requests[0].request.offset_buffer[1] = buf[index]
                    break

                case states.OFFSET_OFFSETS_2:
                    this._requests[0].request.offset_buffer[2] = buf[index]
                    break

                case states.OFFSET_OFFSETS_3:
                    this._requests[0].request.offset_buffer[3] = buf[index]
                    break

                case states.OFFSET_OFFSETS_4:
                    this._requests[0].request.offset_buffer[4] = buf[index]
                    break

                case states.OFFSET_OFFSETS_5:
                    this._requests[0].request.offset_buffer[5] = buf[index]
                    break

                case states.OFFSET_OFFSETS_6:
                    this._requests[0].request.offset_buffer[6] = buf[index]
                    break

                case states.OFFSET_OFFSETS_7:
                    this._requests[0].request.offset_buffer[7] = buf[index]
                    this._requests[0].request.offset = bigint.fromBuffer(this._requests[0].request.offset_buffer)
                    next = states.OFFSET_OFFSETS_0
                    this.emit('offset', this._requests[0].request.name, bigint(this._requests[0].request.offset))
            }
            if (this._requests[0] == undefined) break
            this._requests[0].request.bytesRead += bytes
            index += bytes
            this._toRead -= bytes
            this._state = next
            if (this._toRead == 0) this._last()
        }
    }

    this._last = function() {
        var last = this._requests.shift()

        // we don't know if we got all the messages if we got a buffer full of data
        // so re-request the topic at the last parsed offset, otherwise, emit last
        // message to tell client we are done
        if (last.request.bytesRead >= this._buffer.length) {
            // when we request data from kafka, it just sends us a buffer from disk, limited
            // by the maximum amount of data we asked for (plus a few more for the header len)
            // the end of this data may or may not end on an actual message boundary, and we
            // may have processed an offset header, but not the actual message
            // because the state machine automatically sets the request offset to the offset
            // that is read, we have to detect here if we stopped before the message
            // boundary (the message state will be other than the start of a new mesage).
            //
            // If we did, reset the offset to the last known offset which is
            // saved before processing the offset bytes.
            if (this._state != states.RESPONSE_MSG_0) {
                last.request.offset = bigint(last.request.last_offset)
            }

            this.fetchTopic(last.request)
        } else {
            this.emit(last.request.last, last.request.name, bigint(last.request.offset), this._error, error[this._error])
        }
        this._state = states.HEADER_LEN_0
    }
})

});

require.define("/node_modules/bigint/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./index.js"}
});

require.define("/node_modules/bigint/index.js",function(require,module,exports,__dirname,__filename,process,global){try {
    // node.js versions < 0.5.5
    var cc = new require('./build/default/bigint');
} catch(e) {
    // node.js versions >= 0.5.5
    var cc = new require('./build/Release/bigint');
}
var BigInt = cc.BigInt;

module.exports = BigInt;

BigInt.conditionArgs = function(num, base) {
    if (typeof num !== 'string') num = num.toString(base || 10);
    
    if (num.match(/e\+/)) { // positive exponent
        if (!Number(num).toString().match(/e\+/)) {
        return {
            num: Math.floor(Number(num)).toString(),
            base: 10
        };
    }
    else {
        var pow = Math.ceil(Math.log(num) / Math.log(2));
        var n = (num / Math.pow(2, pow)).toString(2)
            .replace(/^0/,'');
        var i = n.length - n.indexOf('.');
        n = n.replace(/\./,'');
        
        for (; i <= pow; i++) n += '0';
           return {
               num : n,
               base : 2,
           };
        }
    }
    else if (num.match(/e\-/)) { // negative exponent
        return {
            num : Math.floor(Number(num)).toString(),
            base : base || 10
        };
    }
    else {
        return {
            num : num,
            base : base || 10,
        };
    }
};

cc.setJSConditioner(BigInt.conditionArgs);

BigInt.prototype.inspect = function () {
    return '<BigInt ' + this.toString(10) + '>';
};

BigInt.prototype.toNumber = function () {
    return parseInt(this.toString(), 10);
};

[ 'add', 'sub', 'mul', 'div', 'mod' ].forEach(function (op) {
    BigInt.prototype[op] = function (num) {
        if (num instanceof BigInt) {
            return this['b'+op](num);
        }
        else if (typeof num === 'number') {
            if (num >= 0) {
                return this['u'+op](num);
            }
            else if (op === 'add') {
                return this.usub(-num);
            }
            else if (op === 'sub') {
                return this.uadd(-num);
            }
            else {
                var x = BigInt(num);
                return this['b'+op](x);
            }
        }
        else if (typeof num === 'string') {
            var x = BigInt(num);
            return this['b'+op](x);
        }
        else {
            throw new TypeError('Unspecified operation for type '
                + (typeof num) + ' for ' + op);
        }
    };
});

BigInt.prototype.abs = function () {
    return this.babs();
};

BigInt.prototype.neg = function () {
    return this.bneg();
};

BigInt.prototype.powm = function (num, mod) {
    var m, res;

    if ((typeof mod) === 'number' || (typeof mod) === 'string') {
        m = BigInt(mod);
    }
    else if (mod instanceof BigInt) {
        m = mod;
    }
    
    if ((typeof num) === 'number') {
        return this.upowm(num, m);
    }
    else if ((typeof num) === 'string') {
        var n = BigInt(num);
        return this.bpowm(n, m);
    }
    else if (num instanceof BigInt) {
        return this.bpowm(num, m);
    }
};

BigInt.prototype.mod = function (num, mod) {
    var m, res;
    
    if ((typeof mod) === 'number' || (typeof mod) === 'string') {
        m = BigInt(mod);
    }
    else if (mod instanceof BigInt) {
        m = mod;
    }
    
    if ((typeof num) === 'number') {
        return this.umod(num, m);
    }
    else if ((typeof num) === 'string') {
        var n = BigInt(num);
        return this.bmod(n, m);
    }
    else if (num instanceof BigInt) {
        return this.bmod(num, m);
    }
};


BigInt.prototype.pow = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.upow(num);
        }
        else {
            return BigInt.prototype.powm.call(this, num, this);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigInt.prototype.pow.call(this, x);
    }
};

BigInt.prototype.shiftLeft = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.umul2exp(num);
        }
        else {
            return this.shiftRight(-num);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigInt.prototype.shiftLeft.call(this, x);
    }
};

BigInt.prototype.shiftRight = function (num) {
    if (typeof num === 'number') {
        if (num >= 0) {
            return this.udiv2exp(num);
        }
        else {
            return this.shiftLeft(-num);
        }
    }
    else {
        var x = parseInt(num.toString(), 10);
        return BigInt.prototype.shiftRight.call(this, x);
    }
};

BigInt.prototype.cmp = function (num) {
    if (num instanceof BigInt) {
        return this.bcompare(num);
    }
    else if (typeof num === 'number') {
        if (num < 0) {
            return this.scompare(num);
        }
        else {
            return this.ucompare(num);
        }
    }
    else {
        var x = BigInt(num);
        return this.bcompare(x);
    }
};

BigInt.prototype.gt = function (num) {
    return this.cmp(num) > 0;
};

BigInt.prototype.ge = function (num) {
    return this.cmp(num) >= 0;
};

BigInt.prototype.eq = function (num) {
    return this.cmp(num) === 0;
};

BigInt.prototype.ne = function (num) {
    return this.cmp(num) !== 0;
};

BigInt.prototype.lt = function (num) {
    return this.cmp(num) < 0;
};

BigInt.prototype.le = function (num) {
    return this.cmp(num) <= 0;
};

'and or xor'.split(' ').forEach(function (name) {
    BigInt.prototype[name] = function (num) {
        if (num instanceof BigInt) {
            return this['b' + name](num);
        }
        else {
            var x = BigInt(num);
            return this['b' + name](x);
        }
    };
});

BigInt.prototype.sqrt = function() {
    return this.bsqrt();
};

BigInt.prototype.root = function(num) {
    if (num instanceof BigInt) {
        return this.broot(num);
    }
    else {
        var x = BigInt(num);
        return this.broot(num);
    }
};

BigInt.prototype.rand = function (to) {
    if (to === undefined) {
        if (this.toString() === '1') {
            return BigInt(0);
        }
        else {
            return this.brand0();
        }
    }
    else {
        var x = to instanceof BigInt
            ? to.sub(this)
            : BigInt(to).sub(this);
        return x.brand0().add(this);
    }
};

BigInt.prototype.invertm = function (mod) {
    if (mod instanceof BigInt) {
        return this.binvertm(mod);
    }
    else {
        var x = BigInt(mod);
        return this.binvertm(x);
    }
};

BigInt.prototype.probPrime = function (reps) {
    var n = this.probprime(reps || 10);
    return { 2 : true, 1 : 'maybe', 0 : false }[n];
};

BigInt.prototype.nextPrime = function () {
    return this.nextprime();
};

BigInt.fromBuffer = function (buf, opts) {
    if (!opts) opts = {};
    
    var endian = { 1 : 'big', '-1' : 'little' }[opts.endian]
        || opts.endian || 'big'
    ;
    
    var size = opts.size || 1;
    
    if (buf.length % size !== 0) {
        throw new RangeError('Buffer length (' + buf.length + ')'
            + ' must be a multiple of size (' + size + ')'
        );
    }
    
    var hex = [];
    for (var i = 0; i < buf.length; i += size) {
        var chunk = [];
        for (var j = 0; j < size; j++) {
            chunk.push(buf[
                i + (endian === 'big' ? j : (size - j - 1))
            ]);
        }
        
        hex.push(chunk
            .map(function (c) {
                return (c < 16 ? '0' : '') + c.toString(16);
            })
            .join('')
        );
    }
    
    return BigInt(hex.join(''), 16);
};

BigInt.prototype.toBuffer = function (opts) {
    if (typeof opts === 'string') {
        if (opts !== 'mpint') return 'Unsupported Buffer representation';
        
        var abs = this.abs();
        var buf = abs.toBuffer({ size : 1, endian : 'big' });
        var len = buf.length === 1 && buf[0] === 0 ? 0 : buf.length;
        if (buf[0] & 0x80) len ++;
        
        var ret = new Buffer(4 + len);
        if (len > 0) buf.copy(ret, 4 + (buf[0] & 0x80 ? 1 : 0));
        if (buf[0] & 0x80) ret[4] = 0;
        
        ret[0] = len & (0xff << 24);
        ret[1] = len & (0xff << 16);
        ret[2] = len & (0xff << 8);
        ret[3] = len & (0xff << 0);
        
        // two's compliment for negative integers:
        var isNeg = this.lt(0);
        if (isNeg) {
            for (var i = 4; i < ret.length; i++) {
                ret[i] = 0xff - ret[i];
            }
        }
        ret[4] = (ret[4] & 0x7f) | (isNeg ? 0x80 : 0);
        if (isNeg) ret[ret.length - 1] ++;
        
        return ret;
    }
    
    if (!opts) opts = {};
    
    var endian = { 1 : 'big', '-1' : 'little' }[opts.endian]
        || opts.endian || 'big'
    ;
    var size = opts.size || 1;
    
    var hex = this.toString(16);
    if (hex.charAt(0) === '-') throw new Error(
        'converting negative numbers to Buffers not supported yet'
    );
    
    var len = Math.ceil(hex.length / (2 * size)) * size;
    var buf = new Buffer(len);
    
    // zero-pad the hex string so the chunks are all `size` long
    while (hex.length < 2 * len) hex = '0' + hex;
    
    var hx = hex
        .split(new RegExp('(.{' + (2 * size) + '})'))
        .filter(function (s) { return s.length > 0 })
    ;
    
    hx.forEach(function (chunk, i) {
        for (var j = 0; j < size; j++) {
            var ix = i * size + (endian === 'big' ? j : size - j - 1);
            buf[ix] = parseInt(chunk.slice(j*2,j*2+2), 16);
        }
    });
    
    return buf;
};

Object.keys(BigInt.prototype).forEach(function (name) {
    if (name === 'inspect' || name === 'toString') return;
    
    BigInt[name] = function (num) {
        var args = [].slice.call(arguments, 1);
        
        if (num instanceof BigInt) {
            return num[name].apply(num, args);
        }
        else {
            var bigi = BigInt(num);
            return bigi[name].apply(bigi, args);
        }
    };
});

});

require.define("/lib/Connection.js",function(require,module,exports,__dirname,__filename,process,global){var std = require('std'),
    net = require('net'),
    events = require('events')

module.exports = std.Class(events.EventEmitter, function() {

    var defaults = {
        host: 'localhost',
        port: 9092
    }

    this._init = function(opts) {
        opts = std.extend(opts, defaults)
        this._host = opts.host
        this._port = opts.port
    }

    this.connect = function(callback) {
        if (this._connection) {
            // this is really hard to track down if it happens, so printing
            // stack trace to console is a good idea for now
            console.log(new Error().stack)
            throw new Error("connect called twice")
        }
        // the expression here is just to make it easy to inject this error for testing
        // switch true to false and it will inject the error 20% of the time
        if (true || Math.random() > 0.8) {
            this._connection = net.createConnection(this._port, this._host)
        }
        if (!this._connection) {
            this.emit('connection_error', this._address(), "Couldn't create socket")
            this.emit('closed', this._address())
            return this
        }
        this._connection.on('connect', std.bind(this, '_handleSocketConnect'))
        this._connection.on('error', std.bind(this, '_handleSocketError'))
        this._connection.on('end', std.bind(this, '_handleSocketEnd'))
        if (callback != undefined) this._connection.on('connect', callback)
        this.emit("connecting", this._address())
        return this
    }

    this.close = function() {
        if (this.connected()) this._connection.end()
        delete this._connection
        this.emit('closed', this._address())
        return this
    }

    this.disconnect = function() {
        this.close(false)
    }

    this.connecting = function() {
        return this._connection != null && this._connection._connecting;
    }

    this.connected = function() {
        return this._connection != null && !this._connection._connecting
    }

    this._handleSocketEnd = function() {
        this.emit('disconnected',  this._address())
    }

    this._handleSocketError = function(error) {
        this.emit("connection_error", this._address(), error)
        this.close()
    }

    this._handleSocketConnect = function() {
        this._connection.on('close', std.bind(this, 'close'))
        this.emit('connected',  this._address())
    }

    this._address = function() {
        return "kafka://" + this._host + ":" + this._port
    }

    this._bufferPacket = function(packet) {
        var len = packet.length,
            buffer = new Buffer(len)

        for (var i=0; i<len; i++) {
            buffer[i] = packet.charCodeAt(i)
        }

        return buffer
    }
})

});

require.define("net",function(require,module,exports,__dirname,__filename,process,global){// todo

});

require.define("/lib/requestTypes.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = {
	PRODUCE     : 0,
	FETCH       : 1,
	MULTIFETCH  : 2,
	MULTIPRODUCE: 3,
	OFFSETS     : 4
}



});

require.define("/lib/error.js",function(require,module,exports,__dirname,__filename,process,global){var each = require('std/each')

module.exports = {
	NoError: 0,
	OffsetOutOfRange: 1,
	InvalidMessage: 2,
	WrongPartition: 3,
	InvalidRetchSize:4
}

each(['NoError', 'OffsetOutOfRange', 'InvalidMessage', 'WrongPartition', 'InvalidRetchSize'], function(name, codeNum) {
	module.exports[name] = codeNum
	module.exports[codeNum] = name
})


});

require.define("/lib/Consumer.js",function(require,module,exports,__dirname,__filename,process,global){var std = require('std'),
    events = require('events'),
    Client = require('./Client'),
    error = require('./error')

module.exports = std.Class(Client, function(supr) {

    var defaults = {
        reconnectInterval: 1000,
        pollInterval: 2000,
    }

    var subscription_defaults = {
        offset: 0,
        partition: 0,
    }

    this._init = function(opts) {
        supr(this, '_init', arguments)
        opts = std.extend(opts, defaults)
        this._pollInterval = opts.pollInterval
        this._reconnectInterval = opts.reconnectInterval
        this._topics = []
        this._outstanding = 0
        this._timerTicked = true
        
        this.on('message', std.bind(this, '_processMessage'))
        this.on('lastmessage', std.bind(this, '_processLast'))
        this.on('closed', std.bind(this, '_closed'))

        this._timeoutID = setTimeout(std.bind(this, '_tick'), this._pollInterval)
    }

    this.topics = function() { return this._topics.length }

    this.subscribeTopic = function(opts) {
        var topic = opts.name == undefined ? { name:opts, offset:0, partition: 0 } : std.extend(opts, subscription_defaults)
        this._topics.push(topic)
        if (this._topics.length == 1) this._pollForMessages()
        return this
    }

    this.unsubscribeTopic = function(name) {
        for (i in this._topics) if (this._topics[i].name == name) {
            this._topics.splice(i, 1)
            break
        }
        return this
    }

    this.getStats = function() {
        return "consumer "
               + supr(this, "getStats", arguments)
               + ", topics: " + this.topics()
    }
        
    this._closed = function(address) {
        if (this._reconnectInterval < 0) return
        
        this._outstanding = 0
        this._timerTicked = false
        this.clearRequests()
        this.emit('debug', "_closed is setting up timer for reconnect")     
        setTimeout(std.bind(this, '_reconnect'), this._reconnectInterval)
    }

    this._reconnect = function() {
        if (!this.connected() && !this.connecting()) {
            this.emit('debug', "_reconnect is calling connect")
            this.connect()
        }
    }

    this.disconnect = function() {
        supr(this, 'disconnect', arguments)
        this._reconnectInterval = -1
    }
    
    this._pollForMessages = function() {
        if (this._outstanding > 0 || !this._timerTicked) return
        
        this._timerTicked = false
        for (i in this._topics) {
            this._outstanding++
            this.fetchTopic(this._topics[i])
        }
    }

    this._processMessage = function(topic, message, offset) {
        for (i in this._topics) if (this._topics[i].name == topic) {
            this.emit('debug', "_processMessage is setting new offset for topic:" + topic + " offset: " + offset)
            this._topics[i].offset = offset
            break
        }        
    }
    
    this._processLast = function(topic, offset, errno, error) {
        if (false && Math.random()*100 > 90) {
            for (i in this._topics) if (this._topics[i].name == topic) {
                console.log("INJECTING ERRONEOUS OFFSET TO TOPIC: " + topic + " OFFSET: " + (offset-1000))
                this._topics[i].offset = offset - 1000
                break
            }        
        }
        this._outstanding--
        this._pollForMessages()            
    }

    this._tick = function() {
        this._timeoutID = setTimeout(std.bind(this, '_tick'), this._pollInterval)
        this._timerTicked = true
        this._pollForMessages()
    }
})
});

require.define("/kafka.js",function(require,module,exports,__dirname,__filename,process,global){module.exports = {
	Producer: require('./lib/Producer'),
	Consumer: require('./lib/Consumer'),
	Client: require('./lib/Client'),
	error: require('./lib/error')
}


});
// window['Buffer'] = require("buffer").Buffer;
window['Bigint'] = require("bigint").Bigint;
window['kafka'] = require("/kafka.js");
})();

