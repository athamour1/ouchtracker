import { defineBoot } from '#q-app/wrappers';
import { createI18n } from 'vue-i18n';
import { messages, type Locale } from 'src/i18n';

const savedLocale = (localStorage.getItem('locale') ?? 'en') as Locale;

export const i18n = createI18n({
  locale: savedLocale,
  fallbackLocale: 'en',
  legacy: false,        // use Composition API mode
  messages,
});

export default defineBoot(({ app }) => {
  app.use(i18n);
});
