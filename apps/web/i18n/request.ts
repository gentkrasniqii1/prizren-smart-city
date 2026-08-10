import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['sq', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'sq';

export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get('NEXT_LOCALE')?.value;
  const locale: AppLocale = raw === 'en' ? 'en' : 'sq';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
