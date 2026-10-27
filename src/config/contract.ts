import data from './contract.json';
import type { Operation, Schema } from '../types/api';
export const operations = data.operations as unknown as Record<string, Operation>;
const schemas = data.schemas as Record<string, Schema>;
export function schema(input?: Schema): Schema {
  if (!input) return {};
  if (input.$ref) return schema(schemas[input.$ref.split('/').pop() || '']);
  return input;
}
export function operation(method: string, path: string) {
  return operations[`${method.toUpperCase()} ${path}`];
}
