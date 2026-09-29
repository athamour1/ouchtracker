import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import LoginPage from 'src/pages/auth/LoginPage.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      app: { name: 'OuchTracker', subtitle: 'Sub' },
      theme: { lightMode: 'Light', darkMode: 'Dark' },
      auth: {
        emailAddress: 'Email',
        password: 'Password',
        signIn: 'Sign In',
        stayLoggedIn: 'Stay Logged In',
        emailRequired: 'Email required',
        emailInvalid: 'Invalid email',
        passwordRequired: 'Password required',
        loginFailed: 'Login failed',
        orDivider: 'or',
        signInWith: 'Sign in with {provider}',
        ssoErrors: {
          provider_error: 'SSO failed',
          not_registered: 'Not registered',
        },
      },
      offline: { banner: 'Offline' },
    },
  },
});

const push = vi.fn();
const login = vi.fn();
const authConfig = vi.fn();
let routeQuery: Record<string, string> = {};

vi.mock('quasar', () => ({
  useQuasar: () => ({
    dark: {
      isActive: false,
      toggle: vi.fn(),
    },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: routeQuery }),
}));

vi.mock('src/services/api', () => ({
  authApi: {
    config: () => authConfig(),
    ssoLoginUrl: (stay: boolean, redirect: string) =>
      `/api/auth/oidc/login?stayLoggedIn=${String(stay)}&redirect=${redirect}`,
  },
}));

vi.mock('stores/auth.store', () => ({
  useAuthStore: () => ({
    loading: false,
    error: 'Invalid credentials',
    login,
  }),
}));

vi.mock('src/composables/useOnline', () => ({
  useOnline: () => ({
    isOnline: { value: true },
  }),
}));

function mountPage() {
  return shallowMount(LoginPage, {
    global: {
      plugins: [i18n],
      stubs: {
        'q-card': { template: '<div><slot /></div>' },
        'q-card-section': { template: '<div><slot /></div>' },
        'q-form': { template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
        'q-input': { template: '<div><slot name="prepend" /><slot name="append" /></div>' },
        'q-btn': {
          props: ['label'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>',
        },
        'q-icon': { template: '<i />' },
        'q-toggle': { template: '<div />' },
        'q-banner': { template: '<div><slot /></div>' },
        'q-tooltip': { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    push.mockReset();
    authConfig.mockReset();
    authConfig.mockResolvedValue({
      data: { localLoginEnabled: true, sso: { enabled: false, providerName: 'SSO' } },
    });
    routeQuery = { redirect: '/my-kits' };
  });

  it('redirects to route query after successful login', async () => {
    login.mockResolvedValue(true);
    const wrapper = mountPage();

    await wrapper.find('form').trigger('submit');

    expect(login).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/my-kits');
  });

  it('shows login error when authentication fails', async () => {
    login.mockResolvedValue(false);
    const wrapper = mountPage();

    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain('Invalid credentials');
  });

  it('hides the SSO button when SSO is disabled', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).not.toContain('Sign in with');
  });

  it('shows the SSO button and starts SSO login when enabled', async () => {
    authConfig.mockResolvedValue({
      data: { localLoginEnabled: true, sso: { enabled: true, providerName: 'authentik' } },
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { set href(v: string) { assign(v); } });

    const wrapper = mountPage();
    await flushPromises();

    const button = wrapper.findAll('button').find((b) => b.text().includes('Sign in with authentik'));
    expect(button).toBeDefined();
    await button!.trigger('click');

    expect(assign).toHaveBeenCalledWith('/api/auth/oidc/login?stayLoggedIn=false&redirect=/my-kits');
    vi.unstubAllGlobals();
  });

  it('hides the password form when local login is disabled', async () => {
    authConfig.mockResolvedValue({
      data: { localLoginEnabled: false, sso: { enabled: true, providerName: 'authentik' } },
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Sign in with authentik');
  });

  it('keeps the password form when the config request fails (e.g. offline)', async () => {
    authConfig.mockRejectedValue(new Error('offline'));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('shows a translated SSO error from the query string', async () => {
    routeQuery = { sso_error: 'not_registered' };
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Not registered');
  });
});
