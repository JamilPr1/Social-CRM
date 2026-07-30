export interface SafeAccount {
  id: string;
  pageId: string;
  pageName: string;
  pageUsername: string | null;
  pagePicture: string | null;
  instagramId: string | null;
  instagramUsername: string | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
  adAccountId: string | null;
  adAccountName: string | null;
  createdAt: Date;
}
