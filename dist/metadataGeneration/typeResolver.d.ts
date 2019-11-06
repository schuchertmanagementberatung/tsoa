import * as ts from 'typescript';
import { MetadataGenerator } from './metadataGenerator';
import { Tsoa } from './tsoa';
interface Context {
    [name: string]: ts.TypeReferenceNode | ts.TypeNode;
}
export declare class TypeResolver {
    private readonly typeNode;
    private readonly current;
    private readonly parentNode?;
    private readonly extractEnum;
    private context;
    private readonly referencer?;
    constructor(typeNode: ts.TypeNode, current: MetadataGenerator, parentNode?: ts.Node | undefined, extractEnum?: boolean, context?: Context, referencer?: ts.TypeReferenceNode | ts.ExpressionWithTypeArguments | undefined);
    static clearCache(): void;
    resolve(): Tsoa.Type;
    private getLiteralValue;
    private getPrimitiveType;
    private getDateType;
    private getEnumerateType;
    private getReferenceTypeOrEnumType;
    private getTypeAliasReference;
    private getModelReference;
    private getRefTypeName;
    private attemptToResolveKindToPrimitive;
    private contextualizedName;
    private handleCachingAndCircularReferences;
    private createCircularDependencyResolver;
    private nodeIsUsable;
    private resolveLeftmostIdentifier;
    private resolveModelTypeScope;
    private getModelTypeDeclaration;
    private getModelProperties;
    private propertyFromSignature;
    private propertyFromDeclaration;
    private getModelAdditionalProperties;
    private typeArgumentsToContext;
    private getModelInheritedProperties;
    private hasPublicModifier;
    private isAccessibleParameter;
    private getNodeDescription;
    private getNodeFormat;
    private getNodeExample;
}
export {};
