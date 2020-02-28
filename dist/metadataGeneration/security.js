"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts = require("typescript");
var initializer_value_1 = require("./initializer-value");
function getSecurities(decorators) {
    var e_1, _a, e_2, _b;
    var securities = [];
    try {
        for (var decorators_1 = __values(decorators), decorators_1_1 = decorators_1.next(); !decorators_1_1.done; decorators_1_1 = decorators_1.next()) {
            var sec = decorators_1_1.value;
            var expression = sec.parent;
            var security = {};
            if (expression.arguments[0].kind === ts.SyntaxKind.StringLiteral) {
                var name_1 = expression.arguments[0].text;
                security[name_1] = expression.arguments[1] ? expression.arguments[1].elements.map(function (e) { return e.text; }) : [];
            }
            else {
                var properties = expression.arguments[0].properties;
                try {
                    for (var properties_1 = (e_2 = void 0, __values(properties)), properties_1_1 = properties_1.next(); !properties_1_1.done; properties_1_1 = properties_1.next()) {
                        var property = properties_1_1.value;
                        var name_2 = property.name.text;
                        var scopes = initializer_value_1.getInitializerValue(property.initializer);
                        security[name_2] = scopes;
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (properties_1_1 && !properties_1_1.done && (_b = properties_1.return)) _b.call(properties_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            securities.push(security);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (decorators_1_1 && !decorators_1_1.done && (_a = decorators_1.return)) _a.call(decorators_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return securities;
}
exports.getSecurities = getSecurities;
//# sourceMappingURL=security.js.map