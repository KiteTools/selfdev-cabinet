export function getTelegramWidgetErrorMessage(rawText, host = '') {
  const text = String(rawText || '').trim().toLowerCase();
  if (!text) return '';

  if (text.includes('bot domain invalid')) {
    const safeHost = host || 'текущий домен';
    return `Telegram Login Widget не разрешён для ${safeHost}. Обновите домен бота через /setdomain в BotFather.`;
  }

  return '';
}

export function createAuthController({
  api,
  getSpContactId,
  selectLoginWidget,
  selectRetryButton,
  selectStartMessage,
  setSpContactId,
  showScreen,
}) {
  async function authenticate() {
    const params = new URLSearchParams(window.location.search);
    setSpContactId(params.get('sp_contact_id'));

    try {
      const meResult = await api('me');
      if (meResult.user_id) {
        return meResult;
      }
    } catch {
      // No valid session — continue to auth
    }

    if (window.Telegram?.WebApp?.initData) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      try {
        return await api('auth-webapp', {
          method: 'POST',
          body: JSON.stringify({
            initData: tg.initData,
            sp_contact_id: getSpContactId(),
          }),
        });
      } catch (err) {
        if (err.status === 404 && err.data?.error === 'no_contact') {
          return showStartScreen();
        }
        throw err;
      }
    }

    let botUsername;
    let contactRequired = true;
    try {
      const cfg = await api('config');
      botUsername = cfg.telegram_bot_username;
      contactRequired = cfg.contact_id_required !== false;
    } catch {
      botUsername = '';
    }

    if (contactRequired && !getSpContactId()) return showStartScreen();
    showScreen('screen-login');

    if (!botUsername) {
      const widget = selectLoginWidget();
      if (widget) widget.innerHTML = '<p>Ошибка конфигурации</p>';
      throw new Error('Bot username not configured');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let observer = null;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (window.onTelegramAuth === handleTelegramAuth) {
          window.onTelegramAuth = null;
        }
      };

      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error || 'Ошибка авторизации')));
      };

      const finishResolve = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const checkWidgetError = (widget) => {
        const message = getTelegramWidgetErrorMessage(
          widget?.textContent || widget?.innerText || '',
          window.location?.host || ''
        );
        if (message) {
          finishReject(new Error(message));
        }
      };

      const handleTelegramAuth = async (telegramData) => {
        showScreen('screen-loading');
        try {
          const result = await api('auth-widget', {
            method: 'POST',
            body: JSON.stringify({
              telegramData,
              sp_contact_id: getSpContactId(),
            }),
          });
          finishResolve(result);
        } catch (err) {
          if (err.status === 404 && err.data?.error === 'no_contact') {
            cleanup();
            showStartScreen().then(finishResolve).catch(finishReject);
          } else {
            finishReject(err);
          }
        }
      };
      window.onTelegramAuth = handleTelegramAuth;

      const widget = selectLoginWidget();
      if (!widget) {
        finishReject(new Error('Telegram login widget container not found'));
        return;
      }

      widget.innerHTML = '';
      if (typeof MutationObserver === 'function') {
        observer = new MutationObserver(() => checkWidgetError(widget));
        observer.observe(widget, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '8');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.onerror = () => finishReject(new Error('Не удалось загрузить Telegram Login Widget'));
      widget.appendChild(script);
      checkWidgetError(widget);
    });
  }

  function showStartScreen() {
    showScreen('screen-start');
    return new Promise((resolve, reject) => {
      const btn = selectRetryButton();
      if (!btn || !btn.parentNode) {
        reject(new Error('Retry button not found'));
        return;
      }

      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', async () => {
        newBtn.disabled = true;
        newBtn.textContent = 'Проверяю...';
        showScreen('screen-loading');
        try {
          const result = await authenticate();
          resolve(result);
        } catch (err) {
          newBtn.disabled = false;
          newBtn.textContent = 'Проверить ещё раз';
        }
      });
    });
  }

  function handleAuthError(err) {
    console.error('Auth error:', err);
    showScreen('screen-start');
    const message = err.data?.error || err.message || 'Неизвестная ошибка';
    const messageEl = selectStartMessage();
    if (messageEl) {
      messageEl.textContent = `Ошибка: ${message}. Попробуйте ещё раз.`;
    }
  }

  return {
    authenticate,
    handleAuthError,
    showStartScreen,
  };
}
