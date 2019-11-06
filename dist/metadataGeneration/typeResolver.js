"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var ts = require("typescript");
var assertNever_1 = require("../utils/assertNever");
var jsDocUtils_1 = require("./../utils/jsDocUtils");
var validatorUtils_1 = require("./../utils/validatorUtils");
var exceptions_1 = require("./exceptions");
var initializer_value_1 = require("./initializer-value");
var localReferenceTypeCache = {};
var inProgressTypes = {};
var TypeResolver = /** @class */ (function () {
    function TypeResolver(typeNode, current, parentNode, extractEnum, context, referencer) {
        if (extractEnum === void 0) { extractEnum = true; }
        if (context === void 0) { context = {}; }
        this.typeNode = typeNode;
        this.current = current;
        this.parentNode = parentNode;
        this.extractEnum = extractEnum;
        this.context = context;
        this.referencer = referencer;
        this.attemptToResolveKindToPrimitive = function (syntaxKind) {
            if (syntaxKind === ts.SyntaxKind.NumberKeyword) {
                return {
                    foundMatch: true,
                    resolvedType: 'number',
                };
            }
            else if (syntaxKind === ts.SyntaxKind.StringKeyword) {
                return {
                    foundMatch: true,
                    resolvedType: 'string',
                };
            }
            else if (syntaxKind === ts.SyntaxKind.BooleanKeyword) {
                return {
                    foundMatch: true,
                    resolvedType: 'boolean',
                };
            }
            else if (syntaxKind === ts.SyntaxKind.VoidKeyword) {
                return {
                    foundMatch: true,
                    resolvedType: 'void',
                };
            }
            else {
                return {
                    foundMatch: false,
                };
            }
        };
    }
    TypeResolver.clearCache = function () {
        Object.keys(localReferenceTypeCache).forEach(function (key) {
            delete localReferenceTypeCache[key];
        });
        Object.keys(inProgressTypes).forEach(function (key) {
            delete inProgressTypes[key];
        });
    };
    TypeResolver.prototype.resolve = function () {
        var _this = this;
        var primitiveType = this.getPrimitiveType(this.typeNode, this.parentNode);
        if (primitiveType) {
            return primitiveType;
        }
        if (this.typeNode.kind === ts.SyntaxKind.ArrayType) {
            var arrayMetaType = {
                dataType: 'array',
                elementType: new TypeResolver(this.typeNode.elementType, this.current, this.parentNode, this.extractEnum, this.context).resolve(),
            };
            return arrayMetaType;
        }
        if (ts.isUnionTypeNode(this.typeNode)) {
            var types = this.typeNode.types.map(function (type) {
                return new TypeResolver(type, _this.current, _this.parentNode, _this.extractEnum, _this.context).resolve();
            });
            var unionMetaType = {
                dataType: 'union',
                types: types,
            };
            return unionMetaType;
        }
        if (ts.isIntersectionTypeNode(this.typeNode)) {
            var types = this.typeNode.types.map(function (type) {
                return new TypeResolver(type, _this.current, _this.parentNode, _this.extractEnum, _this.context).resolve();
            });
            var intersectionMetaType = {
                dataType: 'intersection',
                types: types,
            };
            return intersectionMetaType;
        }
        if (this.typeNode.kind === ts.SyntaxKind.AnyKeyword) {
            var literallyAny = {
                dataType: 'any',
            };
            return literallyAny;
        }
        if (ts.isLiteralTypeNode(this.typeNode)) {
            var enumType = {
                dataType: 'enum',
                enums: [this.getLiteralValue(this.typeNode)],
            };
            return enumType;
        }
        if (ts.isTypeLiteralNode(this.typeNode)) {
            var properties = this.typeNode.members
                .filter(function (member) { return ts.isPropertySignature(member); })
                .reduce(function (res, propertySignature) {
                var type = new TypeResolver(propertySignature.type, _this.current, propertySignature, _this.extractEnum, _this.context).resolve();
                var property = {
                    default: jsDocUtils_1.getJSDocComment(propertySignature, 'default'),
                    description: _this.getNodeDescription(propertySignature),
                    format: _this.getNodeFormat(propertySignature),
                    name: propertySignature.name.text,
                    required: !propertySignature.questionToken,
                    type: type,
                    validators: validatorUtils_1.getPropertyValidators(propertySignature) || {},
                };
                return __spread([property], res);
            }, []);
            var indexMember = this.typeNode.members.find(function (member) { return ts.isIndexSignatureDeclaration(member); });
            var additionalType = void 0;
            if (indexMember) {
                var indexSignatureDeclaration = indexMember;
                var indexType = new TypeResolver(indexSignatureDeclaration.parameters[0].type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
                if (indexType.dataType !== 'string') {
                    throw new exceptions_1.GenerateMetadataError("Only string indexers are supported.");
                }
                additionalType = new TypeResolver(indexSignatureDeclaration.type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
            }
            var objLiteral = {
                additionalProperties: indexMember && additionalType,
                dataType: 'nestedObjectLiteral',
                properties: properties,
            };
            return objLiteral;
        }
        if (this.typeNode.kind === ts.SyntaxKind.ObjectKeyword) {
            return { dataType: 'object' };
        }
        if (ts.isMappedTypeNode(this.typeNode) && this.referencer) {
            var type = this.current.typeChecker.getTypeFromTypeNode(this.referencer);
            var tsProperties = this.current.typeChecker.getPropertiesOfType(type).map(function (symbol) { return symbol.declarations[0]; });
            var mappedTypeNode_1 = this.typeNode;
            var properties = tsProperties.map(function (property) {
                if (ts.isPropertySignature(property)) {
                    return _this.propertyFromSignature(property, mappedTypeNode_1.questionToken);
                }
                else if (ts.isPropertyDeclaration(property) || ts.isParameter(property)) {
                    return _this.propertyFromDeclaration(property, mappedTypeNode_1.questionToken);
                }
                else {
                    throw new exceptions_1.GenerateMetadataError("could not resolve property of kind " + property.kind + ". Please report this as an issue", property);
                }
            });
            var objectLiteral = {
                dataType: 'nestedObjectLiteral',
                properties: properties,
            };
            return objectLiteral;
        }
        if (ts.isConditionalTypeNode(this.typeNode) && this.referencer) {
            var type = this.current.typeChecker.getTypeFromTypeNode(this.referencer);
            if (type.aliasSymbol) {
                var declaration_1 = type.aliasSymbol.declarations[0];
                if (declaration_1.name) {
                    declaration_1 = this.getModelTypeDeclaration(declaration_1.name);
                }
                var name_1 = this.contextualizedName(declaration_1.name ? declaration_1.name.getText() : 'anonymousClass');
                return this.handleCachingAndCircularReferences(name_1, function () {
                    if (ts.isTypeAliasDeclaration(declaration_1)) {
                        return _this.getTypeAliasReference(declaration_1, name_1, _this.referencer);
                    }
                    else if (ts.isEnumDeclaration(declaration_1)) {
                        return _this.getEnumerateType(declaration_1.name, _this.extractEnum);
                    }
                    else {
                        throw new exceptions_1.GenerateMetadataError("Couldn't resolve Conditional to TypeNode. If you think this should be resolvable, please file an Issue. We found an aliasSymbol and it's declaration was of kind " + declaration_1.kind, _this.typeNode);
                    }
                });
            }
            else if (type.isClassOrInterface()) {
                var declaration_2 = type.symbol.declarations[0];
                if (declaration_2.name) {
                    declaration_2 = this.getModelTypeDeclaration(declaration_2.name);
                }
                var name_2 = this.contextualizedName(declaration_2.name ? declaration_2.name.getText() : 'anonymousClass');
                return this.handleCachingAndCircularReferences(name_2, function () { return _this.getModelReference(declaration_2, name_2); });
            }
            else {
                try {
                    return new TypeResolver(this.current.typeChecker.typeToTypeNode(type), this.current, this.typeNode, this.extractEnum, this.context, this.referencer).resolve();
                }
                catch (_a) {
                    throw new exceptions_1.GenerateMetadataError("Couldn't resolve Conditional to TypeNode. If you think this should be resolvable, please file an Issue. The flags on the result of the ConditionalType was " + type.flags, this.typeNode);
                }
            }
        }
        if (this.typeNode.kind !== ts.SyntaxKind.TypeReference) {
            throw new exceptions_1.GenerateMetadataError("Unknown type: " + ts.SyntaxKind[this.typeNode.kind]);
        }
        var typeReference = this.typeNode;
        if (typeReference.typeName.kind === ts.SyntaxKind.Identifier) {
            if (typeReference.typeName.text === 'Date') {
                return this.getDateType(this.parentNode);
            }
            if (typeReference.typeName.text === 'Buffer') {
                var bufferMetaType = { dataType: 'buffer' };
                return bufferMetaType;
            }
            if (typeReference.typeName.text === 'Array' && typeReference.typeArguments && typeReference.typeArguments.length === 1) {
                var arrayMetaType = {
                    dataType: 'array',
                    elementType: new TypeResolver(typeReference.typeArguments[0], this.current, this.parentNode, this.extractEnum, this.context).resolve(),
                };
                return arrayMetaType;
            }
            if (typeReference.typeName.text === 'Promise' && typeReference.typeArguments && typeReference.typeArguments.length === 1) {
                return new TypeResolver(typeReference.typeArguments[0], this.current, this.parentNode, this.extractEnum, this.context).resolve();
            }
            if (typeReference.typeName.text === 'String') {
                var stringMetaType = { dataType: 'string' };
                return stringMetaType;
            }
            if (this.context[typeReference.typeName.text]) {
                return new TypeResolver(this.context[typeReference.typeName.text], this.current, this.parentNode, this.extractEnum, this.context).resolve();
            }
        }
        if (!this.extractEnum) {
            var enumType = this.getEnumerateType(typeReference.typeName, this.extractEnum);
            if (enumType) {
                return enumType;
            }
        }
        var enumOrReferenceType = this.getReferenceTypeOrEnumType(typeReference);
        if (enumOrReferenceType.dataType === 'refEnum' || enumOrReferenceType.dataType === 'refObject' || enumOrReferenceType.dataType === 'refAlias') {
            this.current.AddReferenceType(enumOrReferenceType);
            return enumOrReferenceType;
        }
        else if (enumOrReferenceType.dataType === 'enum') {
            // then there is no reference to add to the reference type map
            // but we should still return it (if they want it)
            if (!this.extractEnum) {
                return enumOrReferenceType;
            }
        }
        else {
            assertNever_1.assertNever(enumOrReferenceType);
        }
        return enumOrReferenceType;
    };
    TypeResolver.prototype.getLiteralValue = function (typeNode) {
        var value;
        switch (typeNode.literal.kind) {
            case ts.SyntaxKind.TrueKeyword:
                value = true;
                break;
            case ts.SyntaxKind.FalseKeyword:
                value = false;
                break;
            case ts.SyntaxKind.StringLiteral:
                value = typeNode.literal.text;
                break;
            case ts.SyntaxKind.NumericLiteral:
                value = parseFloat(typeNode.literal.text);
                break;
            default:
                if (typeNode.literal.hasOwnProperty('text')) {
                    value = typeNode.literal.text;
                }
                else {
                    throw new exceptions_1.GenerateMetadataError("Couldn't resolve literal node: " + typeNode.literal.getText());
                }
        }
        return value;
    };
    TypeResolver.prototype.getPrimitiveType = function (typeNode, parentNode) {
        var resolution = this.attemptToResolveKindToPrimitive(typeNode.kind);
        if (!resolution.foundMatch) {
            return;
        }
        if (resolution.resolvedType === 'number') {
            if (!parentNode) {
                return { dataType: 'double' };
            }
            var tags = jsDocUtils_1.getJSDocTagNames(parentNode).filter(function (name) {
                return ['isInt', 'isLong', 'isFloat', 'isDouble'].some(function (m) { return m === name; });
            });
            if (tags.length === 0) {
                return { dataType: 'double' };
            }
            switch (tags[0]) {
                case 'isInt':
                    return { dataType: 'integer' };
                case 'isLong':
                    return { dataType: 'long' };
                case 'isFloat':
                    return { dataType: 'float' };
                case 'isDouble':
                    return { dataType: 'double' };
                default:
                    return { dataType: 'double' };
            }
        }
        else if (resolution.resolvedType === 'string') {
            return {
                dataType: 'string',
            };
        }
        else if (resolution.resolvedType === 'boolean') {
            return {
                dataType: 'boolean',
            };
        }
        else if (resolution.resolvedType === 'void') {
            return {
                dataType: 'void',
            };
        }
        else {
            return assertNever_1.assertNever(resolution.resolvedType);
        }
    };
    TypeResolver.prototype.getDateType = function (parentNode) {
        if (!parentNode) {
            return { dataType: 'datetime' };
        }
        var tags = jsDocUtils_1.getJSDocTagNames(parentNode).filter(function (name) {
            return ['isDate', 'isDateTime'].some(function (m) { return m === name; });
        });
        if (tags.length === 0) {
            return { dataType: 'datetime' };
        }
        switch (tags[0]) {
            case 'isDate':
                return { dataType: 'date' };
            case 'isDateTime':
                return { dataType: 'datetime' };
            default:
                return { dataType: 'datetime' };
        }
    };
    TypeResolver.prototype.getEnumerateType = function (typeName, extractEnum) {
        if (extractEnum === void 0) { extractEnum = true; }
        var enumName = typeName.text;
        var enumNodes = this.current.nodes.filter(function (node) { return node.kind === ts.SyntaxKind.EnumDeclaration; }).filter(function (node) { return node.name.text === enumName; });
        if (!enumNodes.length) {
            return;
        }
        if (enumNodes.length > 1) {
            throw new exceptions_1.GenerateMetadataError("Multiple matching enum found for enum " + enumName + "; please make enum names unique.");
        }
        var enumDeclaration = enumNodes[0];
        var typeChecker = this.current.typeChecker;
        function getEnumValue(member) {
            var constantValue = typeChecker.getConstantValue(member);
            if (constantValue != null) {
                return constantValue;
            }
            var initializer = member.initializer;
            if (initializer) {
                if (initializer.expression) {
                    return initializer.expression.text;
                }
                return initializer.text;
            }
            return;
        }
        if (extractEnum) {
            var enums = enumDeclaration.members.map(function (member, index) {
                var enumValue = getEnumValue(member);
                if (enumValue !== 0 && enumValue !== '' && !enumValue) {
                    return String(index);
                }
                return enumValue;
            });
            return {
                dataType: 'refEnum',
                description: this.getNodeDescription(enumDeclaration),
                enums: enums,
                refName: enumName,
            };
        }
        else {
            return {
                dataType: 'enum',
                enums: enumDeclaration.members.map(function (member, index) {
                    return getEnumValue(member) || String(index);
                }),
            };
        }
    };
    TypeResolver.prototype.getReferenceTypeOrEnumType = function (node) {
        var type;
        if (ts.isTypeReferenceNode(node)) {
            type = node.typeName;
        }
        else if (ts.isExpressionWithTypeArguments(node)) {
            type = node.expression;
        }
        else {
            throw new exceptions_1.GenerateMetadataError("Can't resolve Reference type.");
        }
        // Can't invoke getText on Synthetic Nodes
        var resolvableName = node.pos !== -1 ? node.getText() : type.text;
        var name = this.contextualizedName(resolvableName);
        this.typeArgumentsToContext(node, type, this.context);
        try {
            var existingType = localReferenceTypeCache[name];
            if (existingType) {
                return existingType;
            }
            var enumOrRefEnum = this.getEnumerateType(type, true);
            if (enumOrRefEnum) {
                if (enumOrRefEnum.dataType === 'refEnum') {
                    localReferenceTypeCache[name] = enumOrRefEnum;
                    return enumOrRefEnum;
                }
                else if (enumOrRefEnum.dataType === 'enum') {
                    // Since an enum that is not reusable can't be referenced, we don't put it in the cache.
                    // Also it doesn't qualify as a ref type, so might want to return it (if they've asked for it)
                    if (!this.extractEnum) {
                        return enumOrRefEnum;
                    }
                }
                else {
                    assertNever_1.assertNever(enumOrRefEnum);
                }
            }
            if (inProgressTypes[name]) {
                return this.createCircularDependencyResolver(name);
            }
            inProgressTypes[name] = true;
            var declaration = this.getModelTypeDeclaration(type);
            var referenceType = void 0;
            if (ts.isTypeAliasDeclaration(declaration)) {
                referenceType = this.getTypeAliasReference(declaration, name, node);
            }
            else {
                referenceType = this.getModelReference(declaration, name);
            }
            localReferenceTypeCache[name] = referenceType;
            return referenceType;
        }
        catch (err) {
            // tslint:disable-next-line:no-console
            console.error("There was a problem resolving type of '" + name + "'.");
            throw err;
        }
    };
    TypeResolver.prototype.getTypeAliasReference = function (declaration, name, referencer) {
        var example = this.getNodeExample(declaration);
        return __assign({ dataType: 'refAlias', default: jsDocUtils_1.getJSDocComment(declaration, 'default'), description: this.getNodeDescription(declaration), refName: this.getRefTypeName(name), type: new TypeResolver(declaration.type, this.current, declaration, this.extractEnum, this.context, this.referencer || referencer).resolve(), validators: validatorUtils_1.getPropertyValidators(declaration) || {} }, (example && { example: example }));
    };
    TypeResolver.prototype.getModelReference = function (modelType, name) {
        var properties = this.getModelProperties(modelType);
        var additionalProperties = this.getModelAdditionalProperties(modelType);
        var inheritedProperties = this.getModelInheritedProperties(modelType) || [];
        var example = this.getNodeExample(modelType);
        var referenceType = __assign({ additionalProperties: additionalProperties, dataType: 'refObject', description: this.getNodeDescription(modelType), properties: inheritedProperties, refName: this.getRefTypeName(name) }, (example && { example: example }));
        referenceType.properties = referenceType.properties.concat(properties);
        return referenceType;
    };
    TypeResolver.prototype.getRefTypeName = function (name) {
        return encodeURIComponent(name
            .replace(/<|>/g, '_')
            .replace(/ /g, '')
            .replace(/,/g, '.')
            .replace(/\'(.*)\'|\"(.*)\'/g, '$1')
            .replace(/&/g, '~AND')
            .replace(/\[\]/g, 'Array'));
    };
    TypeResolver.prototype.contextualizedName = function (name) {
        return Object.entries(this.context).reduce(function (acc, _a) {
            var _b = __read(_a, 2), key = _b[0], entry = _b[1];
            return acc
                .replace(new RegExp("<\\s*([^>]*\\s)*\\s*(" + key + ")(\\s[^>]*)*\\s*>", 'g'), "<$1" + entry.getText() + "$3>")
                .replace(new RegExp("<\\s*([^,]*\\s)*\\s*(" + key + ")(\\s[^,]*)*\\s*,", 'g'), "<$1" + entry.getText() + "$3,")
                .replace(new RegExp(",\\s*([^>]*\\s)*\\s*(" + key + ")(\\s[^>]*)*\\s*>", 'g'), ",$1" + entry.getText() + "$3>")
                .replace(new RegExp("<\\s*([^<]*\\s)*\\s*(" + key + ")(\\s[^<]*)*\\s*<", 'g'), "<$1" + entry.getText() + "$3<");
        }, name);
    };
    TypeResolver.prototype.handleCachingAndCircularReferences = function (name, declarationResolver) {
        try {
            var existingType = localReferenceTypeCache[name];
            if (existingType) {
                return existingType;
            }
            if (inProgressTypes[name]) {
                return this.createCircularDependencyResolver(name);
            }
            inProgressTypes[name] = true;
            var reference = declarationResolver();
            localReferenceTypeCache[name] = reference;
            this.current.AddReferenceType(reference);
            return reference;
        }
        catch (err) {
            // tslint:disable-next-line:no-console
            console.error("There was a problem resolving type of '" + name + "'.");
            throw err;
        }
    };
    TypeResolver.prototype.createCircularDependencyResolver = function (refName) {
        var referenceType = {
            dataType: 'refObject',
            refName: refName,
        };
        this.current.OnFinish(function (referenceTypes) {
            var realReferenceType = referenceTypes[refName];
            if (!realReferenceType) {
                return;
            }
            referenceType.description = realReferenceType.description;
            if (realReferenceType.dataType === 'refObject' && referenceType.dataType === 'refObject') {
                referenceType.properties = realReferenceType.properties;
            }
            referenceType.dataType = realReferenceType.dataType;
            referenceType.refName = referenceType.refName;
        });
        return referenceType;
    };
    TypeResolver.prototype.nodeIsUsable = function (node) {
        switch (node.kind) {
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
                return true;
            default:
                return false;
        }
    };
    TypeResolver.prototype.resolveLeftmostIdentifier = function (type) {
        while (type.kind !== ts.SyntaxKind.Identifier) {
            type = type.left;
        }
        return type;
    };
    TypeResolver.prototype.resolveModelTypeScope = function (leftmost, statements) {
        var _this = this;
        var _loop_1 = function () {
            var leftmostName = leftmost.kind === ts.SyntaxKind.Identifier ? leftmost.text : leftmost.right.text;
            var moduleDeclarations = statements.filter(function (node) {
                if (node.kind !== ts.SyntaxKind.ModuleDeclaration || !_this.current.IsExportedNode(node)) {
                    return false;
                }
                var moduleDeclaration = node;
                return moduleDeclaration.name.text.toLowerCase() === leftmostName.toLowerCase();
            });
            if (!moduleDeclarations.length) {
                throw new exceptions_1.GenerateMetadataError("No matching module declarations found for " + leftmostName + ".");
            }
            if (moduleDeclarations.length > 1) {
                throw new exceptions_1.GenerateMetadataError("Multiple matching module declarations found for " + leftmostName + "; please make module declarations unique.");
            }
            var moduleBlock = moduleDeclarations[0].body;
            if (moduleBlock === null || moduleBlock.kind !== ts.SyntaxKind.ModuleBlock) {
                throw new exceptions_1.GenerateMetadataError("Module declaration found for " + leftmostName + " has no body.");
            }
            statements = moduleBlock.statements;
            leftmost = leftmost.parent;
        };
        while (leftmost.parent && leftmost.parent.kind === ts.SyntaxKind.QualifiedName) {
            _loop_1();
        }
        return statements;
    };
    TypeResolver.prototype.getModelTypeDeclaration = function (type) {
        var _this = this;
        var leftmostIdentifier = this.resolveLeftmostIdentifier(type);
        var statements = this.resolveModelTypeScope(leftmostIdentifier, this.current.nodes);
        var typeName = type.kind === ts.SyntaxKind.Identifier ? type.text : type.right.text;
        var modelTypes = statements.filter(function (node) {
            if (!_this.nodeIsUsable(node) || !_this.current.IsExportedNode(node)) {
                return false;
            }
            var modelTypeDeclaration = node;
            return modelTypeDeclaration.name.text === typeName;
        });
        if (!modelTypes.length) {
            throw new exceptions_1.GenerateMetadataError("No matching model found for referenced type " + typeName + ". If " + typeName + " comes from a dependency, please create an interface in your own code that has the same structure. Tsoa can not utilize interfaces from external dependencies. Read more at https://github.com/lukeautry/tsoa/blob/master/docs/ExternalInterfacesExplanation.MD");
        }
        if (modelTypes.length > 1) {
            // remove types that are from typescript e.g. 'Account'
            modelTypes = modelTypes.filter(function (modelType) {
                if (modelType
                    .getSourceFile()
                    .fileName.replace(/\\/g, '/')
                    .toLowerCase()
                    .indexOf('node_modules/typescript') > -1) {
                    return false;
                }
                return true;
            });
            /**
             * Model is marked with '@tsoaModel', indicating that it should be the 'canonical' model used
             */
            var designatedModels = modelTypes.filter(function (modelType) {
                var isDesignatedModel = jsDocUtils_1.isExistJSDocTag(modelType, function (tag) { return tag.tagName.text === 'tsoaModel'; });
                return isDesignatedModel;
            });
            if (designatedModels.length > 0) {
                if (designatedModels.length > 1) {
                    throw new exceptions_1.GenerateMetadataError("Multiple models for " + typeName + " marked with '@tsoaModel'; '@tsoaModel' should only be applied to one model.");
                }
                modelTypes = designatedModels;
            }
        }
        if (modelTypes.length > 1) {
            var conflicts = modelTypes.map(function (modelType) { return modelType.getSourceFile().fileName; }).join('"; "');
            throw new exceptions_1.GenerateMetadataError("Multiple matching models found for referenced type " + typeName + "; please make model names unique. Conflicts found: \"" + conflicts + "\".");
        }
        return modelTypes[0];
    };
    TypeResolver.prototype.getModelProperties = function (node, overrideToken) {
        var _this = this;
        var isIgnored = function (e) {
            var ignore = jsDocUtils_1.isExistJSDocTag(e, function (tag) { return tag.tagName.text === 'ignore'; });
            return ignore;
        };
        // Interface model
        if (ts.isInterfaceDeclaration(node)) {
            return node.members.filter(function (member) { return !isIgnored(member) && ts.isPropertySignature(member); }).map(function (member) { return _this.propertyFromSignature(member, overrideToken); });
        }
        // Class model
        var properties = node.members
            .filter(function (member) { return !isIgnored(member); })
            .filter(function (member) { return member.kind === ts.SyntaxKind.PropertyDeclaration; })
            .filter(function (member) { return _this.hasPublicModifier(member); });
        var classConstructor = node.members.find(function (member) { return ts.isConstructorDeclaration(member); });
        if (classConstructor && classConstructor.parameters) {
            var constructorProperties = classConstructor.parameters.filter(function (parameter) { return _this.isAccessibleParameter(parameter); });
            properties.push.apply(properties, __spread(constructorProperties));
        }
        return properties.map(function (property) { return _this.propertyFromDeclaration(property, overrideToken); });
    };
    TypeResolver.prototype.propertyFromSignature = function (propertySignature, overrideToken) {
        var identifier = propertySignature.name;
        if (!propertySignature.type) {
            throw new exceptions_1.GenerateMetadataError("No valid type found for property declaration.");
        }
        var required = !propertySignature.questionToken;
        if (overrideToken && overrideToken.kind === ts.SyntaxKind.MinusToken) {
            required = true;
        }
        else if (overrideToken && overrideToken.kind === ts.SyntaxKind.QuestionToken) {
            required = false;
        }
        var property = {
            default: jsDocUtils_1.getJSDocComment(propertySignature, 'default'),
            description: this.getNodeDescription(propertySignature),
            format: this.getNodeFormat(propertySignature),
            name: identifier.text,
            required: required,
            type: new TypeResolver(propertySignature.type, this.current, propertySignature.type.parent, this.extractEnum, this.context).resolve(),
            validators: validatorUtils_1.getPropertyValidators(propertySignature) || {},
        };
        return property;
    };
    TypeResolver.prototype.propertyFromDeclaration = function (propertyDeclaration, overrideToken) {
        var identifier = propertyDeclaration.name;
        var typeNode = propertyDeclaration.type;
        if (!typeNode) {
            var tsType = this.current.typeChecker.getTypeAtLocation(propertyDeclaration);
            typeNode = this.current.typeChecker.typeToTypeNode(tsType);
        }
        if (!typeNode) {
            throw new exceptions_1.GenerateMetadataError("No valid type found for property declaration.");
        }
        var type = new TypeResolver(typeNode, this.current, propertyDeclaration, this.extractEnum, this.context).resolve();
        var required = !propertyDeclaration.questionToken && !propertyDeclaration.initializer;
        if (overrideToken && overrideToken.kind === ts.SyntaxKind.MinusToken) {
            required = true;
        }
        else if (overrideToken && overrideToken.kind === ts.SyntaxKind.QuestionToken) {
            required = false;
        }
        var property = {
            default: initializer_value_1.getInitializerValue(propertyDeclaration.initializer, type),
            description: this.getNodeDescription(propertyDeclaration),
            format: this.getNodeFormat(propertyDeclaration),
            name: identifier.text,
            required: required,
            type: type,
            validators: validatorUtils_1.getPropertyValidators(propertyDeclaration) || {},
        };
        return property;
    };
    TypeResolver.prototype.getModelAdditionalProperties = function (node) {
        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            var interfaceDeclaration = node;
            var indexMember = interfaceDeclaration.members.find(function (member) { return member.kind === ts.SyntaxKind.IndexSignature; });
            if (!indexMember) {
                return undefined;
            }
            var indexSignatureDeclaration = indexMember;
            var indexType = new TypeResolver(indexSignatureDeclaration.parameters[0].type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
            if (indexType.dataType !== 'string') {
                throw new exceptions_1.GenerateMetadataError("Only string indexers are supported.");
            }
            return new TypeResolver(indexSignatureDeclaration.type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
        }
        return undefined;
    };
    TypeResolver.prototype.typeArgumentsToContext = function (type, targetEntitiy, context) {
        var _a;
        this.context = {};
        var typeParameters = this.getModelTypeDeclaration(targetEntitiy).typeParameters;
        if (typeParameters) {
            for (var index = 0; index < typeParameters.length; index++) {
                var typeParameter = typeParameters[index];
                var typeArg = type.typeArguments && type.typeArguments[index];
                var resolvedType = void 0;
                // Argument may be a forward reference from context
                if (typeArg && ts.isTypeReferenceNode(typeArg) && ts.isIdentifier(typeArg.typeName) && context[typeArg.typeName.text]) {
                    resolvedType = context[typeArg.typeName.text];
                }
                else if (typeArg) {
                    resolvedType = typeArg;
                }
                else if (typeParameter.default) {
                    resolvedType = typeParameter.default;
                }
                else {
                    throw new exceptions_1.GenerateMetadataError("Could not find a value for type parameter " + typeParameter.name.text, type);
                }
                this.context = __assign(__assign({}, this.context), (_a = {}, _a[typeParameter.name.text] = resolvedType, _a));
            }
        }
        return context;
    };
    TypeResolver.prototype.getModelInheritedProperties = function (modelTypeDeclaration) {
        var _this = this;
        var properties = [];
        var heritageClauses = modelTypeDeclaration.heritageClauses;
        if (!heritageClauses) {
            return properties;
        }
        heritageClauses.forEach(function (clause) {
            if (!clause.types) {
                return;
            }
            clause.types.forEach(function (t) {
                var baseEntityName = t.expression;
                // create subContext
                var resetCtx = _this.typeArgumentsToContext(t, baseEntityName, _this.context);
                var referenceType = _this.getReferenceTypeOrEnumType(t);
                if (referenceType) {
                    if (referenceType.dataType === 'refEnum' || referenceType.dataType === 'enum') {
                        // since it doesn't have properties to iterate over, then we don't do anything with it
                    }
                    else if (referenceType.dataType === 'refAlias') {
                        var type = referenceType;
                        while (type.dataType === 'refAlias') {
                            type = type.type;
                        }
                        if (type.dataType === 'refObject') {
                            properties = __spread(properties, type.properties);
                        }
                        else if (type.dataType === 'nestedObjectLiteral') {
                            properties = __spread(properties, type.properties);
                        }
                    }
                    else if (referenceType.dataType === 'refObject') {
                        referenceType.properties.forEach(function (property) { return properties.push(property); });
                    }
                    else {
                        assertNever_1.assertNever(referenceType);
                    }
                }
                // reset subContext
                _this.context = resetCtx;
            });
        });
        return properties;
    };
    TypeResolver.prototype.hasPublicModifier = function (node) {
        return (!node.modifiers ||
            node.modifiers.every(function (modifier) {
                return modifier.kind !== ts.SyntaxKind.ProtectedKeyword && modifier.kind !== ts.SyntaxKind.PrivateKeyword;
            }));
    };
    TypeResolver.prototype.isAccessibleParameter = function (node) {
        // No modifiers
        if (!node.modifiers) {
            return false;
        }
        // public || public readonly
        if (node.modifiers.some(function (modifier) { return modifier.kind === ts.SyntaxKind.PublicKeyword; })) {
            return true;
        }
        // readonly, not private readonly, not public readonly
        var isReadonly = node.modifiers.some(function (modifier) { return modifier.kind === ts.SyntaxKind.ReadonlyKeyword; });
        var isProtectedOrPrivate = node.modifiers.some(function (modifier) {
            return modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.PrivateKeyword;
        });
        return isReadonly && !isProtectedOrPrivate;
    };
    TypeResolver.prototype.getNodeDescription = function (node) {
        var symbol = this.current.typeChecker.getSymbolAtLocation(node.name);
        if (!symbol) {
            return undefined;
        }
        /**
         * TODO: Workaround for what seems like a bug in the compiler
         * Warrants more investigation and possibly a PR against typescript
         */
        if (node.kind === ts.SyntaxKind.Parameter) {
            // TypeScript won't parse jsdoc if the flag is 4, i.e. 'Property'
            symbol.flags = 0;
        }
        var comments = symbol.getDocumentationComment(this.current.typeChecker);
        if (comments.length) {
            return ts.displayPartsToString(comments);
        }
        return undefined;
    };
    TypeResolver.prototype.getNodeFormat = function (node) {
        return jsDocUtils_1.getJSDocComment(node, 'format');
    };
    TypeResolver.prototype.getNodeExample = function (node) {
        var example = jsDocUtils_1.getJSDocComment(node, 'example');
        if (example) {
            return JSON.parse(example);
        }
        else {
            return undefined;
        }
    };
    return TypeResolver;
}());
exports.TypeResolver = TypeResolver;
//# sourceMappingURL=typeResolver.js.map