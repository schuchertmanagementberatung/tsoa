import * as ts from 'typescript';
import { MetadataGenerator } from './metadataGenerator';
import { Tsoa } from './tsoa';
export declare class ParameterGenerator {
    private readonly parameter;
    private readonly method;
    private readonly path;
    private readonly current;
    constructor(parameter: ts.ParameterDeclaration, method: string, path: string, current: MetadataGenerator);
    Generate(): Tsoa.Parameter | null;
    private getRequestParameter;
    private getBodyPropParameter;
    private getBodyParameter;
    private getHeaderParameter;
    private getQueryParameter;
    private getPathParameter;
    private getParameterDescription;
    private supportBodyMethod;
    private supportParameterDecorator;
    private supportPathDataType;
    private getValidatedType;
}
