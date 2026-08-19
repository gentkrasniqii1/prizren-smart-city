import { Priority } from '@prisma/client';
import { resolveRouteChain, type ChainCategory } from './resolve-chain';

const pothole: ChainCategory = {
  departmentId: 'dept-infra',
  slaHours: 72,
  defaultPriority: Priority.MEDIUM,
  department: { institutionId: 'inst-municipality', slaHours: 72 },
};

describe('resolveRouteChain', () => {
  it('maps category → municipality → infrastructure when no rule matches', () => {
    const result = resolveRouteChain(null, pothole);
    expect(result).toMatchObject({
      departmentId: 'dept-infra',
      institutionId: 'inst-municipality',
      source: 'category_fallback',
      slaHours: 72,
      defaultPriority: Priority.MEDIUM,
    });
  });

  it('maps garbage → waste company → collection from a matching rule', () => {
    const result = resolveRouteChain(
      {
        departmentId: 'dept-waste',
        institutionId: 'inst-waste',
        slaHours: 48,
        defaultPriority: Priority.MEDIUM,
        department: { institutionId: 'inst-waste', slaHours: 48 },
      },
      pothole,
    );
    expect(result).toMatchObject({
      departmentId: 'dept-waste',
      institutionId: 'inst-waste',
      source: 'rule',
      slaHours: 48,
    });
  });

  it('maps fire/police to the rule institution without keeping another org’s department', () => {
    const result = resolveRouteChain(
      {
        departmentId: null,
        institutionId: 'inst-fire',
        slaHours: 4,
        defaultPriority: Priority.CRITICAL,
        department: null,
      },
      pothole,
    );
    expect(result).toMatchObject({
      departmentId: null,
      institutionId: 'inst-fire',
      source: 'rule',
      slaHours: 4,
      defaultPriority: Priority.CRITICAL,
    });
  });

  it('keeps the category department when it already belongs to the rule institution', () => {
    const result = resolveRouteChain(
      {
        departmentId: null,
        institutionId: 'inst-municipality',
        slaHours: null,
        defaultPriority: null,
        department: null,
      },
      pothole,
    );
    expect(result).toMatchObject({
      departmentId: 'dept-infra',
      institutionId: 'inst-municipality',
      source: 'rule',
    });
  });
});
