"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var decoratorUtils_1 = require("./../utils/decoratorUtils");
var jsDocUtils_1 = require("./../utils/jsDocUtils");
var exceptions_1 = require("./exceptions");
var initializer_value_1 = require("./initializer-value");
var parameterGenerator_1 = require("./parameterGenerator");
var security_1 = require("./security");
var typeResolver_1 = require("./typeResolver");
var MethodGenerator = /** @class */ (function () {
    function MethodGenerator(node, current, parentTags, parentSecurity, isParentHidden) {
        this.node = node;
        this.current = current;
        this.parentTags = parentTags;
        this.parentSecurity = parentSecurity;
        this.isParentHidden = isParentHidden;
        this.processMethodDecorators();
    }
    MethodGenerator.prototype.IsValid = function () {
        return !!this.method;
    };
    MethodGenerator.prototype.Generate = function () {
        if (!this.IsValid()) {
            throw new exceptions_1.GenerateMetadataError("This isn't a valid a controller method.");
        }
        var nodeType = this.node.type;
        if (!nodeType) {
            var typeChecker = this.current.typeChecker;
            var signature = typeChecker.getSignatureFromDeclaration(this.node);
            var implicitType = typeChecker.getReturnTypeOfSignature(signature);
            nodeType = typeChecker.typeToTypeNode(implicitType);
        }
        var type = new typeResolver_1.TypeResolver(nodeType, this.current).resolve();
        var responses = this.getMethodResponses();
        responses.push(this.getMethodSuccessResponse(type));
        return {
            deprecated: this.getIsDeprecated(),
            description: jsDocUtils_1.getJSDocDescription(this.node),
            isHidden: this.getIsHidden(),
            method: this.method,
            name: this.node.name.text,
            operationId: this.getOperationId(),
            parameters: this.buildParameters(),
            path: this.path,
            responses: responses,
            security: this.getSecurity(),
            summary: jsDocUtils_1.getJSDocComment(this.node, 'summary'),
            tags: this.getTags(),
            type: type,
        };
    };
    MethodGenerator.prototype.buildParameters = function () {
        var _this = this;
        var parameters = this.node.parameters
            .map(function (p) {
            try {
                return new parameterGenerator_1.ParameterGenerator(p, _this.method, _this.path, _this.current).Generate();
            }
            catch (e) {
                var methodId = _this.node.name;
                var controllerId = _this.node.parent.name;
                throw new exceptions_1.GenerateMetadataError(e.message + " \n in '" + controllerId.text + "." + methodId.text + "'");
            }
        })
            .filter(function (p) { return p !== null; });
        var bodyParameters = parameters.filter(function (p) { return p.in === 'body'; });
        var bodyProps = parameters.filter(function (p) { return p.in === 'body-prop'; });
        if (bodyParameters.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one body parameter allowed in '" + this.getCurrentLocation() + "' method.");
        }
        if (bodyParameters.length > 0 && bodyProps.length > 0) {
            throw new exceptions_1.GenerateMetadataError("Choose either during @Body or @BodyProp in '" + this.getCurrentLocation() + "' method.");
        }
        return parameters;
    };
    MethodGenerator.prototype.getCurrentLocation = function () {
        var methodId = this.node.name;
        var controllerId = this.node.parent.name;
        return controllerId.text + "." + methodId.text;
    };
    MethodGenerator.prototype.processMethodDecorators = function () {
        var _this = this;
        var pathDecorators = decoratorUtils_1.getDecorators(this.node, function (identifier) { return _this.supportsPathMethod(identifier.text); });
        if (!pathDecorators || !pathDecorators.length) {
            return;
        }
        if (pathDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one path decorator in '" + this.getCurrentLocation + "' method, Found: " + pathDecorators.map(function (d) { return d.text; }).join(', '));
        }
        var decorator = pathDecorators[0];
        var expression = decorator.parent;
        var decoratorArgument = expression.arguments[0];
        this.method = decorator.text.toLowerCase();
        // if you don't pass in a path to the method decorator, we'll just use the base route
        // todo: what if someone has multiple no argument methods of the same type in a single controller?
        // we need to throw an error there
        this.path = decoratorArgument ? "" + decoratorArgument.text : '';
    };
    MethodGenerator.prototype.getMethodResponses = function () {
        var _this = this;
        var decorators = this.getDecoratorsByIdentifier(this.node, 'Response');
        if (!decorators || !decorators.length) {
            return [];
        }
        return decorators.map(function (decorator) {
            var expression = decorator.parent;
            var description = '';
            var name = '200';
            var examples;
            if (expression.arguments.length > 0 && expression.arguments[0].text) {
                name = expression.arguments[0].text;
            }
            if (expression.arguments.length > 1 && expression.arguments[1].text) {
                description = expression.arguments[1].text;
            }
            if (expression.arguments.length > 2 && expression.arguments[2]) {
                var argument = expression.arguments[2];
                examples = _this.getExamplesValue(argument);
            }
            return {
                description: description,
                examples: examples,
                name: name,
                schema: expression.typeArguments && expression.typeArguments.length > 0 ? new typeResolver_1.TypeResolver(expression.typeArguments[0], _this.current).resolve() : undefined,
            };
        });
    };
    MethodGenerator.prototype.getMethodSuccessResponse = function (type) {
        var decorators = this.getDecoratorsByIdentifier(this.node, 'SuccessResponse');
        if (!decorators || !decorators.length) {
            return {
                description: type.dataType === 'void' ? 'No content' : 'Ok',
                examples: this.getMethodSuccessExamples(),
                name: type.dataType === 'void' ? '204' : '200',
                schema: type,
            };
        }
        if (decorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one SuccessResponse decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        var decorator = decorators[0];
        var expression = decorator.parent;
        var description = '';
        var name = '200';
        var examples = this.getMethodSuccessExamples();
        if (expression.arguments.length > 0 && expression.arguments[0].text) {
            name = expression.arguments[0].text;
        }
        if (expression.arguments.length > 1 && expression.arguments[1].text) {
            description = expression.arguments[1].text;
        }
        return {
            description: description,
            examples: examples,
            name: name,
            schema: type,
        };
    };
    MethodGenerator.prototype.getMethodSuccessExamples = function () {
        var exampleDecorators = this.getDecoratorsByIdentifier(this.node, 'Example');
        if (!exampleDecorators || !exampleDecorators.length) {
            return undefined;
        }
        if (exampleDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one Example decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        var decorator = exampleDecorators[0];
        var expression = decorator.parent;
        var argument = expression.arguments[0];
        return this.getExamplesValue(argument);
    };
    MethodGenerator.prototype.supportsPathMethod = function (method) {
        return ['get', 'post', 'put', 'patch', 'delete', 'head'].some(function (m) { return m === method.toLowerCase(); });
    };
    MethodGenerator.prototype.getExamplesValue = function (argument) {
        var example = {};
        argument.properties.forEach(function (p) {
            example[p.name.text] = initializer_value_1.getInitializerValue(p.initializer);
        });
        return example;
    };
    MethodGenerator.prototype.getIsDeprecated = function () {
        if (jsDocUtils_1.isExistJSDocTag(this.node, function (tag) { return tag.tagName.text === 'deprecated'; })) {
            return true;
        }
        var depDecorators = this.getDecoratorsByIdentifier(this.node, 'Deprecated');
        if (!depDecorators || !depDecorators.length) {
            return false;
        }
        if (depDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one Deprecated decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        return true;
    };
    MethodGenerator.prototype.getOperationId = function () {
        var opDecorators = this.getDecoratorsByIdentifier(this.node, 'OperationId');
        if (!opDecorators || !opDecorators.length) {
            return undefined;
        }
        if (opDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one OperationId decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        var decorator = opDecorators[0];
        var expression = decorator.parent;
        var ops = expression.arguments.map(function (a) { return a.text; });
        return ops[0];
    };
    MethodGenerator.prototype.getTags = function () {
        var tagsDecorators = this.getDecoratorsByIdentifier(this.node, 'Tags');
        if (!tagsDecorators || !tagsDecorators.length) {
            return this.parentTags;
        }
        if (tagsDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one Tags decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        var decorator = tagsDecorators[0];
        var expression = decorator.parent;
        var tags = expression.arguments.map(function (a) { return a.text; });
        if (this.parentTags) {
            tags.push.apply(tags, __spread(this.parentTags));
        }
        return tags;
    };
    MethodGenerator.prototype.getIsHidden = function () {
        var hiddenDecorators = this.getDecoratorsByIdentifier(this.node, 'Hidden');
        if (!hiddenDecorators || !hiddenDecorators.length) {
            return !!this.isParentHidden;
        }
        if (this.isParentHidden) {
            throw new exceptions_1.GenerateMetadataError("Hidden decorator cannot be set on '" + this.getCurrentLocation() + "' it is already defined on the controller");
        }
        if (hiddenDecorators.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Only one Hidden decorator allowed in '" + this.getCurrentLocation + "' method.");
        }
        return true;
    };
    MethodGenerator.prototype.getSecurity = function () {
        var securityDecorators = this.getDecoratorsByIdentifier(this.node, 'Security');
        if (!securityDecorators || !securityDecorators.length) {
            return this.parentSecurity || [];
        }
        return security_1.getSecurities(securityDecorators);
    };
    MethodGenerator.prototype.getDecoratorsByIdentifier = function (node, id) {
        return decoratorUtils_1.getDecorators(node, function (identifier) { return identifier.text === id; });
    };
    return MethodGenerator;
}());
exports.MethodGenerator = MethodGenerator;
//# sourceMappingURL=methodGenerator.js.map