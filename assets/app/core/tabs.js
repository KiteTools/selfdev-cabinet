import { $, $$ } from './dom.js';

export function createTabsController({
  onDashboardTab,
  onConsultationsTab,
  onDiariesTab,
  onRazborTab,
  onLinksTab,
  onRetroTab,
  onTabActivated,
}) {
  function keepActiveTabVisible(target) {
    const activeButton = document.querySelector(`.sections-nav .tab[data-tab="${target}"]`);
    activeButton?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  function activateTab(target, options = {}) {
    $$('.tab').forEach((tab) => tab.classList.remove('active'));
    $$('.tab-content').forEach((content) => content.classList.remove('active'));
    $$(`.tab[data-tab="${target}"]`).forEach((tab) => tab.classList.add('active'));
    $(`#tab-${target}`)?.classList.add('active');
    document.body.classList.toggle('dashboard-tab-active', target === 'dashboard');
    keepActiveTabVisible(target);
    onTabActivated?.(target);

    if (target === 'dashboard') onDashboardTab?.(options);
    if (target === 'consultations') onConsultationsTab(options);
    if (target === 'diaries') onDiariesTab(options);
    if (target === 'razbor') onRazborTab(options);
    if (target === 'links') onLinksTab(options);
    if (target === 'retro') onRetroTab(options);
  }

  function bindTabEvents() {
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    activateTab('dashboard');
  }

  return {
    activateTab,
    bindTabEvents,
  };
}
