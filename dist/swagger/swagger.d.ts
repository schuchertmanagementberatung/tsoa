export declare namespace Swagger {
  type DataType = 'integer' | 'number' | 'boolean' | 'string' | 'array' | 'object';
  type DataFormat = 'int32' | 'int64' | 'float' | 'double' | 'byte' | 'binary' | 'date' | 'date-time' | 'password';
  type Protocol = 'http' | 'https' | 'ws' | 'wss';
  type SupportedSpecMajorVersion = 2 | 3;
  interface Spec {
    info: Info;
    tags?: Tag[];
    externalDocs?: ExternalDocs;
  }
  interface Spec2 extends Spec {
    swagger: '2.0';
    host?: string;
    basePath?: string;
    schemes?: Protocol[];
    consumes?: string[];
    produces?: string[];
    paths: {
      [name: string]: Path;
    };
    definitions?: {
      [name: string]: Schema;
    };
    parameters?: {
      [name: string]: Parameter;
    };
    responses?: {
      [name: string]: Response;
    };
    security?: Security[];
    securityDefinitions?: {
      [name: string]: Security;
    };
  }
  interface Spec3 extends Spec {
    openapi: '3.0.0';
    servers: Server[];
    components: Components;
    paths: {
      [name: string]: Path3;
    };
  }
  interface Components {
    callbacks?: {
      [name: string]: any;
    };
    examples?: {
      [name: string]: any;
    };
    headers?: {
      [name: string]: any;
    };
    links?: {
      [name: string]: any;
    };
    parameters?: {
      [name: string]: Parameter;
    };
    requestBodies?: {
      [name: string]: any;
    };
    responses?: {
      [name: string]: Response;
    };
    schemas?: {
      [name: string]: Schema;
    };
    securitySchemes?: {
      [name: string]: Security;
    };
  }
  interface Server {
    url: string;
  }
  interface Info {
    title: string;
    version?: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
  }
  interface Contact {
    name?: string;
    email?: string;
    url?: string;
  }
  interface License {
    name: string;
    url?: string;
  }
  interface ExternalDocs {
    url: string;
    description?: string;
  }
  interface Tag {
    name: string;
    description?: string;
    externalDocs?: ExternalDocs;
  }
  interface Example {
    [name: string]: any;
  }
  interface BaseParameter extends BaseSchema {
    name: string;
    in: 'query' | 'header' | 'path' | 'formData' | 'body';
    required?: boolean;
    description?: string;
    schema: Schema;
    type: DataType;
    format?: DataFormat;
  }
  interface BodyParameter extends BaseParameter {
    in: 'body';
  }
  interface QueryParameter extends BaseParameter {
    in: 'query';
    allowEmptyValue?: boolean;
    collectionFormat?: 'csv' | 'ssv' | 'tsv' | 'pipes' | 'multi';
  }
  interface PathParameter extends BaseParameter {
    in: 'path';
  }
  interface HeaderParameter extends BaseParameter {
    in: 'header';
  }
  interface FormDataParameter extends BaseParameter {
    in: 'formData';
    collectionFormat?: 'csv' | 'ssv' | 'tsv' | 'pipes' | 'multi';
  }
  type Parameter = BodyParameter | FormDataParameter | QueryParameter | PathParameter | HeaderParameter;
  interface Path {
    $ref?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    parameters?: Parameter[];
  }
  interface Path3 {
    $ref?: string;
    get?: Operation3;
    put?: Operation3;
    post?: Operation3;
    delete?: Operation3;
    options?: Operation3;
    head?: Operation3;
    patch?: Operation3;
    parameters?: Parameter[];
  }
  interface Operation {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocs;
    operationId: string;
    consumes?: string[];
    produces?: string[];
    parameters?: Parameter[];
    responses: {
      [name: string]: Response;
    };
    schemes?: Protocol[];
    deprecated?: boolean;
    security?: Security[];
  }
  interface Operation3 {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocs;
    operationId: string;
    consumes?: string[];
    parameters?: Parameter[];
    responses: {
      [name: string]: Response3;
    };
    schemes?: Protocol[];
    deprecated?: boolean;
    security?: Security[];
    requestBody?: RequestBody;
  }
  interface RequestBody {
    content: {
      [name: string]: MediaType;
    };
    description?: string;
    required?: boolean;
  }
  interface MediaType {
    schema?: Schema;
    example?: {
      [name: string]: any;
    };
    examples?: {
      [name: string]: any;
    };
    encoding?: {
      [name: string]: any;
    };
  }
  interface Response {
    description: string;
    schema?: Schema;
    headers?: {
      [name: string]: Header;
    };
    examples?: {
      [name: string]: Example;
    };
  }
  interface Response3 {
    description: string;
    content?: {
      [name: string]: Schema | Example;
    };
    headers?: {
      [name: string]: Header;
    };
  }
  interface BaseSchema {
    type?: string;
    format?: DataFormat;
    $ref?: string;
    title?: string;
    description?: string;
    default?: string | boolean | number | any;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    enum?: Array<string | number>;
    items?: BaseSchema;
  }
  interface Schema3 extends Schema {
    nullable?: boolean;
    oneOf?: BaseSchema[];
    allOf?: BaseSchema[];
  }
  interface Schema extends BaseSchema {
    type: DataType;
    format?: DataFormat;
    additionalProperties?: boolean | BaseSchema;
    properties?: {
      [propertyName: string]: Schema3;
    };
    discriminator?: string;
    readOnly?: boolean;
    xml?: XML;
    externalDocs?: ExternalDocs;
    example?: {
      [exampleName: string]: Example;
    };
    required?: string[];
  }
  interface Header extends BaseSchema {
    type: 'integer' | 'number' | 'boolean' | 'string' | 'array';
  }
  interface XML {
    type?: string;
    namespace?: string;
    prefix?: string;
    attribute?: string;
    wrapped?: boolean;
  }
  interface BasicSecurity3 {
    type: 'http';
    scheme: 'basic';
    description?: string;
  }
  interface BasicSecurity {
    type: 'basic';
    description?: string;
  }
  interface ApiKeySecurity {
    type: 'apiKey';
    name: string;
    in: 'query' | 'header';
    description?: string;
  }
  interface OAuth2ImplicitSecurity {
    type: 'oauth2';
    description?: string;
    flow: 'implicit';
    authorizationUrl: string;
  }
  interface OAuth2PasswordSecurity {
    type: 'oauth2';
    description?: string;
    flow: 'password';
    tokenUrl: string;
    scopes?: OAuthScope;
  }
  interface OAuth2ApplicationSecurity {
    type: 'oauth2';
    description?: string;
    flow: 'application';
    tokenUrl: string;
    scopes?: OAuthScope;
  }
  interface OAuth2AccessCodeSecurity {
    type: 'oauth2';
    description?: string;
    flow: 'accessCode';
    tokenUrl: string;
    authorizationUrl: string;
    scopes?: OAuthScope;
  }
  interface OAuthScope {
    [scopeName: string]: string;
  }
  type Security = BasicSecurity | BasicSecurity3 | ApiKeySecurity | OAuth2AccessCodeSecurity | OAuth2ApplicationSecurity | OAuth2ImplicitSecurity | OAuth2PasswordSecurity;
}
