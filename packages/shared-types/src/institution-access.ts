export const INSTITUTION_ACCESS_PURPOSES = ['INSTITUTION_NEW_CASE'] as const;
export type InstitutionAccessPurpose = (typeof INSTITUTION_ACCESS_PURPOSES)[number];

/** Returned after a staff member opens a hashed mail link. Does not include the raw token. */
export interface InstitutionAccessResolveDto {
  reportId: string;
  publicId: string;
  institutionId: string;
  institutionName: string | null;
  expiresAt: string;
}

export interface InstitutionAccessRevokeDto {
  id: string;
  revokedAt: string;
}
