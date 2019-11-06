import { Tsoa } from '../metadataGeneration/tsoa';
import { SwaggerConfig } from './../config';
import { SpecGenerator } from './specGenerator';
import { Swagger } from './swagger';
export declare class SpecGenerator2 extends SpecGenerator {
  protected readonly metadata: Tsoa.Metadata;
  protected readonly config: SwaggerConfig;
  constructor(metadata: Tsoa.Metadata, config: SwaggerConfig);
  GetSpec(): Swagger.Spec2;
  private buildDefinitions;
  private buildPaths;
  private buildMethod;
  protected buildOperation(controllerName: string, method: Tsoa.Method): Swagger.Operation;
  private buildBodyPropParameter;
  private buildParameter;
  private buildProperties;
  protected getSwaggerTypeForUnionType(
    type: Tsoa.UnionType,
  ):
    | Swagger.Schema
    | {
        type: string;
      };
  protected getSwaggerTypeForIntersectionType(
    type: Tsoa.IntersectionType,
  ): {
    type: string;
    properties: {};
  };
  protected getSwaggerTypeForReferenceType(referenceType: Tsoa.ReferenceType): Swagger.BaseSchema;
}
