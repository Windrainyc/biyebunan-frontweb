/** 平台值仅来自固定入口与服务端响应，不能充当授权依据。 */
export type Platform = 'admin' | 'student' | 'partner';
export interface User {
  avatarIndex?: number;
  avatarAssetId?: string | null;
  id: string;
  version: number;
  displayName: string;
  platform: Platform;
  phoneMasked: string;
  status: string;
  roleIds: string[];
}
export interface Session {
  accessToken: string;
  csrfToken: string;
  expiresIn: number;
  platform: Platform;
  user: User;
}
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export type Row = Record<string, unknown> & { id?: string; version?: number };
export interface Problem {
  status?: number;
  code?: string;
  detail?: string;
  title?: string;
  traceId?: string;
}
export interface Schema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  readOnly?: boolean;
  writeOnly?: boolean;
  format?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
  allOf?: Schema[];
}
export interface Operation {
  operationId: string;
  summary: string;
  permission?: string;
  body?: Schema;
  parameters: {
    name: string;
    in: string;
    required?: boolean;
    schema: Schema;
  }[];
  response?: Schema;
}
