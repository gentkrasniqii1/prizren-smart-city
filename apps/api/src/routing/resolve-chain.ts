import { Priority } from '@prisma/client';
import type { RoutePreview } from '@prizren/shared-types';

export type ChainDepartment = {
  institutionId: string | null;
  slaHours: number;
};

export type ChainCategory = {
  departmentId: string | null;
  slaHours: number;
  defaultPriority: Priority;
  department: ChainDepartment | null;
};

export type ChainRule = {
  departmentId: string | null;
  institutionId: string | null;
  slaHours: number | null;
  defaultPriority: Priority | null;
  department: ChainDepartment | null;
};

export type ResolvedChain = {
  departmentId: string | null;
  institutionId: string | null;
  slaHours: number;
  defaultPriority: Priority;
  source: RoutePreview['source'];
};

/**
 * category → institution → department.
 * A matching rule wins; a rule that names an institution does not keep a
 * department that belongs to a different organization.
 */
export function resolveRouteChain(
  matched: ChainRule | null,
  category: ChainCategory,
): ResolvedChain {
  if (!matched) {
    return withSla(
      {
        departmentId: category.departmentId,
        institutionId: category.department?.institutionId ?? null,
        source:
          category.departmentId || category.department?.institutionId
            ? 'category_fallback'
            : 'unrouted',
      },
      null,
      category,
    );
  }

  if (matched.departmentId) {
    return withSla(
      {
        departmentId: matched.departmentId,
        institutionId: matched.institutionId ?? matched.department?.institutionId ?? null,
        source: 'rule',
      },
      matched,
      category,
    );
  }

  if (matched.institutionId) {
    const sameOrg = category.department?.institutionId === matched.institutionId;
    return withSla(
      {
        departmentId: sameOrg ? category.departmentId : null,
        institutionId: matched.institutionId,
        source: 'rule',
      },
      matched,
      category,
    );
  }

  return withSla(
    {
      departmentId: category.departmentId,
      institutionId: category.department?.institutionId ?? null,
      source: 'rule',
    },
    matched,
    category,
  );
}

function withSla(
  targets: {
    departmentId: string | null;
    institutionId: string | null;
    source: RoutePreview['source'];
  },
  matched: ChainRule | null,
  category: ChainCategory,
): ResolvedChain {
  const departmentSla = matched?.department?.slaHours ?? category.department?.slaHours ?? 48;
  return {
    ...targets,
    slaHours: matched?.slaHours ?? category.slaHours ?? departmentSla,
    defaultPriority: matched?.defaultPriority ?? category.defaultPriority ?? Priority.MEDIUM,
  };
}
