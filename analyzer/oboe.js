'use strict';
(function (window, Object, Array, Error, JSON, undefined) {
    var partialComplete = varArgs(function (fn, args) {
        var numBoundArgs = args.length;
        return varArgs(function (callArgs) {
            for (var i = 0; i < callArgs.length; i++) {
                args[numBoundArgs + i] = callArgs[i];
            }
            args.length = numBoundArgs + callArgs.length;
            return fn.apply(this, args);
        });
    }), compose = varArgs(function (fns) {
        var fnsList = arrayAsList(fns);

        function next(params, curFn) {
            return [apply(params, curFn)];
        }

        return varArgs(function (startParams) {
            return foldR(next, startParams, fnsList)[0];
        });
    });

    function compose2(f1, f2) {
        return function () {
            return f1.call(this, f2.apply(this, arguments));
        }
    }

    function attr(key) {
        return function (o) {
            return o[key];
        };
    }

    var lazyUnion = varArgs(function (fns) {
        return varArgs(function (params) {
            var maybeValue;
            for (var i = 0; i < len(fns); i++) {
                maybeValue = apply(params, fns[i]);
                if (maybeValue) {
                    return maybeValue;
                }
            }
        });
    });

    function apply(args, fn) {
        return fn.apply(undefined, args);
    }

    function varArgs(fn) {
        var numberOfFixedArguments = fn.length - 1, slice = Array.prototype.slice;
        if (numberOfFixedArguments == 0) {
            return function () {
                return fn.call(this, slice.call(arguments));
            }
        } else if (numberOfFixedArguments == 1) {
            return function () {
                return fn.call(this, arguments[0], slice.call(arguments, 1));
            }
        }
        var argsHolder = Array(fn.length);
        return function () {
            for (var i = 0; i < numberOfFixedArguments; i++) {
                argsHolder[i] = arguments[i];
            }
            argsHolder[numberOfFixedArguments] = slice.call(arguments, numberOfFixedArguments);
            return fn.apply(this, argsHolder);
        }
    }

    function flip(fn) {
        return function (a, b) {
            return fn(b, a);
        }
    }

    function lazyIntersection(fn1, fn2) {
        return function (param) {
            return fn1(param) && fn2(param);
        };
    }

    function noop() {
    }

    function always() {
        return true
    }

    function functor(val) {
        return function () {
            return val;
        }
    }

    function isOfType(T, maybeSomething) {
        return maybeSomething && maybeSomething.constructor === T;
    }

    var len = attr('length'), isString = partialComplete(isOfType, String);

    function defined(value) {
        return value !== undefined;
    }

    function hasAllProperties(fieldList, o) {
        return (o instanceof Object) && all(function (field) {
            return (field in o);
        }, fieldList);
    }

    function cons(x, xs) {
        return [x, xs];
    }

    var emptyList = null, head = attr(0), tail = attr(1);

    function arrayAsList(inputArray) {
        return reverseList(inputArray.reduce(flip(cons), emptyList));
    }

    var list = varArgs(arrayAsList);

    function listAsArray(list) {
        return foldR(function (arraySoFar, listItem) {
            arraySoFar.unshift(listItem);
            return arraySoFar;
        }, [], list);
    }

    function map(fn, list) {
        return list ? cons(fn(head(list)), map(fn, tail(list))) : emptyList;
    }

    function foldR(fn, startValue, list) {
        return list ? fn(foldR(fn, startValue, tail(list)), head(list)) : startValue;
    }

    function foldR1(fn, list) {
        return tail(list) ? fn(foldR1(fn, tail(list)), head(list)) : head(list);
    }

    function without(list, test, removedFn) {
        return withoutInner(list, removedFn || noop);

        function withoutInner(subList, removedFn) {
            return subList ? (test(head(subList)) ? (removedFn(head(subList)), tail(subList)) : cons(head(subList), withoutInner(tail(subList), removedFn))) : emptyList;
        }
    }

    function all(fn, list) {
        return !list || (fn(head(list)) && all(fn, tail(list)));
    }

    function applyEach(fnList, args) {
        if (fnList) {
            head(fnList).apply(null, args);
            applyEach(tail(fnList), args);
        }
    }

    function reverseList(list) {
        function reverseInner(list, reversedAlready) {
            if (!list) {
                return reversedAlready;
            }
            return reverseInner(tail(list), cons(head(list), reversedAlready))
        }

        return reverseInner(list, emptyList);
    }

    function first(test, list) {
        return list && (test(head(list)) ? head(list) : first(test, tail(list)));
    }

    function clarinet(eventBus) {
        "use strict";
        var
            emitSaxKey = eventBus(SAX_KEY).emit, emitValueOpen = eventBus(SAX_VALUE_OPEN).emit,
            emitValueClose = eventBus(SAX_VALUE_CLOSE).emit, emitFail = eventBus(FAIL_EVENT).emit,
            MAX_BUFFER_LENGTH = 64 * 1024, stringTokenPattern = /[\\"\n]/g, _n = 0, BEGIN = _n++, VALUE = _n++,
            OPEN_OBJECT = _n++, CLOSE_OBJECT = _n++, OPEN_ARRAY = _n++, CLOSE_ARRAY = _n++, STRING = _n++,
            OPEN_KEY = _n++, CLOSE_KEY = _n++, TRUE = _n++, TRUE2 = _n++, TRUE3 = _n++, FALSE = _n++, FALSE2 = _n++,
            FALSE3 = _n++, FALSE4 = _n++, NULL = _n++, NULL2 = _n++, NULL3 = _n++, NUMBER_DECIMAL_POINT = _n++,
            NUMBER_DIGIT = _n, bufferCheckPosition = MAX_BUFFER_LENGTH, latestError, c, p, textNode = undefined,
            numberNode = "", slashed = false, closed = false, state = BEGIN, stack = [], unicodeS = null,
            unicodeI = 0, depth = 0, position = 0, column = 0, line = 1;

        function checkBufferLength() {
            var maxActual = 0;
            if (textNode !== undefined && textNode.length > MAX_BUFFER_LENGTH) {
                emitError("Max buffer length exceeded: textNode");
                maxActual = Math.max(maxActual, textNode.length);
            }
            if (numberNode.length > MAX_BUFFER_LENGTH) {
                emitError("Max buffer length exceeded: numberNode");
                maxActual = Math.max(maxActual, numberNode.length);
            }
            bufferCheckPosition = (MAX_BUFFER_LENGTH - maxActual)
                + position;
        }

        eventBus(STREAM_DATA).on(handleData);
        eventBus(STREAM_END).on(handleStreamEnd);

        function emitError(errorString) {
            if (textNode !== undefined) {
                emitValueOpen(textNode);
                emitValueClose();
                textNode = undefined;
            }
            latestError = Error(errorString + "\nLn: " + line + "\nCol: " + column + "\nChr: " + c);
            emitFail(errorReport(undefined, undefined, latestError));
        }

        function handleStreamEnd() {
            if (state == BEGIN) {
                emitValueOpen({});
                emitValueClose();
                closed = true;
                return;
            }
            if (state !== VALUE || depth !== 0)
                emitError("Unexpected end");
            if (textNode !== undefined) {
                emitValueOpen(textNode);
                emitValueClose();
                textNode = undefined;
            }
            closed = true;
        }

        function whitespace(c) {
            return c == '\r' || c == '\n' || c == ' ' || c == '\t';
        }

        function handleData(chunk) {
            if (latestError)
                return;
            if (closed) {
                return emitError("Cannot write after close");
            }
            var i = 0;
            c = chunk[0];
            while (c) {
                p = c;
                c = chunk[i++];
                if (!c) break;
                position++;
                if (c == "\n") {
                    line++;
                    column = 0;
                } else column++;
                switch (state) {
                    case BEGIN:
                        if (c === "{") state = OPEN_OBJECT; else if (c === "[") state = OPEN_ARRAY; else if (!whitespace(c))
                            return emitError("Non-whitespace before {[.");
                        continue;
                    case OPEN_KEY:
                    case OPEN_OBJECT:
                        if (whitespace(c)) continue;
                        if (state === OPEN_KEY) stack.push(CLOSE_KEY); else {
                            if (c === '}') {
                                emitValueOpen({});
                                emitValueClose();
                                state = stack.pop() || VALUE;
                                continue;
                            } else stack.push(CLOSE_OBJECT);
                        }
                        if (c === '"')
                            state = STRING; else
                            return emitError("Malformed object key should start with \" ");
                        continue;
                    case CLOSE_KEY:
                    case CLOSE_OBJECT:
                        if (whitespace(c)) continue;
                        if (c === ':') {
                            if (state === CLOSE_OBJECT) {
                                stack.push(CLOSE_OBJECT);
                                if (textNode !== undefined) {
                                    emitValueOpen({});
                                    emitSaxKey(textNode);
                                    textNode = undefined;
                                }
                                depth++;
                            } else {
                                if (textNode !== undefined) {
                                    emitSaxKey(textNode);
                                    textNode = undefined;
                                }
                            }
                            state = VALUE;
                        } else if (c === '}') {
                            if (textNode !== undefined) {
                                emitValueOpen(textNode);
                                emitValueClose();
                                textNode = undefined;
                            }
                            emitValueClose();
                            depth--;
                            state = stack.pop() || VALUE;
                        } else if (c === ',') {
                            if (state === CLOSE_OBJECT)
                                stack.push(CLOSE_OBJECT);
                            if (textNode !== undefined) {
                                emitValueOpen(textNode);
                                emitValueClose();
                                textNode = undefined;
                            }
                            state = OPEN_KEY;
                        } else
                            return emitError('Bad object');
                        continue;
                    case OPEN_ARRAY:
                    case VALUE:
                        if (whitespace(c)) continue;
                        if (state === OPEN_ARRAY) {
                            emitValueOpen([]);
                            depth++;
                            state = VALUE;
                            if (c === ']') {
                                emitValueClose();
                                depth--;
                                state = stack.pop() || VALUE;
                                continue;
                            } else {
                                stack.push(CLOSE_ARRAY);
                            }
                        }
                        if (c === '"') state = STRING; else if (c === '{') state = OPEN_OBJECT; else if (c === '[') state = OPEN_ARRAY; else if (c === 't') state = TRUE; else if (c === 'f') state = FALSE; else if (c === 'n') state = NULL; else if (c === '-') {
                            numberNode += c;
                        } else if (c === '0') {
                            numberNode += c;
                            state = NUMBER_DIGIT;
                        } else if ('123456789'.indexOf(c) !== -1) {
                            numberNode += c;
                            state = NUMBER_DIGIT;
                        } else
                            return emitError("Bad value");
                        continue;
                    case CLOSE_ARRAY:
                        if (c === ',') {
                            stack.push(CLOSE_ARRAY);
                            if (textNode !== undefined) {
                                emitValueOpen(textNode);
                                emitValueClose();
                                textNode = undefined;
                            }
                            state = VALUE;
                        } else if (c === ']') {
                            if (textNode !== undefined) {
                                emitValueOpen(textNode);
                                emitValueClose();
                                textNode = undefined;
                            }
                            emitValueClose();
                            depth--;
                            state = stack.pop() || VALUE;
                        } else if (whitespace(c))
                            continue; else
                            return emitError('Bad array');
                        continue;
                    case STRING:
                        if (textNode === undefined) {
                            textNode = "";
                        }
                        var starti = i - 1;
                        STRING_BIGLOOP:while (true) {
                            while (unicodeI > 0) {
                                unicodeS += c;
                                c = chunk.charAt(i++);
                                if (unicodeI === 4) {
                                    textNode += String.fromCharCode(parseInt(unicodeS, 16));
                                    unicodeI = 0;
                                    starti = i - 1;
                                } else {
                                    unicodeI++;
                                }
                                if (!c) break STRING_BIGLOOP;
                            }
                            if (c === '"' && !slashed) {
                                state = stack.pop() || VALUE;
                                textNode += chunk.substring(starti, i - 1);
                                break;
                            }
                            if (c === '\\' && !slashed) {
                                slashed = true;
                                textNode += chunk.substring(starti, i - 1);
                                c = chunk.charAt(i++);
                                if (!c) break;
                            }
                            if (slashed) {
                                slashed = false;
                                if (c === 'n') {
                                    textNode += '\n';
                                } else if (c === 'r') {
                                    textNode += '\r';
                                } else if (c === 't') {
                                    textNode += '\t';
                                } else if (c === 'f') {
                                    textNode += '\f';
                                } else if (c === 'b') {
                                    textNode += '\b';
                                } else if (c === 'u') {
                                    unicodeI = 1;
                                    unicodeS = '';
                                } else {
                                    textNode += c;
                                }
                                c = chunk.charAt(i++);
                                starti = i - 1;
                                if (!c) break; else continue;
                            }
                            stringTokenPattern.lastIndex = i;
                            var reResult = stringTokenPattern.exec(chunk);
                            if (!reResult) {
                                i = chunk.length + 1;
                                textNode += chunk.substring(starti, i - 1);
                                break;
                            }
                            i = reResult.index + 1;
                            c = chunk.charAt(reResult.index);
                            if (!c) {
                                textNode += chunk.substring(starti, i - 1);
                                break;
                            }
                        }
                        continue;
                    case TRUE:
                        if (!c) continue;
                        if (c === 'r') state = TRUE2; else
                            return emitError('Invalid true started with t' + c);
                        continue;
                    case TRUE2:
                        if (!c) continue;
                        if (c === 'u') state = TRUE3; else
                            return emitError('Invalid true started with tr' + c);
                        continue;
                    case TRUE3:
                        if (!c) continue;
                        if (c === 'e') {
                            emitValueOpen(true);
                            emitValueClose();
                            state = stack.pop() || VALUE;
                        } else
                            return emitError('Invalid true started with tru' + c);
                        continue;
                    case FALSE:
                        if (!c) continue;
                        if (c === 'a') state = FALSE2; else
                            return emitError('Invalid false started with f' + c);
                        continue;
                    case FALSE2:
                        if (!c) continue;
                        if (c === 'l') state = FALSE3; else
                            return emitError('Invalid false started with fa' + c);
                        continue;
                    case FALSE3:
                        if (!c) continue;
                        if (c === 's') state = FALSE4; else
                            return emitError('Invalid false started with fal' + c);
                        continue;
                    case FALSE4:
                        if (!c) continue;
                        if (c === 'e') {
                            emitValueOpen(false);
                            emitValueClose();
                            state = stack.pop() || VALUE;
                        } else
                            return emitError('Invalid false started with fals' + c);
                        continue;
                    case NULL:
                        if (!c) continue;
                        if (c === 'u') state = NULL2; else
                            return emitError('Invalid null started with n' + c);
                        continue;
                    case NULL2:
                        if (!c) continue;
                        if (c === 'l') state = NULL3; else
                            return emitError('Invalid null started with nu' + c);
                        continue;
                    case NULL3:
                        if (!c) continue;
                        if (c === 'l') {
                            emitValueOpen(null);
                            emitValueClose();
                            state = stack.pop() || VALUE;
                        } else
                            return emitError('Invalid null started with nul' + c);
                        continue;
                    case NUMBER_DECIMAL_POINT:
                        if (c === '.') {
                            numberNode += c;
                            state = NUMBER_DIGIT;
                        } else
                            return emitError('Leading zero not followed by .');
                        continue;
                    case NUMBER_DIGIT:
                        if ('0123456789'.indexOf(c) !== -1) numberNode += c; else if (c === '.') {
                            if (numberNode.indexOf('.') !== -1)
                                return emitError('Invalid number has two dots');
                            numberNode += c;
                        } else if (c === 'e' || c === 'E') {
                            if (numberNode.indexOf('e') !== -1 || numberNode.indexOf('E') !== -1)
                                return emitError('Invalid number has two exponential');
                            numberNode += c;
                        } else if (c === "+" || c === "-") {
                            if (!(p === 'e' || p === 'E'))
                                return emitError('Invalid symbol in number');
                            numberNode += c;
                        } else {
                            if (numberNode) {
                                emitValueOpen(parseFloat(numberNode));
                                emitValueClose();
                                numberNode = "";
                            }
                            i--;
                            state = stack.pop() || VALUE;
                        }
                        continue;
                    default:
                        return emitError("Unknown state: " + state);
                }
            }
            if (position >= bufferCheckPosition)
                checkBufferLength();
        }
    }

    function ascentManager(oboeBus, handlers) {
        "use strict";
        var listenerId = {}, ascent;

        function stateAfter(handler) {
            return function (param) {
                ascent = handler(ascent, param);
            }
        }

        for (var eventName in handlers) {
            oboeBus(eventName).on(stateAfter(handlers[eventName]), listenerId);
        }
        oboeBus(NODE_SWAP).on(function (newNode) {
            var oldHead = head(ascent), key = keyOf(oldHead), ancestors = tail(ascent), parentNode;
            if (ancestors) {
                parentNode = nodeOf(head(ancestors));
                parentNode[key] = newNode;
            }
        });
        oboeBus(NODE_DROP).on(function () {
            var oldHead = head(ascent), key = keyOf(oldHead), ancestors = tail(ascent), parentNode;
            if (ancestors) {
                parentNode = nodeOf(head(ancestors));
                delete parentNode[key];
            }
        });
        oboeBus(ABORTING).on(function () {
            for (var eventName in handlers) {
                oboeBus(eventName).un(listenerId);
            }
        });
    }

    function parseResponseHeaders(headerStr) {
        var headers = {};
        headerStr && headerStr.split('\u000d\u000a').forEach(function (headerPair) {
            var index = headerPair.indexOf('\u003a\u0020');
            headers[headerPair.substring(0, index)] = headerPair.substring(index + 2);
        });
        return headers;
    }

    function isCrossOrigin(pageLocation, ajaxHost) {
        function defaultPort(protocol) {
            return {'http:': 80, 'https:': 443}[protocol];
        }

        function portOf(location) {
            return location.port || defaultPort(location.protocol || pageLocation.protocol);
        }

        return !!((ajaxHost.protocol && (ajaxHost.protocol != pageLocation.protocol)) || (ajaxHost.host && (ajaxHost.host != pageLocation.host)) || (ajaxHost.host && (portOf(ajaxHost) != portOf(pageLocation))));
    }

    function parseUrlOrigin(url) {
        var URL_HOST_PATTERN = /(\w+:)?(?:\/\/)([\w.-]+)?(?::(\d+))?\/?/,
            urlHostMatch = URL_HOST_PATTERN.exec(url) || [];
        return {protocol: urlHostMatch[1] || '', host: urlHostMatch[2] || '', port: urlHostMatch[3] || ''};
    }

    function httpTransport() {
        return new XMLHttpRequest();
    }

    function streamingHttp(oboeBus, xhr, method, url, data, headers, withCredentials) {
        "use strict";
        var emitStreamData = oboeBus(STREAM_DATA).emit, emitFail = oboeBus(FAIL_EVENT).emit,
            numberOfCharsAlreadyGivenToCallback = 0, stillToSendStartEvent = true;
        oboeBus(ABORTING).on(function () {
            xhr.onreadystatechange = null;
            xhr.abort();
        });

        function handleProgress() {
            var textSoFar = xhr.responseText, newText = textSoFar.substr(numberOfCharsAlreadyGivenToCallback);
            if (newText) {
                emitStreamData(newText);
            }
            numberOfCharsAlreadyGivenToCallback = len(textSoFar);
        }

        if ('onprogress' in xhr) {
            xhr.onprogress = handleProgress;
        }
        xhr.onreadystatechange = function () {
            function sendStartIfNotAlready() {
                try {
                    stillToSendStartEvent && oboeBus(HTTP_START).emit(xhr.status, parseResponseHeaders(xhr.getAllResponseHeaders()));
                    stillToSendStartEvent = false;
                } catch (e) {
                }
            }

            switch (xhr.readyState) {
                case 2:
                case 3:
                    return sendStartIfNotAlready();
                case 4:
                    sendStartIfNotAlready();
                    var successful = String(xhr.status)[0] == 2;
                    if (successful) {
                        handleProgress();
                        oboeBus(STREAM_END).emit();
                    } else {
                        emitFail(errorReport(xhr.status, xhr.responseText));
                    }
            }
        };
        try {
            xhr.open(method, url, true);
            for (var headerName in headers) {
                xhr.setRequestHeader(headerName, headers[headerName]);
            }
            if (!isCrossOrigin(window.location, parseUrlOrigin(url))) {
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            }
            xhr.withCredentials = withCredentials;
            xhr.send(data);
        } catch (e) {
            window.setTimeout(partialComplete(emitFail, errorReport(undefined, undefined, e)), 0);
        }
    }

    var jsonPathSyntax = (function () {
        var
            regexDescriptor = function regexDescriptor(regex) {
                return regex.exec.bind(regex);
            }, jsonPathClause = varArgs(function (componentRegexes) {
                componentRegexes.unshift(/^/);
                return regexDescriptor(RegExp(componentRegexes.map(attr('source')).join('')));
            }), possiblyCapturing = /(\$?)/, namedNode = /([\w-_]+|\*)/, namePlaceholder = /()/,
            nodeInArrayNotation = /\["([^"]+)"\]/, numberedNodeInArrayNotation = /\[(\d+|\*)\]/,
            fieldList = /{([\w ]*?)}/, optionalFieldList = /(?:{([\w ]*?)})?/
            , jsonPathNamedNodeInObjectNotation = jsonPathClause(possiblyCapturing, namedNode, optionalFieldList),
            jsonPathNamedNodeInArrayNotation = jsonPathClause(possiblyCapturing, nodeInArrayNotation, optionalFieldList),
            jsonPathNumberedNodeInArrayNotation = jsonPathClause(possiblyCapturing, numberedNodeInArrayNotation, optionalFieldList),
            jsonPathPureDuckTyping = jsonPathClause(possiblyCapturing, namePlaceholder, fieldList),
            jsonPathDoubleDot = jsonPathClause(/\.\./), jsonPathDot = jsonPathClause(/\./),
            jsonPathBang = jsonPathClause(possiblyCapturing, /!/), emptyString = jsonPathClause(/$/);
        return function (fn) {
            return fn(lazyUnion(jsonPathNamedNodeInObjectNotation, jsonPathNamedNodeInArrayNotation, jsonPathNumberedNodeInArrayNotation, jsonPathPureDuckTyping), jsonPathDoubleDot, jsonPathDot, jsonPathBang, emptyString);
        };
    }());

    function namedNode(key, node) {
        return {key: key, node: node};
    }

    var keyOf = attr('key');
    var nodeOf = attr('node');
    var ROOT_PATH = {};

    function incrementalContentBuilder(oboeBus) {
        var emitNodeOpened = oboeBus(NODE_OPENED).emit, emitNodeClosed = oboeBus(NODE_CLOSED).emit,
            emitRootOpened = oboeBus(ROOT_PATH_FOUND).emit, emitRootClosed = oboeBus(ROOT_NODE_FOUND).emit;

        function arrayIndicesAreKeys(possiblyInconsistentAscent, newDeepestNode) {
            var parentNode = nodeOf(head(possiblyInconsistentAscent));
            return isOfType(Array, parentNode) ? keyFound(possiblyInconsistentAscent, len(parentNode), newDeepestNode) : possiblyInconsistentAscent;
        }

        function nodeOpened(ascent, newDeepestNode) {
            if (!ascent) {
                emitRootOpened(newDeepestNode);
                return keyFound(ascent, ROOT_PATH, newDeepestNode);
            }
            var arrayConsistentAscent = arrayIndicesAreKeys(ascent, newDeepestNode),
                ancestorBranches = tail(arrayConsistentAscent),
                previouslyUnmappedName = keyOf(head(arrayConsistentAscent));
            appendBuiltContent(ancestorBranches, previouslyUnmappedName, newDeepestNode);
            return cons(namedNode(previouslyUnmappedName, newDeepestNode), ancestorBranches);
        }

        function appendBuiltContent(ancestorBranches, key, node) {
            nodeOf(head(ancestorBranches))[key] = node;
        }

        function keyFound(ascent, newDeepestName, maybeNewDeepestNode) {
            if (ascent) {
                appendBuiltContent(ascent, newDeepestName, maybeNewDeepestNode);
            }
            var ascentWithNewPath = cons(namedNode(newDeepestName, maybeNewDeepestNode), ascent);
            emitNodeOpened(ascentWithNewPath);
            return ascentWithNewPath;
        }

        function nodeClosed(ascent) {
            emitNodeClosed(ascent);
            return tail(ascent) || emitRootClosed(nodeOf(head(ascent)));
        }

        var contentBuilderHandlers = {};
        contentBuilderHandlers[SAX_VALUE_OPEN] = nodeOpened;
        contentBuilderHandlers[SAX_VALUE_CLOSE] = nodeClosed;
        contentBuilderHandlers[SAX_KEY] = keyFound;
        return contentBuilderHandlers;
    }

    var jsonPathCompiler = jsonPathSyntax(function (pathNodeSyntax, doubleDotSyntax, dotSyntax, bangSyntax, emptySyntax) {
        var CAPTURING_INDEX = 1;
        var NAME_INDEX = 2;
        var FIELD_LIST_INDEX = 3;
        var headKey = compose2(keyOf, head), headNode = compose2(nodeOf, head);

        function nameClause(previousExpr, detection) {
            var name = detection[NAME_INDEX], matchesName = (!name || name == '*') ? always : function (ascent) {
                return headKey(ascent) == name
            };
            return lazyIntersection(matchesName, previousExpr);
        }

        function duckTypeClause(previousExpr, detection) {
            var fieldListStr = detection[FIELD_LIST_INDEX];
            if (!fieldListStr)
                return previousExpr;
            var hasAllrequiredFields = partialComplete(hasAllProperties, arrayAsList(fieldListStr.split(/\W+/))),
                isMatch = compose2(hasAllrequiredFields, headNode);
            return lazyIntersection(isMatch, previousExpr);
        }

        function capture(previousExpr, detection) {
            var capturing = !!detection[CAPTURING_INDEX];
            if (!capturing)
                return previousExpr;
            return lazyIntersection(previousExpr, head);
        }

        function skip1(previousExpr) {
            if (previousExpr == always) {
                return always;
            }

            function notAtRoot(ascent) {
                return headKey(ascent) != ROOT_PATH;
            }

            return lazyIntersection(notAtRoot, compose2(previousExpr, tail));
        }

        function skipMany(previousExpr) {
            if (previousExpr == always) {
                return always;
            }
            var
                terminalCaseWhenArrivingAtRoot = rootExpr(),
                terminalCaseWhenPreviousExpressionIsSatisfied = previousExpr,
                recursiveCase = skip1(function (ascent) {
                    return cases(ascent);
                }),
                cases = lazyUnion(terminalCaseWhenArrivingAtRoot, terminalCaseWhenPreviousExpressionIsSatisfied, recursiveCase);
            return cases;
        }

        function rootExpr() {
            return function (ascent) {
                return headKey(ascent) == ROOT_PATH;
            };
        }

        function statementExpr(lastClause) {
            return function (ascent) {
                var exprMatch = lastClause(ascent);
                return exprMatch === true ? head(ascent) : exprMatch;
            };
        }

        function expressionsReader(exprs, parserGeneratedSoFar, detection) {
            return foldR(function (parserGeneratedSoFar, expr) {
                return expr(parserGeneratedSoFar, detection);
            }, parserGeneratedSoFar, exprs);
        }

        function generateClauseReaderIfTokenFound(tokenDetector, clauseEvaluatorGenerators, jsonPath, parserGeneratedSoFar, onSuccess) {
            var detected = tokenDetector(jsonPath);
            if (detected) {
                var compiledParser = expressionsReader(clauseEvaluatorGenerators, parserGeneratedSoFar, detected),
                    remainingUnparsedJsonPath = jsonPath.substr(len(detected[0]));
                return onSuccess(remainingUnparsedJsonPath, compiledParser);
            }
        }

        function clauseMatcher(tokenDetector, exprs) {
            return partialComplete(generateClauseReaderIfTokenFound, tokenDetector, exprs);
        }

        var clauseForJsonPath = lazyUnion(clauseMatcher(pathNodeSyntax, list(capture, duckTypeClause, nameClause, skip1)), clauseMatcher(doubleDotSyntax, list(skipMany)), clauseMatcher(dotSyntax, list()), clauseMatcher(bangSyntax, list(capture, rootExpr)), clauseMatcher(emptySyntax, list(statementExpr)), function (jsonPath) {
            throw Error('"' + jsonPath + '" could not be tokenised')
        });

        function returnFoundParser(_remainingJsonPath, compiledParser) {
            return compiledParser
        }

        function compileJsonPathToFunction(uncompiledJsonPath, parserGeneratedSoFar) {
            var onFind = uncompiledJsonPath ? compileJsonPathToFunction : returnFoundParser;
            return clauseForJsonPath(uncompiledJsonPath, parserGeneratedSoFar, onFind);
        }

        return function (jsonPath) {
            try {
                return compileJsonPathToFunction(jsonPath, always);
            } catch (e) {
                throw Error('Could not compile "' + jsonPath + '" because ' + e.message);
            }
        }
    });

    function singleEventPubSub(eventType, newListener, removeListener) {
        var listenerTupleList, listenerList;

        function hasId(id) {
            return function (tuple) {
                return tuple.id == id;
            };
        }

        return {
            on: function (listener, listenerId) {
                var tuple = {listener: listener, id: listenerId || listener};
                if (newListener) {
                    newListener.emit(eventType, listener, tuple.id);
                }
                listenerTupleList = cons(tuple, listenerTupleList);
                listenerList = cons(listener, listenerList);
                return this;
            }, emit: function () {
                applyEach(listenerList, arguments);
            }, un: function (listenerId) {
                var removed;
                listenerTupleList = without(listenerTupleList, hasId(listenerId), function (tuple) {
                    removed = tuple;
                });
                if (removed) {
                    listenerList = without(listenerList, function (listener) {
                        return listener == removed.listener;
                    });
                    if (removeListener) {
                        removeListener.emit(eventType, removed.listener, removed.id);
                    }
                }
            }, listeners: function () {
                return listenerList;
            }, hasListener: function (listenerId) {
                var test = listenerId ? hasId(listenerId) : always;
                return defined(first(test, listenerTupleList));
            }
        };
    }

    function pubSub() {
        var singles = {}, newListener = newSingle('newListener'), removeListener = newSingle('removeListener');

        function newSingle(eventName) {
            return singles[eventName] = singleEventPubSub(eventName, newListener, removeListener);
        }

        function pubSubInstance(eventName) {
            return singles[eventName] || newSingle(eventName);
        }

        ['emit', 'on', 'un'].forEach(function (methodName) {
            pubSubInstance[methodName] = varArgs(function (eventName, parameters) {
                apply(parameters, pubSubInstance(eventName)[methodName]);
            });
        });
        return pubSubInstance;
    }

    var
        _S = 1, NODE_OPENED = _S++, NODE_CLOSED = _S++, NODE_SWAP = _S++, NODE_DROP = _S++, FAIL_EVENT = 'fail',
        ROOT_NODE_FOUND = _S++, ROOT_PATH_FOUND = _S++, HTTP_START = 'start', STREAM_DATA = 'data',
        STREAM_END = 'end', ABORTING = _S++, SAX_KEY = _S++, SAX_VALUE_OPEN = _S++, SAX_VALUE_CLOSE = _S++;

    function errorReport(statusCode, body, error) {
        try {
            var jsonBody = JSON.parse(body);
        } catch (e) {
        }
        return {statusCode: statusCode, body: body, jsonBody: jsonBody, thrown: error};
    }

    function patternAdapter(oboeBus, jsonPathCompiler) {
        var predicateEventMap = {node: oboeBus(NODE_CLOSED), path: oboeBus(NODE_OPENED)};

        function emitMatchingNode(emitMatch, node, ascent) {
            var descent = reverseList(ascent);
            emitMatch(node, listAsArray(tail(map(keyOf, descent))), listAsArray(map(nodeOf, descent)));
        }

        function addUnderlyingListener(fullEventName, predicateEvent, compiledJsonPath) {
            var emitMatch = oboeBus(fullEventName).emit;
            predicateEvent.on(function (ascent) {
                var maybeMatchingMapping = compiledJsonPath(ascent);
                if (maybeMatchingMapping !== false) {
                    emitMatchingNode(emitMatch, nodeOf(maybeMatchingMapping), ascent);
                }
            }, fullEventName);
            oboeBus('removeListener').on(function (removedEventName) {
                if (removedEventName == fullEventName) {
                    if (!oboeBus(removedEventName).listeners()) {
                        predicateEvent.un(fullEventName);
                    }
                }
            });
        }

        oboeBus('newListener').on(function (fullEventName) {
            var match = /(node|path):(.*)/.exec(fullEventName);
            if (match) {
                var predicateEvent = predicateEventMap[match[1]];
                if (!predicateEvent.hasListener(fullEventName)) {
                    addUnderlyingListener(fullEventName, predicateEvent, jsonPathCompiler(match[2]));
                }
            }
        })
    }

    function instanceApi(oboeBus, contentSource) {
        var oboeApi, fullyQualifiedNamePattern = /^(node|path):./, rootNodeFinishedEvent = oboeBus(ROOT_NODE_FOUND),
            emitNodeDrop = oboeBus(NODE_DROP).emit, emitNodeSwap = oboeBus(NODE_SWAP).emit,
            addListener = varArgs(function (eventId, parameters) {
                if (oboeApi[eventId]) {
                    apply(parameters, oboeApi[eventId]);
                } else {
                    var event = oboeBus(eventId), listener = parameters[0];
                    if (fullyQualifiedNamePattern.test(eventId)) {
                        addForgettableCallback(event, listener);
                    } else {
                        event.on(listener);
                    }
                }
                return oboeApi;
            }), removeListener = function (eventId, p2, p3) {
                if (eventId == 'done') {
                    rootNodeFinishedEvent.un(p2);
                } else if (eventId == 'node' || eventId == 'path') {
                    oboeBus.un(eventId + ':' + p2, p3);
                } else {
                    var listener = p2;
                    oboeBus(eventId).un(listener);
                }
                return oboeApi;
            };

        function addProtectedCallback(eventName, callback) {
            oboeBus(eventName).on(protectedCallback(callback), callback);
            return oboeApi;
        }

        function addForgettableCallback(event, callback, listenerId) {
            listenerId = listenerId || callback;
            var safeCallback = protectedCallback(callback);
            event.on(function () {
                var discard = false;
                oboeApi.forget = function () {
                    discard = true;
                };
                apply(arguments, safeCallback);
                delete oboeApi.forget;
                if (discard) {
                    event.un(listenerId);
                }
            }, listenerId);
            return oboeApi;
        }

        function protectedCallback(callback) {
            return function () {
                try {
                    return callback.apply(oboeApi, arguments);
                } catch (e) {
                    setTimeout(function () {
                        throw new Error(e.message);
                    });
                }
            }
        }

        function fullyQualifiedPatternMatchEvent(type, pattern) {
            return oboeBus(type + ':' + pattern);
        }

        function wrapCallbackToSwapNodeIfSomethingReturned(callback) {
            return function () {
                var returnValueFromCallback = callback.apply(this, arguments);
                if (defined(returnValueFromCallback)) {
                    if (returnValueFromCallback == oboe.drop) {
                        emitNodeDrop();
                    } else {
                        emitNodeSwap(returnValueFromCallback);
                    }
                }
            }
        }

        function addSingleNodeOrPathListener(eventId, pattern, callback) {
            var effectiveCallback;
            if (eventId == 'node') {
                effectiveCallback = wrapCallbackToSwapNodeIfSomethingReturned(callback);
            } else {
                effectiveCallback = callback;
            }
            addForgettableCallback(fullyQualifiedPatternMatchEvent(eventId, pattern), effectiveCallback, callback);
        }

        function addMultipleNodeOrPathListeners(eventId, listenerMap) {
            for (var pattern in listenerMap) {
                addSingleNodeOrPathListener(eventId, pattern, listenerMap[pattern]);
            }
        }

        function addNodeOrPathListenerApi(eventId, jsonPathOrListenerMap, callback) {
            if (isString(jsonPathOrListenerMap)) {
                addSingleNodeOrPathListener(eventId, jsonPathOrListenerMap, callback);
            } else {
                addMultipleNodeOrPathListeners(eventId, jsonPathOrListenerMap);
            }
            return oboeApi;
        }

        oboeBus(ROOT_PATH_FOUND).on(function (rootNode) {
            oboeApi.root = functor(rootNode);
        });
        oboeBus(HTTP_START).on(function (_statusCode, headers) {
            oboeApi.header = function (name) {
                return name ? headers[name] : headers;
            }
        });
        return oboeApi = {
            on: addListener,
            addListener: addListener,
            removeListener: removeListener,
            emit: oboeBus.emit,
            node: partialComplete(addNodeOrPathListenerApi, 'node'),
            path: partialComplete(addNodeOrPathListenerApi, 'path'),
            done: partialComplete(addForgettableCallback, rootNodeFinishedEvent),
            start: partialComplete(addProtectedCallback, HTTP_START),
            fail: oboeBus(FAIL_EVENT).on,
            abort: oboeBus(ABORTING).emit,
            write: oboeBus(STREAM_DATA).emit,
            finish: oboeBus(STREAM_END).emit,
            header: noop,
            root: noop,
            source: contentSource
        };
    }

    function wire(httpMethodName, contentSource, body, headers, withCredentials) {
        var oboeBus = pubSub();
        if (contentSource) {
            streamingHttp(oboeBus, httpTransport(), httpMethodName, contentSource, body, headers, withCredentials);
        }
        clarinet(oboeBus);
        ascentManager(oboeBus, incrementalContentBuilder(oboeBus));
        patternAdapter(oboeBus, jsonPathCompiler);
        return instanceApi(oboeBus, contentSource);
    }

    function applyDefaults(passthrough, url, httpMethodName, body, headers, withCredentials, cached) {
        headers = headers ? JSON.parse(JSON.stringify(headers)) : {};
        if (body) {
            if (!isString(body)) {
                body = JSON.stringify(body);
                headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            }
        } else {
            body = null;
        }

        function modifiedUrl(baseUrl, cached) {
            if (cached === false) {
                if (baseUrl.indexOf('?') == -1) {
                    baseUrl += '?';
                } else {
                    baseUrl += '&';
                }
                baseUrl += '_=' + new Date().getTime();
            }
            return baseUrl;
        }

        return passthrough(httpMethodName || 'GET', modifiedUrl(url, cached), body, headers, withCredentials || false);
    }

    function oboe(arg1) {
        var nodeStreamMethodNames = list('resume', 'pause', 'pipe'),
            isStream = partialComplete(hasAllProperties, nodeStreamMethodNames);
        if (arg1) {
            if (isStream(arg1) || isString(arg1)) {
                return applyDefaults(wire, arg1);
            } else {
                return applyDefaults(wire, arg1.url, arg1.method, arg1.body, arg1.headers, arg1.withCredentials, arg1.cached);
            }
        } else {
            return wire();
        }
    }

    oboe.drop = function () {
        return oboe.drop;
    };
    if (typeof define === "function" && define.amd) {
        define("oboe", [], function () {
            return oboe;
        });
    } else if (typeof exports === 'object') {
        module.exports = oboe;
    } else {
        window.oboe = oboe;
    }
})((function () {
    try {
        return global;
    } catch (e) {
        return self;
    }
}()), Object, Array, Error, JSON);