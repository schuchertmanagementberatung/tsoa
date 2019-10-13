import * as ts from 'typescript';
import { assertNever } from '../utils/assertNever';
import { getJSDocComment, getJSDocTagNames, isExistJSDocTag } from './../utils/jsDocUtils';
import { getPropertyValidators } from './../utils/validatorUtils';
import { GenerateMetadataError } from './exceptions';
import { getInitializerValue } from './initializer-value';
import { MetadataGenerator } from './metadataGenerator';
import { Tsoa } from './tsoa';

const localReferenceTypeCache: { [typeName: string]: Tsoa.ReferenceType } = {};
const inProgressTypes: { [typeName: string]: boolean } = {};

type OverrideToken = ts.Token<ts.SyntaxKind.QuestionToken> | ts.Token<ts.SyntaxKind.PlusToken> | ts.Token<ts.SyntaxKind.MinusToken> | undefined;
type UsableDeclaration = ts.InterfaceDeclaration | ts.ClassDeclaration | ts.PropertySignature | ts.TypeAliasDeclaration;
interface Context {
  [name: string]: ts.TypeReferenceNode | ts.TypeNode;
}

export class TypeResolver {
  constructor(
    private readonly typeNode: ts.TypeNode,
    private readonly current: MetadataGenerator,
    private readonly parentNode?: ts.Node,
    private readonly extractEnum = true,
    private context: Context = {},
    private readonly referencer?: ts.TypeReferenceType,
  ) {}

  public static clearCache() {
    Object.keys(localReferenceTypeCache).forEach(key => {
      delete localReferenceTypeCache[key];
    });

    Object.keys(inProgressTypes).forEach(key => {
      delete inProgressTypes[key];
    });
  }

