// Original code was taken from https://github.com/kvz/phpjs
// MIT License http://phpjs.org/pages/license

var std = {
  arrayToObject: function(arr) {
    var obj = {}
    for (var i=0; i<arr.length; i++) { obj[arr[i]] = true }
    return obj
  },

  copy: function(obj, deep) {
    var result = this.isArray(obj) ? [] : {}
    this.each(obj, function(val, key) {
      result[key] = (deep && typeof val == 'object') ? this.copy(val, deep) : val
    })
    return result
  },

  pack: function(format) {
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
 },

crc32: function(str) {
    // http://kevin.vanzonneveld.net
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // +   improved by: T0bsn
    // -    depends on: utf8_encode
    // *     example 1: crc32('Kevin van Zonneveld');
    // *     returns 1: 1249991249
    str = this.utf8_encode(str);
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
},

utf8_encode: function(string) {
  string = string.replace(/\r\n/g,"\n");
  var utftext = "";

  for (var n = 0; n < string.length; n++) {

    var c = string.charCodeAt(n);

    if (c < 128) {
      utftext += String.fromCharCode(c);
    }
    else if((c > 127) && (c < 2048)) {
      utftext += String.fromCharCode((c >> 6) | 192);
      utftext += String.fromCharCode((c & 63) | 128);
    }
    else {
      utftext += String.fromCharCode((c >> 12) | 224);
      utftext += String.fromCharCode(((c >> 6) & 63) | 128);
      utftext += String.fromCharCode((c & 63) | 128);
    }

  }

  return utftext;
},

slice: function args(args, offset, length) {
  if (typeof length == 'undefined') { length = args.length };
  return Array.prototype.slice.call(args, offset || 0, length);
},

bind: function(context, method /* curry1, curry2, ... curryN */) {
  if (typeof method == 'string') { method = context[method] }
  var curryArgs = this.slice(arguments, 2)

  return function bound() {
    var invocationArgs = std.slice(arguments)
    return method.apply(context, curryArgs.concat(invocationArgs))
  }
},

each: function(items, ctx, fn) {
  if (!items) { return }
  if (!fn) {
    fn = ctx
    ctx = this
  }
  if (this.isArray(items) || this.isArguments(items)) {
    for (var i=0; i < items.length; i++) {
      fn.call(ctx, items[i], i)
    }
  } else {
    for (var key in items) {
      if (!items.hasOwnProperty(key)) { continue }
      fn.call(ctx, items[key], key)
    }
  }
},

extend: function (target, extendWith) {
  target = this.copy(target)
  for (var key in extendWith) {
    if (typeof target[key] != 'undefined') { continue }
    target[key] = extendWith[key]
  }
  return target
},

isArguments: function(obj) {
  return Object.prototype.toString.call(obj) == '[object Arguments]'
},

isArray: (function() {
  if (Array.isArray && Array.isArray.toString().match('\\[native code\\]')) {
    return function(obj) {
      return Array.isArray(obj)
    }
  } else {
    // thanks @kangax http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
    return function(obj) {
      return Object.prototype.toString.call(obj) == '[object Array]'
    }
  }
})(),

Class: function(/* optParent, optMixin1, optMixin2, ..., proto */) {
  var args = arguments,
    numOptArgs = args.length - 1,
    mixins = []

  // the prototype function is always the last argument
  var proto = args[numOptArgs]

  // if there's more than one argument, then the first argument is the parent class
  if (numOptArgs) {
    var parent = args[0]
    if (parent) { proto.prototype = parent.prototype }
  }

  for (var i=1; i < numOptArgs; i++) { mixins.push(arguments[i]) }

  // cls is the actual class function. Classes may implement this.init = function(){ ... },
  // which gets called upon instantiation
  var cls = function() {
    if(this.init) { this.init.apply(this, arguments) }
    for (var i=0, mixin; mixin = mixins[i]; i++) {
      if (mixin.init) { mixin.init.apply(this) }
    }
  }

  // the proto function gets called with the supr function as an argument. supr climbs the
  // inheritence chain, looking for the named method
  cls.prototype = new proto(function supr(context, method, args) {
    var target = parent
    while(target = target.prototype) {
      if(target[method]) {
        return target[method].apply(context, args || [])
      }
    }
    throw new Error('supr: parent method ' + method + ' does not exist')
  })

  // add all mixins' properties to the class' prototype object
  for (var i=0, mixin; mixin = mixins[i]; i++) {
    for (var propertyName in mixin) {
      if (!mixin.hasOwnProperty(propertyName) || propertyName == 'init') { continue }
      if (cls.prototype.hasOwnProperty(propertyName)) {
        throw new Error('Mixin property "'+propertyName+'" already exists on class')
      }
      cls.prototype[propertyName] = mixin[propertyName]
    }
  }

  cls.prototype.constructor = cls
  return cls
}

}