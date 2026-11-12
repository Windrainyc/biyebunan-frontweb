export interface Banner {
  id: string;
  version: number;
  title: string;
  subtitle: string;
  coverAssetId: string | null;
  posterAssetId: string | null;
  body: string;
  sortOrder: number;
  status: 'ENABLED' | 'DISABLED';
}