  public resolve(): Tsoa.Type {
    const primitiveType = this.getPrimitiveType(this.typeNode, this.parentNode);
    if (primitiveType) {
      return primitiveType;
    }

    if (this.typeNode.kind === ts.SyntaxKind.ArrayType) {
      const arrayMetaType: Tsoa.ArrayType = {
        dataType: 'array',
        elementType: new TypeResolver((this.typeNode as ts.ArrayTypeNode).elementType, this.current, this.parentNode, this.extractEnum, this.context).resolve(),
      };
      return arrayMetaType;
    }

    if (ts.isUnionTypeNode(this.typeNode)) {
      const types = this.typeNode.types.map(type => {
        return new TypeResolver(type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
      });

      const unionMetaType: Tsoa.UnionType = {
        dataType: 'union',
        types,
      };
      return unionMetaType;
    }

    if (ts.isIntersectionTypeNode(this.typeNode)) {
      const types = this.typeNode.types.map(type => {
        return new TypeResolver(type, this.current, this.parentNode, this.extractEnum, this.context).resolve();
      });

      const intersectionMetaType: Tsoa.IntersectionType = {
        dataType: 'intersection',
        types,
      };

      return intersectionMetaType;
    }

    if (this.typeNode.kind === ts.SyntaxKind.AnyKeyword) {
      const literallyAny: Tsoa.AnyType = {
        dataType: 'any',
      };
      return literallyAny;
    }

    if (ts.isLiteralTypeNode(this.typeNode)) {
      const enumType: Tsoa.EnumType = {
        dataType: 'enum',
        enums: [this.getLiteralValue(this.typeNode)],
      };
      return enumType;
    }

    if (ts.isTypeLiteralNode(this.typeNode)) {
      const properties = this.typeNode.members
        .filter(member => ts.isPropertySignature(member))
        .reduce((res, propertySignature: ts.PropertySignature) => {
          const type = new TypeResolver(propertySignature.type as ts.TypeNode, this.current, propertySignature, this.extractEnum, this.context).resolve();
          const property: Tsoa.Property = {
            default: getJSDocComment(propertySignature, 'default'),
            description: this.getNodeDescription(propertySignature),
            format: this.getNodeFormat(propertySignature),
            name: (propertySignature.name as ts.Identifier).text,
            required: !propertySignature.questionToken,
            type,
            validators: getPropertyValidators(propertySignature) || {},
          };

          return [property, ...res];
        }, []);

      const indexMember = this.typeNode.members.find(member => ts.isIndexSignatureDeclaration(member));
      let additionalType: Tsoa.Type | undefined;

      if (indexMember) {
        const indexSignatureDeclaration = indexMember as ts.IndexSignatureDeclaration;
        const indexType = new TypeResolver(indexSignatureDeclaration.parameters[0].type as ts.TypeNode, this.current, this.parentNode, this.extractEnum, this.context).resolve();
        if (indexType.dataType !== 'string') {
          throw new GenerateMetadataError(`Only string indexers are supported.`);
        }

        additionalType = new TypeResolver(indexSignatureDeclaration.type as ts.TypeNode, this.current, this.parentNode, this.extractEnum, this.context).resolve();
      }

      const objLiteral: Tsoa.NestedObjectLiteralType = {
        additionalProperties: indexMember && additionalType,
        dataType: 'nestedObjectLiteral',
        properties,
      };
      return objLiteral;
    }

    if (this.typeNode.kind === ts.SyntaxKind.ObjectKeyword) {
      return { dataType: 'object' };
    }

    if (ts.isMappedTypeNode(this.typeNode) && this.referencer) {
      const type = this.current.typeChecker.getTypeFromTypeNode(this.referencer);
      const tsProperties = this.current.typeChecker.getPropertiesOfType(type).map(symbol => symbol.declarations[0]);
      const mappedTypeNode = this.typeNode;
      const properties = tsProperties.map(property => {
        if (ts.isPropertySignature(property)) {
          return this.propertyFromSignature(property, mappedTypeNode.questionToken);
        } else if (ts.isPropertyDeclaration(property) || ts.isParameter(property)) {
          return this.propertyFromDeclaration(property, mappedTypeNode.questionToken);
        } else {
          throw new GenerateMetadataError(`could not resolve property of kind ${property.kind}. Please report this as an issue`, property);
        }
      });

      const objectLiteral: Tsoa.NestedObjectLiteralType = {
        dataType: 'nestedObjectLiteral',
        properties,
      };
      return objectLiteral;
    }

    if (ts.isConditionalTypeNode(this.typeNode) && this.referencer) {
      const type = this.current.typeChecker.getTypeFromTypeNode(this.referencer);

      if (type.aliasSymbol) {
        let declaration = type.aliasSymbol.declarations[0] as ts.TypeAliasDeclaration | ts.EnumDeclaration | ts.DeclarationStatement;
        if (declaration.name) {
          declaration = this.getModelTypeDeclaration(declaration.name as ts.EntityName);
        }
        const name = this.contextualizedName(declaration.name ? declaration.name.getText() : 'anonymousClass');
        return this.handleCachingAndCircularReferences(name, () => {
          if (ts.isTypeAliasDeclaration(declaration)) {
            return this.getTypeAliasReference(declaration, name, this.referencer!);
          } else if (ts.isEnumDeclaration(declaration)) {
            return this.getEnumerateType(declaration.name, this.extractEnum) as Tsoa.RefEnumType;
          } else {
            throw new GenerateMetadataError(
              `Couldn't resolve Conditional to TypeNode. If you think this should be resolvable, please file an Issue. We found an aliasSymbol and it's declaration was of kind ${declaration.kind}`,
              this.typeNode,
            );
          }
        });
      } else if (type.isClassOrInterface()) {
        let declaration = type.symbol.declarations[0] as ts.InterfaceDeclaration | ts.ClassDeclaration;
        if (declaration.name) {
          declaration = this.getModelTypeDeclaration(declaration.name) as ts.InterfaceDeclaration | ts.ClassDeclaration;
        }
        const name = this.contextualizedName(declaration.name ? declaration.name.getText() : 'anonymousClass');
        return this.handleCachingAndCircularReferences(name, () => this.getModelReference(declaration, name));
      } else {
        try {
          return new TypeResolver(this.current.typeChecker.typeToTypeNode(type)!, this.current, this.typeNode, this.extractEnum, this.context, this.referencer).resolve();
        } catch {
          throw new GenerateMetadataError(
            `Couldn't resolve Conditional to TypeNode. If you think this should be resolvable, please file an Issue. The flags on the result of the ConditionalType was ${type.flags}`,
            this.typeNode,
          );
        }
      }
    }

    if (this.typeNode.kind !== ts.SyntaxKind.TypeReference) {
      throw new GenerateMetadataError(`Unknown type: ${ts.SyntaxKind[this.typeNode.kind]}`);
    }

    const typeReference = this.typeNode as ts.TypeReferenceNode;
    if (typeReference.typeName.kind === ts.SyntaxKind.Identifier) {
      if (typeReference.typeName.text === 'Date') {
        return this.getDateType(this.parentNode);
      }

      if (typeReference.typeName.text === 'Buffer') {
        const bufferMetaType: Tsoa.BufferType = { dataType: 'buffer' };
        return bufferMetaType;
      }

      if (typeReference.typeName.text === 'Array' && typeReference.typeArguments && typeReference.typeArguments.length === 1) {
        const arrayMetaType: Tsoa.ArrayType = {
          dataType: 'array',
          elementType: new TypeResolver(typeReference.typeArguments[0], this.current, this.parentNode, this.extractEnum, this.context).resolve(),
        };
        return arrayMetaType;
      }

      if (typeReference.typeName.text === 'Promise' && typeReference.typeArguments && typeReference.typeArguments.length === 1) {
        return new TypeResolver(typeReference.typeArguments[0], this.current, this.parentNode, this.extractEnum, this.context).resolve();
      }

      if (typeReference.typeName.text === 'String') {
        const stringMetaType: Tsoa.StringType = { dataType: 'string' };
        return stringMetaType;
      }

      if (this.context[typeReference.typeName.text]) {
        return new TypeResolver(this.context[typeReference.typeName.text], this.current, this.parentNode, this.extractEnum, this.context).resolve();
      }
    }

    if (!this.extractEnum) {
      const enumType = this.getEnumerateType(typeReference.typeName, this.extractEnum);
      if (enumType) {
        return enumType;
      }
    }

    const enumOrReferenceType = this.getReferenceTypeOrEnumType(typeReference);

    if (enumOrReferenceType.dataType === 'refEnum' || enumOrReferenceType.dataType === 'refObject' || enumOrReferenceType.dataType === 'refAlias') {
      this.current.AddReferenceType(enumOrReferenceType);
      return enumOrReferenceType;
    } else if (enumOrReferenceType.dataType === 'enum') {
      // then there is no reference to add to the reference type map
      // but we should still return it (if they want it)
      if (!this.extractEnum) {
        return enumOrReferenceType;
      }
    } else {
      assertNever(enumOrReferenceType);
    }

    return enumOrReferenceType;
  }

  private getLiteralValue(typeNode: ts.LiteralTypeNode): string | number | boolean {
    let value: boolean | number | string;
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
          value = (typeNode.literal as ts.LiteralExpression).text;
        } else {
          throw new GenerateMetadataError(`Couldn't resolve literal node: ${typeNode.literal.getText()}`);
        }
    }
    return value;
  }

  private getPrimitiveType(typeNode: ts.TypeNode, parentNode?: ts.Node): Tsoa.PrimitiveType | undefined {
    const resolution = this.attemptToResolveKindToPrimitive(typeNode.kind);
    if (!resolution.foundMatch) {
      return;
    }

    if (resolution.resolvedType === 'number') {
      if (!parentNode) {
        return { dataType: 'double' };
      }

      const tags = getJSDocTagNames(parentNode).filter(name => {
        return ['isInt', 'isLong', 'isFloat', 'isDouble'].some(m => m === name);
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
    } else if (resolution.resolvedType === 'string') {
      return {
        dataType: 'string',
      };
    } else if (resolution.resolvedType === 'boolean') {
      return {
        dataType: 'boolean',
      };
    } else if (resolution.resolvedType === 'void') {
      return {
        dataType: 'void',
      };
    } else {
      return assertNever(resolution.resolvedType);
    }
  }

  private getDateType(parentNode?: ts.Node): Tsoa.DateType | Tsoa.DateTimeType {
    if (!parentNode) {
      return { dataType: 'datetime' };
    }
    const tags = getJSDocTagNames(parentNode).filter(name => {
      return ['isDate', 'isDateTime'].some(m => m === name);
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
  }

  private getEnumerateType(typeName: ts.EntityName, extractEnum = true): Tsoa.EnumType | Tsoa.RefEnumType | undefined {
    const enumName = (typeName as ts.Identifier).text;
    const enumNodes = this.current.nodes.filter(node => node.kind === ts.SyntaxKind.EnumDeclaration).filter(node => (node as any).name.text === enumName);

    if (!enumNodes.length) {
      return;
    }
    if (enumNodes.length > 1) {
      throw new GenerateMetadataError(`Multiple matching enum found for enum ${enumName}; please make enum names unique.`);
    }

    const enumDeclaration = enumNodes[0] as ts.EnumDeclaration;

    const typeChecker = this.current.typeChecker;
    function getEnumValue(member: any) {
      const constantValue = typeChecker.getConstantValue(member);
      if (constantValue != null) {
        return constantValue;
      }
      const initializer = member.initializer;
      if (initializer) {
        if (initializer.expression) {
          return initializer.expression.text;
        }
        return initializer.text;
      }
      return;
    }

    if (extractEnum) {
      const enums = enumDeclaration.members.map((member: any, index) => {
        const enumValue = getEnumValue(member);
        if (enumValue !== 0 && enumValue !== '' && !enumValue) {
          return String(index);
        }
        return enumValue;
      });
      return {
        dataType: 'refEnum',
        description: this.getNodeDescription(enumDeclaration),
        enums,
        refName: enumName,
      };
    } else {
      return {
        dataType: 'enum',
        enums: enumDeclaration.members.map((member: any, index) => {
          return getEnumValue(member) || String(index);
        }),
      };
    }
  }

  private getReferenceTypeOrEnumType(node: ts.TypeReferenceType): Tsoa.ReferenceType | Tsoa.EnumType {
    let type: ts.EntityName;
    if (ts.isTypeReferenceNode(node)) {
      type = node.typeName;
    } else if (ts.isExpressionWithTypeArguments(node)) {
      type = node.expression as ts.EntityName;
    } else {
      throw new GenerateMetadataError(`Can't resolve Reference type.`);
    }

    // Can't invoke getText on Synthetic Nodes
    const resolvableName = node.pos !== -1 ? node.getText() : (type as ts.Identifier).text;

    const name = this.contextualizedName(resolvableName);

    this.typeArgumentsToContext(node, type, this.context);

    try {
      const existingType = localReferenceTypeCache[name];
      if (existingType) {
        return existingType;
      }

      const enumOrRefEnum = this.getEnumerateType(type, true);
      if (enumOrRefEnum) {
        if (enumOrRefEnum.dataType === 'refEnum') {
          localReferenceTypeCache[name] = enumOrRefEnum;
          return enumOrRefEnum;
        } else if (enumOrRefEnum.dataType === 'enum') {
          // Since an enum that is not reusable can't be referenced, we don't put it in the cache.
          // Also it doesn't qualify as a ref type, so might want to return it (if they've asked for it)
          if (!this.extractEnum) {
            return enumOrRefEnum;
          }
        } else {
          assertNever(enumOrRefEnum);
        }
      }

      if (inProgressTypes[name]) {
        return this.createCircularDependencyResolver(name);
      }

      inProgressTypes[name] = true;

      const declaration = this.getModelTypeDeclaration(type);

      let referenceType: Tsoa.ReferenceType;
      if (ts.isTypeAliasDeclaration(declaration)) {
        referenceType = this.getTypeAliasReference(declaration, name, node);
      } else {
        referenceType = this.getModelReference(declaration, name);
      }

      localReferenceTypeCache[name] = referenceType;

      return referenceType;
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.error(`There was a problem resolving type of '${name}'.`);
      throw err;
    }
  }

  private getTypeAliasReference(declaration: ts.TypeAliasDeclaration, name: string, referencer: ts.TypeReferenceType): Tsoa.ReferenceType {
    const example = this.getNodeExample(declaration);

    return {
      dataType: 'refAlias',
      default: getJSDocComment(declaration, 'default'),
      description: this.getNodeDescription(declaration),
      refName: this.getRefTypeName(name),
      type: new TypeResolver(declaration.type, this.current, declaration, this.extractEnum, this.context, this.referencer || referencer).resolve(),
      validators: getPropertyValidators(declaration) || {},
      ...(example && { example }),
    };
  }

  private getModelReference(modelType: ts.InterfaceDeclaration | ts.ClassDeclaration, name: string) {
    const properties = this.getModelProperties(modelType);
    const additionalProperties = this.getModelAdditionalProperties(modelType);
    const inheritedProperties = this.getModelInheritedProperties(modelType) || [];
    const example = this.getNodeExample(modelType);

    const referenceType: Tsoa.ReferenceType = {
      additionalProperties,
      dataType: 'refObject',
      description: this.getNodeDescription(modelType),
      properties: inheritedProperties,
      refName: this.getRefTypeName(name),
      ...(example && { example }),
    };

    referenceType.properties = referenceType.properties.concat(properties);

    return referenceType;
  }

  private getRefTypeName(name: string): string {
    return encodeURIComponent(
      name
        .replace(/<|>/g, '_')
        .replace(/ /g, '')
        .replace(/,/g, '.')
        .replace(/\'(.*)\'|\"(.*)\'/g, '$1')
        .replace(/&/g, '~AND')
        .replace(/\[\]/g, 'Array'),
    );
  }

  private attemptToResolveKindToPrimitive = (syntaxKind: ts.SyntaxKind): ResolvesToPrimitive | DoesNotResolveToPrimitive => {
    if (syntaxKind === ts.SyntaxKind.NumberKeyword) {
      return {
        foundMatch: true,
        resolvedType: 'number',
      };
    } else if (syntaxKind === ts.SyntaxKind.StringKeyword) {
      return {
        foundMatch: true,
        resolvedType: 'string',
      };
    } else if (syntaxKind === ts.SyntaxKind.BooleanKeyword) {
      return {
        foundMatch: true,
        resolvedType: 'boolean',
      };
    } else if (syntaxKind === ts.SyntaxKind.VoidKeyword) {
      return {
        foundMatch: true,
        resolvedType: 'void',
      };
    } else {
      return {
        foundMatch: false,
      };
    }
  };

  private contextualizedName(name: string): string {
    return Object.entries(this.context).reduce((acc, [key, entry]) => {
      return acc
        .replace(new RegExp(`<\\s*([^>]*\\s)*\\s*(${key})(\\s[^>]*)*\\s*>`, 'g'), `<$1${entry.getText()}$3>`)
        .replace(new RegExp(`<\\s*([^,]*\\s)*\\s*(${key})(\\s[^,]*)*\\s*,`, 'g'), `<$1${entry.getText()}$3,`)
        .replace(new RegExp(`,\\s*([^>]*\\s)*\\s*(${key})(\\s[^>]*)*\\s*>`, 'g'), `,$1${entry.getText()}$3>`)
        .replace(new RegExp(`<\\s*([^<]*\\s)*\\s*(${key})(\\s[^<]*)*\\s*<`, 'g'), `<$1${entry.getText()}$3<`);
    }, name);
  }

  private handleCachingAndCircularReferences(name: string, declarationResolver: () => Tsoa.ReferenceType): Tsoa.ReferenceType {
    try {
      const existingType = localReferenceTypeCache[name];
      if (existingType) {
        return existingType;
      }

      if (inProgressTypes[name]) {
        return this.createCircularDependencyResolver(name);
      }

      inProgressTypes[name] = true;

      const reference = declarationResolver();

      localReferenceTypeCache[name] = reference;

      this.current.AddReferenceType(reference);

      return reference;
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.error(`There was a problem resolving type of '${name}'.`);
      throw err;
    }
  }

  private createCircularDependencyResolver(refName: string) {
    const referenceType = {
      dataType: 'refObject',
      refName,
    } as Tsoa.ReferenceType;

    this.current.OnFinish(referenceTypes => {
      const realReferenceType = referenceTypes[refName];
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
  }

  private nodeIsUsable(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
      case ts.SyntaxKind.ClassDeclaration:
      case ts.SyntaxKind.TypeAliasDeclaration:
      case ts.SyntaxKind.EnumDeclaration:
        return true;
      default:
        return false;
    }
  }

  private resolveLeftmostIdentifier(type: ts.EntityName): ts.Identifier {
    while (type.kind !== ts.SyntaxKind.Identifier) {
      type = (type as ts.QualifiedName).left;
    }
    return type as ts.Identifier;
  }

  private resolveModelTypeScope(leftmost: ts.EntityName, statements: any): any[] {
    while (leftmost.parent && leftmost.parent.kind === ts.SyntaxKind.QualifiedName) {
      const leftmostName = leftmost.kind === ts.SyntaxKind.Identifier ? (leftmost as ts.Identifier).text : (leftmost as ts.QualifiedName).right.text;
      const moduleDeclarations = statements.filter(node => {
        if (node.kind !== ts.SyntaxKind.ModuleDeclaration || !this.current.IsExportedNode(node)) {
          return false;
        }

        const moduleDeclaration = node as ts.ModuleDeclaration;
        return (moduleDeclaration.name as ts.Identifier).text.toLowerCase() === leftmostName.toLowerCase();
      }) as ts.ModuleDeclaration[];

      if (!moduleDeclarations.length) {
        throw new GenerateMetadataError(`No matching module declarations found for ${leftmostName}.`);
      }
      if (moduleDeclarations.length > 1) {
        throw new GenerateMetadataError(`Multiple matching module declarations found for ${leftmostName}; please make module declarations unique.`);
      }

      const moduleBlock = moduleDeclarations[0].body as ts.ModuleBlock;
      if (moduleBlock === null || moduleBlock.kind !== ts.SyntaxKind.ModuleBlock) {
        throw new GenerateMetadataError(`Module declaration found for ${leftmostName} has no body.`);
      }

      statements = moduleBlock.statements;
      leftmost = leftmost.parent as ts.EntityName;
    }

    return statements;
  }

  private getModelTypeDeclaration(type: ts.EntityName) {
    const leftmostIdentifier = this.resolveLeftmostIdentifier(type);
    const statements: any[] = this.resolveModelTypeScope(leftmostIdentifier, this.current.nodes);

    const typeName = type.kind === ts.SyntaxKind.Identifier ? (type as ts.Identifier).text : (type as ts.QualifiedName).right.text;

    let modelTypes = statements.filter(node => {
      if (!this.nodeIsUsable(node) || !this.current.IsExportedNode(node)) {
        return false;
      }

      const modelTypeDeclaration = node as UsableDeclaration;
      return (modelTypeDeclaration.name as ts.Identifier).text === typeName;
    }) as Array<Exclude<UsableDeclaration, ts.PropertySignature>>;

    if (!modelTypes.length) {
      throw new GenerateMetadataError(
        `No matching model found for referenced type ${typeName}. If ${typeName} comes from a dependency, please create an interface in your own code that has the same structure. Tsoa can not utilize interfaces from external dependencies. Read more at https://github.com/lukeautry/tsoa/blob/master/docs/ExternalInterfacesExplanation.MD`,
      );
    }

    if (modelTypes.length > 1) {
      // remove types that are from typescript e.g. 'Account'
      modelTypes = modelTypes.filter(modelType => {
        if (
          modelType
            .getSourceFile()
            .fileName.replace(/\\/g, '/')
            .toLowerCase()
            .indexOf('node_modules/typescript') > -1
        ) {
          return false;
        }

        return true;
      });

      /**
       * Model is marked with '@tsoaModel', indicating that it should be the 'canonical' model used
       */
      const designatedModels = modelTypes.filter(modelType => {
        const isDesignatedModel = isExistJSDocTag(modelType, tag => tag.tagName.text === 'tsoaModel');
        return isDesignatedModel;
      });

      if (designatedModels.length > 0) {
        if (designatedModels.length > 1) {
          throw new GenerateMetadataError(`Multiple models for ${typeName} marked with '@tsoaModel'; '@tsoaModel' should only be applied to one model.`);
        }

        modelTypes = designatedModels;
      }
    }
    if (modelTypes.length > 1) {
      const conflicts = modelTypes.map(modelType => modelType.getSourceFile().fileName).join('"; "');
      throw new GenerateMetadataError(`Multiple matching models found for referenced type ${typeName}; please make model names unique. Conflicts found: "${conflicts}".`);
    }

    return modelTypes[0];
  }

  private getModelProperties(node: ts.InterfaceDeclaration | ts.ClassDeclaration, overrideToken?: OverrideToken): Tsoa.Property[] {
    const isIgnored = (e: ts.TypeElement | ts.ClassElement) => {
      const ignore = isExistJSDocTag(e, tag => tag.tagName.text === 'ignore');
      return ignore;
    };

    // Interface model
    if (ts.isInterfaceDeclaration(node)) {
      return node.members.filter(member => !isIgnored(member) && ts.isPropertySignature(member)).map((member: ts.PropertySignature) => this.propertyFromSignature(member, overrideToken));
    }

    // Class model
    const properties = node.members
      .filter(member => !isIgnored(member))
      .filter(member => member.kind === ts.SyntaxKind.PropertyDeclaration)
      .filter(member => this.hasPublicModifier(member)) as Array<ts.PropertyDeclaration | ts.ParameterDeclaration>;

    const classConstructor = node.members.find(member => ts.isConstructorDeclaration(member)) as ts.ConstructorDeclaration;

    if (classConstructor && classConstructor.parameters) {
      const constructorProperties = classConstructor.parameters.filter(parameter => this.isAccessibleParameter(parameter));

      properties.push(...constructorProperties);
    }

    return properties.map(property => this.propertyFromDeclaration(property, overrideToken));
  }

  private propertyFromSignature(propertySignature: ts.PropertySignature, overrideToken?: OverrideToken) {
    const identifier = propertySignature.name as ts.Identifier;

    if (!propertySignature.type) {
      throw new GenerateMetadataError(`No valid type found for property declaration.`);
    }

    let required = !propertySignature.questionToken;
    if (overrideToken && overrideToken.kind === ts.SyntaxKind.MinusToken) {
      required = true;
    } else if (overrideToken && overrideToken.kind === ts.SyntaxKind.QuestionToken) {
      required = false;
    }

    const property: Tsoa.Property = {
      default: getJSDocComment(propertySignature, 'default'),
      description: this.getNodeDescription(propertySignature),
      format: this.getNodeFormat(propertySignature),
      name: identifier.text,
      required,
      type: new TypeResolver(propertySignature.type, this.current, propertySignature.type.parent, this.extractEnum, this.context).resolve(),
      validators: getPropertyValidators(propertySignature) || {},
    };
    return property;
  }

  private propertyFromDeclaration(propertyDeclaration: ts.PropertyDeclaration | ts.ParameterDeclaration, overrideToken?: OverrideToken) {
    const identifier = propertyDeclaration.name as ts.Identifier;
    let typeNode = propertyDeclaration.type;

    if (!typeNode) {
      const tsType = this.current.typeChecker.getTypeAtLocation(propertyDeclaration);
      typeNode = this.current.typeChecker.typeToTypeNode(tsType);
    }

    if (!typeNode) {
      throw new GenerateMetadataError(`No valid type found for property declaration.`);
    }

    const type = new TypeResolver(typeNode, this.current, propertyDeclaration, this.extractEnum, this.context).resolve();

    let required = !propertyDeclaration.questionToken && !propertyDeclaration.initializer;
    if (overrideToken && overrideToken.kind === ts.SyntaxKind.MinusToken) {
      required = true;
    } else if (overrideToken && overrideToken.kind === ts.SyntaxKind.QuestionToken) {
      required = false;
    }

    const property: Tsoa.Property = {
      default: getInitializerValue(propertyDeclaration.initializer, type),
      description: this.getNodeDescription(propertyDeclaration),
      format: this.getNodeFormat(propertyDeclaration),
      name: identifier.text,
      required,
      type,
      validators: getPropertyValidators(propertyDeclaration) || {},
    };
    return property;
  }

  private getModelAdditionalProperties(node: UsableDeclaration) {
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      const interfaceDeclaration = node as ts.InterfaceDeclaration;
      const indexMember = interfaceDeclaration.members.find(member => member.kind === ts.SyntaxKind.IndexSignature);
      if (!indexMember) {
        return undefined;
      }

      const indexSignatureDeclaration = indexMember as ts.IndexSignatureDeclaration;
      const indexType = new TypeResolver(indexSignatureDeclaration.parameters[0].type as ts.TypeNode, this.current, this.parentNode, this.extractEnum, this.context).resolve();
      if (indexType.dataType !== 'string') {
        throw new GenerateMetadataError(`Only string indexers are supported.`);
      }

      return new TypeResolver(indexSignatureDeclaration.type as ts.TypeNode, this.current, this.parentNode, this.extractEnum, this.context).resolve();
    }

    return undefined;
  }

  private typeArgumentsToContext(type: ts.TypeReferenceNode | ts.ExpressionWithTypeArguments, targetEntitiy: ts.EntityName, context: Context): Context {
    this.context = {};

    const typeParameters = this.getModelTypeDeclaration(targetEntitiy).typeParameters;

    if (typeParameters) {
      for (let index = 0; index < typeParameters.length; index++) {
        const typeParameter = typeParameters[index];
        const typeArg = type.typeArguments && type.typeArguments[index];
        let resolvedType: ts.TypeNode;

        // Argument may be a forward reference from context
        if (typeArg && ts.isTypeReferenceNode(typeArg) && ts.isIdentifier(typeArg.typeName) && context[typeArg.typeName.text]) {
          resolvedType = context[typeArg.typeName.text];
        } else if (typeArg) {
          resolvedType = typeArg;
        } else if (typeParameter.default) {
          resolvedType = typeParameter.default;
        } else {
          throw new GenerateMetadataError(`Could not find a value for type parameter ${typeParameter.name.text}`, type);
        }

        this.context = {
          ...this.context,
          [typeParameter.name.text]: resolvedType,
        };
      }
    }
    return context;
  }

  private getModelInheritedProperties(modelTypeDeclaration: Exclude<UsableDeclaration, ts.PropertySignature | ts.TypeAliasDeclaration>): Tsoa.Property[] {
    let properties: Tsoa.Property[] = [];

    const heritageClauses = modelTypeDeclaration.heritageClauses;
    if (!heritageClauses) {
      return properties;
    }

    heritageClauses.forEach(clause => {
      if (!clause.types) {
        return;
      }

      clause.types.forEach(t => {
        const baseEntityName = t.expression as ts.EntityName;

        // create subContext
        const resetCtx = this.typeArgumentsToContext(t, baseEntityName, this.context);

        const referenceType = this.getReferenceTypeOrEnumType(t);
        if (referenceType) {
          if (referenceType.dataType === 'refEnum' || referenceType.dataType === 'enum') {
            // since it doesn't have properties to iterate over, then we don't do anything with it
          } else if (referenceType.dataType === 'refAlias') {
            let type: Tsoa.Type = referenceType;
            while (type.dataType === 'refAlias') {
              type = type.type;
            }

            if (type.dataType === 'refObject') {
              properties = [...properties, ...type.properties];
            } else if (type.dataType === 'nestedObjectLiteral') {
              properties = [...properties, ...type.properties];
            }
          } else if (referenceType.dataType === 'refObject') {
            referenceType.properties.forEach(property => properties.push(property));
          } else {
            assertNever(referenceType);
          }
        }

        // reset subContext
        this.context = resetCtx;
      });
    });

    return properties;
  }

  private hasPublicModifier(node: ts.Node) {
    return (
      !node.modifiers ||
      node.modifiers.every(modifier => {
        return modifier.kind !== ts.SyntaxKind.ProtectedKeyword && modifier.kind !== ts.SyntaxKind.PrivateKeyword;
      })
    );
  }

  private isAccessibleParameter(node: ts.Node) {
    // No modifiers
    if (!node.modifiers) {
      return false;
    }

    // public || public readonly
    if (node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PublicKeyword)) {
      return true;
    }

    // readonly, not private readonly, not public readonly
    const isReadonly = node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
    const isProtectedOrPrivate = node.modifiers.some(modifier => {
      return modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.PrivateKeyword;
    });
    return isReadonly && !isProtectedOrPrivate;
  }

  private getNodeDescription(node: UsableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration | ts.EnumDeclaration) {
    const symbol = this.current.typeChecker.getSymbolAtLocation(node.name as ts.Node);
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

    const comments = symbol.getDocumentationComment(this.current.typeChecker);
    if (comments.length) {
      return ts.displayPartsToString(comments);
    }

    return undefined;
  }

  private getNodeFormat(node: UsableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration | ts.EnumDeclaration) {
    return getJSDocComment(node, 'format');
  }

  private getNodeExample(node: UsableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration | ts.EnumDeclaration) {
    const example = getJSDocComment(node, 'example');

    if (example) {
      return JSON.parse(example);
    } else {
      return undefined;
    }
  }
}

interface ResolvesToPrimitive {
  foundMatch: true;
  resolvedType: 'number' | 'string' | 'boolean' | 'void';
}
interface DoesNotResolveToPrimitive {
  foundMatch: false;
}
